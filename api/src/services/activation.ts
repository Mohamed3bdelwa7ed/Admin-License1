import { Errors } from "../errors";
import { nowISO, uuid } from "../lib/dates";
import { signPayload, type SigningKeys } from "../crypto/signing";
import { Device, License, type ILicense } from "../models";
import { recordEvent } from "./events";

/**
 * Madar POS client protocol: activate / validate / deactivate.
 *
 * Every successful AND license-state-failing response is SIGNED with the
 * server's Ed25519 private key so the client can:
 *   1. verify authenticity (not tampered / not from a fake server)
 *   2. safely cache it locally for offline operation
 *   3. replay-protect via the client-provided nonce and serverTime
 *
 * Device-limit enforcement runs inside a MongoDB transaction: the device
 * count is re-checked while holding the write lock, so two simultaneous
 * activations can never both pass a full limit (e.g. maxDevices = 1).
 */

export interface ClientPayload {
  type: "activation" | "validation" | "deactivation";
  licenseKey: string;
  deviceId: string;
  nonce: string;
  status: "active" | "expired" | "revoked" | "suspended" | "deactivated";
  startDate: string;
  expirationDate: string;
  maxDevices: number;
  deviceLimitReached: boolean;
  validationIntervalHours: number;
  gracePeriodDays: number;
  serverTime: string;
  issuedAt: string;
}

export interface SignedResponse {
  keyId: string;
  algorithm: "ed25519";
  payload: ClientPayload;
  signature: string;
}

export interface Policy {
  validationIntervalHours: number;
  gracePeriodDays: number;
}

export interface ActivationDeps {
  keys: SigningKeys;
  policy: Policy;
}

function effectiveStatus(l: Pick<ILicense, "status" | "expiresAt">): "active" | "expired" | "revoked" | "suspended" {
  if (l.status === "revoked" || l.status === "suspended") return l.status;
  if (new Date(`${l.expiresAt}T23:59:59.999Z`).getTime() < Date.now()) return "expired";
  return "active";
}

function signedPayload(
  deps: ActivationDeps,
  type: ClientPayload["type"],
  license: Pick<ILicense, "key" | "startDate" | "expiresAt" | "maxDevices">,
  deviceId: string,
  nonce: string,
  status: ClientPayload["status"],
  deviceLimitReached: boolean,
): SignedResponse {
  const payload: ClientPayload = {
    type,
    licenseKey: license.key,
    deviceId,
    nonce,
    status,
    startDate: license.startDate,
    expirationDate: license.expiresAt,
    maxDevices: license.maxDevices,
    deviceLimitReached,
    validationIntervalHours: deps.policy.validationIntervalHours,
    gracePeriodDays: deps.policy.gracePeriodDays,
    serverTime: nowISO(),
    issuedAt: nowISO(),
  };
  return {
    keyId: deps.keys.keyId,
    algorithm: "ed25519",
    payload,
    signature: signPayload(deps.keys, payload as unknown as Record<string, unknown>),
  };
}

function licenseStateError(status: "expired" | "revoked" | "suspended"): never {
  throw status === "revoked"
    ? Errors.licenseRevoked()
    : status === "suspended"
      ? Errors.licenseSuspended()
      : Errors.licenseExpired();
}

export const activationService = {
  async activate(
    deps: ActivationDeps,
    input: { licenseKey: string; deviceId: string; deviceName: string; nonce: string },
  ): Promise<SignedResponse> {
    const license = await License.findOne({ key: input.licenseKey });
    if (!license) throw Errors.licenseNotFound();

    const state = effectiveStatus(license);
    if (state !== "active") licenseStateError(state);

    const existing = await Device.findOne({ license: license._id, deviceId: input.deviceId });

    if (existing && existing.status === "deactivated") {
      throw Errors.deactivatedDevice();
    }

    let deviceLimitReached = false;

    if (existing) {
      // already active: idempotent re-activation, refresh last_validation
      existing.lastValidation = nowISO();
      if (input.deviceName) existing.deviceName = input.deviceName;
      await existing.save();
      deviceLimitReached = license.activeSlots >= license.maxDevices;
    } else {
      // ATOMIC slot claim: the conditional filter (activeSlots < maxDevices)
      // guarantees two concurrent activations can never both claim the last
      // slot — MongoDB applies findOneAndUpdate atomically per document.
      const claimed = await License.findOneAndUpdate(
        { _id: license._id, activeSlots: { $lt: license.maxDevices } },
        { $inc: { activeSlots: 1 } },
        { new: true },
      );
      if (!claimed) throw Errors.deviceLimitReached(license.maxDevices);

      try {
        await Device.create({
          license: license._id,
          deviceId: input.deviceId,
          deviceName: input.deviceName,
          activatedAt: nowISO(),
          lastValidation: nowISO(),
          status: "active" as const,
        });
        await recordEvent({
          type: "device_added",
          license: license._id,
          customer: license.customer,
          actor: "System",
          message: `Device ${input.deviceName || input.deviceId} activated`,
        });
        deviceLimitReached = claimed.activeSlots >= claimed.maxDevices;
      } catch (err) {
        // roll the slot back if device creation failed (e.g. duplicate binding)
        await License.updateOne({ _id: license._id }, { $inc: { activeSlots: -1 } });
        throw err;
      }
    }

    return signedPayload(deps, "activation", license, input.deviceId, input.nonce, "active", deviceLimitReached);
  },

  async validate(
    deps: ActivationDeps,
    input: { licenseKey: string; deviceId: string; nonce: string },
  ): Promise<SignedResponse> {
    const license = await License.findOne({ key: input.licenseKey });
    if (!license) throw Errors.licenseNotFound();

    const device = await Device.findOne({ license: license._id, deviceId: input.deviceId });
    if (!device) throw Errors.deviceNotActivated();
    if (device.status === "deactivated") throw Errors.deactivatedDevice();

    const state = effectiveStatus(license);
    if (state !== "active") licenseStateError(state);

    device.lastValidation = nowISO();
    await device.save();

    return signedPayload(deps, "validation", license, input.deviceId, input.nonce, "active", false);
  },

  async deactivate(
    deps: ActivationDeps,
    input: { licenseKey: string; deviceId: string; nonce: string },
  ): Promise<SignedResponse> {
    const license = await License.findOne({ key: input.licenseKey });
    if (!license) throw Errors.licenseNotFound();

    const device = await Device.findOne({ license: license._id, deviceId: input.deviceId });
    if (!device) throw Errors.deviceNotActivated();

    if (device.status === "active") {
      device.status = "deactivated";
      device.deactivatedAt = nowISO();
      await device.save();
      // release the slot
      await License.updateOne({ _id: license._id }, { $inc: { activeSlots: -1 } });
      await recordEvent({
        type: "device_removed",
        license: license._id,
        customer: license.customer,
        actor: "System",
        message: `Device ${device.deviceName || device.deviceId} deactivated by client`,
      });
    }

    return signedPayload(deps, "deactivation", license, input.deviceId, input.nonce, "deactivated", false);
  },
};

export { uuid };
