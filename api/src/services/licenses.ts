import mongoose from "mongoose";
import { Errors } from "../errors";
import { daysUntil, effectiveStatusOf, endOfDay, iso, nowISO, uuid } from "../lib/dates";
import { Customer, Device, License, LicenseEvent, type ILicense } from "../models";
import { recordEvent } from "./events";

/**
 * License + customer + device domain logic (admin side).
 * Stored status: active | revoked | suspended (admin-controlled).
 * Effective status adds derived "expired" (based on expiresAt).
 * All API output is camelCase DTOs matching the existing frontend contract.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars (0/O, 1/I/L)

function generateLicenseKey(): string {
  const block = (): string => {
    let b = "";
    for (let i = 0; i < 4; i++) {
      b += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return b;
  };
  return `MDR-${block()}-${block()}-${block()}-${block()}`;
}

async function generateUniqueKey(): Promise<string> {
  let key = generateLicenseKey();
  // collision probability is astronomically small; retry just in case
  while (await License.exists({ key })) {
    key = generateLicenseKey();
  }
  return key;
}

type PopulatedCustomer = { _id: mongoose.Types.ObjectId; stringId: string; name: string; company: string; email: string };

type LicenseDoc = ILicense & {
  _id: mongoose.Types.ObjectId;
  customer: PopulatedCustomer;
} & { save(): Promise<LicenseDoc> };

export interface LicenseDTO {
  id: string;
  licenseKey: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  status: "active" | "expired" | "revoked" | "suspended";
  startDate: string;
  expirationDate: string;
  maxDevices: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  activeDevices: number;
}

function toDTO(l: LicenseDoc, activeDevices: number): LicenseDTO {
  return {
    id: l.stringId,
    licenseKey: l.key,
    customerId: l.customer.stringId,
    customerName: l.customer.name,
    customerCompany: l.customer.company,
    customerEmail: l.customer.email,
    status: effectiveStatusOf(l),
    startDate: l.startDate,
    expirationDate: l.expiresAt,
    maxDevices: l.maxDevices,
    notes: l.notes,
    createdAt: iso(l.createdAt),
    updatedAt: iso(l.updatedAt),
    revokedAt: l.revokedAt,
    revokedReason: l.revokedReason,
    activeDevices,
  };
}

const activeDeviceCount = async (licenseId: mongoose.Types.ObjectId): Promise<number> =>
  Device.countDocuments({ license: licenseId, status: "active" });

async function getLicenseOrFail(idOrKey: { stringId?: string; key?: string }): Promise<LicenseDoc> {
  const q = { ...(idOrKey.stringId ? { stringId: idOrKey.stringId } : {}), ...(idOrKey.key ? { key: idOrKey.key } : {}) };
  const doc = (await License.findOne(q).populate("customer")) as unknown as LicenseDoc | null;
  if (!doc) throw Errors.licenseNotFound();
  return doc;
}

export interface CreateLicenseInput {
  customerName: string;
  company: string;
  email: string;
  phone: string;
  startDate: string;
  expirationDate: string;
  maxDevices: number;
  notes: string;
}

export const licensesService = {
  async create(input: CreateLicenseInput, actor: string): Promise<{ license: LicenseDTO; customerCreated: boolean }> {
    // find or create customer by email
    let customer = await Customer.findOne({ email: input.email });
    let customerCreated = false;
    if (!customer) {
      customer = await Customer.create({
        name: input.customerName,
        company: input.company,
        email: input.email,
        phone: input.phone,
      });
      customerCreated = true;
    }

    const key = await generateUniqueKey();
    const doc = await License.create({
      key,
      customer: customer._id,
      status: "active",
      startDate: input.startDate,
      expiresAt: input.expirationDate,
      maxDevices: input.maxDevices,
      notes: input.notes,
    });

    await recordEvent({
      type: "license_created",
      license: doc._id,
      customer: customer._id,
      actor,
      message: `License created for ${input.company || input.customerName}`,
    });

    const populated = (await License.findById(doc._id).populate("customer")) as unknown as LicenseDoc;
    return { license: toDTO(populated, 0), customerCreated };
  },

  async list(filter: {
    search?: string;
    status?: "all" | "active" | "expired" | "revoked" | "suspended";
    expiringWithin?: number;
    page: number;
    perPage: number;
  }): Promise<{ items: LicenseDTO[]; total: number; page: number; perPage: number; totalPages: number }> {
    // find matching licenses (join customers via populate)
    const rx = filter.search
      ? new RegExp(filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const customerIds = rx
      ? (await Customer.find({ $or: [{ name: rx }, { company: rx }] }).select("_id")).map((c) => c._id)
      : null;

    const match: Record<string, unknown> = {};
    if (rx) {
      if (customerIds && customerIds.length > 0) {
        match.$or = [{ key: rx }, { customer: { $in: customerIds } }];
      } else {
        match.key = rx; // no customer matches — only key can match
      }
    }

    const docs = (await License.find(match)
      .populate("customer")
      .sort({ createdAt: -1 })) as unknown as LicenseDoc[];

    let items = docs.map((doc) => ({
      doc,
      activeDevices: doc.activeSlots, // slot counter is kept in sync atomically
    }));

    // derived-status filtering must happen in memory (expired is computed)
    if (filter.status && filter.status !== "all") {
      items = items.filter((i) => effectiveStatusOf(i.doc) === filter.status);
    }
    if (filter.expiringWithin != null) {
      items = items.filter(
        (i) =>
          effectiveStatusOf(i.doc) === "active" &&
          daysUntil(i.doc.expiresAt) <= filter.expiringWithin! &&
          daysUntil(i.doc.expiresAt) >= 0,
      );
    }

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / filter.perPage));
    const page = Math.min(filter.page, totalPages);
    const slice = items.slice((page - 1) * filter.perPage, page * filter.perPage);
    return {
      items: slice.map((i) => toDTO(i.doc, i.activeDevices)),
      total,
      page,
      perPage: filter.perPage,
      totalPages,
    };
  },

  async getById(stringId: string): Promise<LicenseDTO> {
    const doc = await getLicenseOrFail({ stringId });
    return toDTO(doc, doc.activeSlots);
  },

  async revoke(stringId: string, reason: string, actor: string): Promise<LicenseDTO> {
    const doc = await getLicenseOrFail({ stringId });
    if (doc.status === "revoked") throw Errors.invalidInput("License is already revoked");
    doc.status = "revoked";
    doc.revokedAt = nowISO();
    doc.revokedReason = reason || null;
    await doc.save();
    await recordEvent({
      type: "license_revoked",
      license: doc._id,
      customer: doc.customer._id,
      actor,
      message: `License revoked${reason ? `: ${reason}` : ""}`,
    });
    return toDTO(doc, doc.activeSlots);
  },

  async reactivate(stringId: string, actor: string): Promise<LicenseDTO> {
    const doc = await getLicenseOrFail({ stringId });
    if (doc.status !== "revoked") throw Errors.invalidInput("Only revoked licenses can be reactivated");
    doc.status = "active";
    doc.revokedAt = null;
    doc.revokedReason = null;
    await doc.save();
    await recordEvent({
      type: "license_reactivated",
      license: doc._id,
      customer: doc.customer._id,
      actor,
      message: "License reactivated",
    });
    return toDTO(doc, doc.activeSlots);
  },

  async renew(stringId: string, newExpiration: string, actor: string): Promise<LicenseDTO> {
    const doc = await getLicenseOrFail({ stringId });
    if (doc.status === "revoked") throw Errors.licenseRevoked();
    if (newExpiration <= doc.expiresAt)
      throw Errors.invalidInput("New expiration must be after the current expiration");
    doc.expiresAt = newExpiration;
    await doc.save();
    await recordEvent({
      type: "license_renewed",
      license: doc._id,
      customer: doc.customer._id,
      actor,
      message: `License extended to ${newExpiration}`,
    });
    return toDTO(doc, doc.activeSlots);
  },

  async setMaxDevices(stringId: string, maxDevices: number, actor: string): Promise<LicenseDTO> {
    const doc = await getLicenseOrFail({ stringId });
    const active = await activeDeviceCount(doc._id);
    if (maxDevices < active)
      throw Errors.invalidInput(`Cannot set limit below current active devices (${active})`);
    doc.maxDevices = maxDevices;
    await doc.save();
    await recordEvent({
      type: "device_limit_changed",
      license: doc._id,
      customer: doc.customer._id,
      actor,
      message: `Device limit changed to ${maxDevices}`,
    });
    return toDTO(doc, active);
  },

  /**
   * Permanently deletes a license with its devices and audit events.
   * The key can never work again afterwards: activate/validate look the
   * key up in the database and fail closed (LICENSE_NOT_FOUND) when it
   * is gone — there is nothing left to revoke or reactivate.
   */
  async remove(stringId: string): Promise<{ id: string; licenseKey: string }> {
    const doc = await getLicenseOrFail({ stringId });
    const licenseKey = doc.key;
    // audit events reference the license — remove them first
    await LicenseEvent.deleteMany({ license: doc._id });
    // document deleteOne fires the model's cascade hook (removes devices)
    await (doc as unknown as { deleteOne(): Promise<unknown> }).deleteOne();
    return { id: stringId, licenseKey };
  },

  async devices(stringId: string): Promise<DeviceDTO[]> {    const doc = await getLicenseOrFail({ stringId });
    const devices = await Device.find({ license: doc._id }).sort({ activatedAt: -1 });
    return devices.map(toDeviceDTO);
  },

  async deactivateDevice(stringId: string, deviceRowId: string, actor: string): Promise<void> {
    const doc = await getLicenseOrFail({ stringId });
    const device = await Device.findOne({ stringId: deviceRowId, license: doc._id });
    if (!device) throw Errors.deviceNotFound();
    if (device.status === "deactivated") throw Errors.invalidInput("Device is already deactivated");
    device.status = "deactivated";
    device.deactivatedAt = nowISO();
    await device.save();
    // release the slot
    await License.updateOne({ _id: doc._id }, { $inc: { activeSlots: -1 } });
    await recordEvent({
      type: "device_deactivated",
      license: doc._id,
      customer: doc.customer._id,
      actor,
      message: `Device ${device.deviceName || device.deviceId} deactivated`,
    });
  },
};

export interface DeviceDTO {
  id: string;
  licenseId: string;
  deviceId: string;
  deviceName: string;
  activatedAt: string;
  lastValidation: string | null;
  status: "active" | "deactivated";
  deactivatedAt: string | null;
}

export function toDeviceDTO(d: {
  stringId: string;
  license: mongoose.Types.ObjectId | { stringId: string };
  deviceId: string;
  deviceName: string;
  activatedAt: string;
  lastValidation: string | null;
  status: "active" | "deactivated";
  deactivatedAt: string | null;
}): DeviceDTO {
  return {
    id: d.stringId,
    licenseId: typeof d.license === "object" && "stringId" in d.license ? d.license.stringId : String(d.license),
    deviceId: d.deviceId,
    deviceName: d.deviceName,
    activatedAt: d.activatedAt,
    lastValidation: d.lastValidation,
    status: d.status,
    deactivatedAt: d.deactivatedAt,
  };
}

export const customersService = {
  async list(search?: string): Promise<CustomerDTO[]> {
    const rx = search ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    const query = rx ? { $or: [{ name: rx }, { company: rx }, { email: rx }] } : {};
    const customers = await Customer.find(query).sort({ name: 1 }).collation({ locale: "en", strength: 2 });
    const result: CustomerDTO[] = [];
    for (const c of customers) {
      const licenses = await License.find({ customer: c._id });
      const activeLicenses = licenses.filter((l) => effectiveStatusOf(l) === "active").length;
      const ids = licenses.map((l) => l._id);
      const deviceCount =
        ids.length === 0 ? 0 : await Device.countDocuments({ license: { $in: ids }, status: "active" });
      result.push({
        id: c.stringId,
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone,
        createdAt: iso(c.createdAt),
        licenseCount: licenses.length,
        activeLicenses,
        deviceCount,
      });
    }
    return result;
  },

  async getById(stringId: string): Promise<CustomerDTO & { licenses: LicenseDTO[] }> {
    const c = await Customer.findOne({ stringId });
    if (!c) throw Errors.notFound("Customer not found");
    const licenses = await License.find({ customer: c._id }).sort({ createdAt: -1 }).populate("customer");
    const dtos: LicenseDTO[] = [];
    for (const l of licenses as unknown as LicenseDoc[]) {
      dtos.push(toDTO(l, l.activeSlots));
    }
    return {
      id: c.stringId,
      name: c.name,
      company: c.company,
      email: c.email,
      phone: c.phone,
      createdAt: iso(c.createdAt),
      licenseCount: licenses.length,
      activeLicenses: dtos.filter((l) => l.status === "active").length,
      deviceCount: await Device.countDocuments({
        license: { $in: licenses.map((l) => l._id) },
        status: "active",
      }),
      licenses: dtos,
    };
  },
};

export interface CustomerDTO {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  createdAt: string;
  licenseCount: number;
  activeLicenses: number;
  deviceCount: number;
}

export const devicesService = {
  async list(filter: {
    search?: string;
    status?: "all" | "active" | "deactivated";
  }): Promise<(DeviceDTO & { customerName: string; customerCompany: string; licenseKey: string; licenseStatus: string })[]> {
    const rx = filter.search
      ? new RegExp(filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;
    const match: Record<string, unknown> = {};
    if (filter.status && filter.status !== "all") match["devices.status"] = filter.status;
    if (rx) {
      match.$or = [
        { "devices.deviceId": rx },
        { "devices.deviceName": rx },
        { "licenses.key": rx },
        { "customers.name": rx },
        { "customers.company": rx },
      ];
    }

    const rows = await Device.aggregate([
      { $lookup: { from: "licenses", localField: "license", foreignField: "_id", as: "licenses" } },
      { $unwind: "$licenses" },
      { $lookup: { from: "customers", localField: "licenses.customer", foreignField: "_id", as: "customers" } },
      { $unwind: "$customers" },
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      { $sort: { activatedAt: -1 } },
    ]);

    return rows.map((r: Record<string, unknown>) => ({
      id: (r.stringId as string) ?? uuid(),
      licenseId: (r.licenses as Record<string, unknown>).stringId as string,
      deviceId: r.deviceId as string,
      deviceName: r.deviceName as string,
      activatedAt: r.activatedAt as string,
      lastValidation: (r.lastValidation as string | null) ?? null,
      status: r.status as "active" | "deactivated",
      deactivatedAt: (r.deactivatedAt as string | null) ?? null,
      customerName: (r.customers as Record<string, unknown>).name as string,
      customerCompany: (r.customers as Record<string, unknown>).company as string,
      licenseKey: (r.licenses as Record<string, unknown>).key as string,
      licenseStatus: effectiveStatusOf(r.licenses as unknown as ILicense),
    }));
  },
};

export function isExpired(l: { expiresAt: string }): boolean {
  return endOfDay(l.expiresAt).getTime() < Date.now();
}
