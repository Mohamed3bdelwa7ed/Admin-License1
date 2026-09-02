import { beforeAll, describe, expect, it } from "vitest";
import { authed, cleanDatabase, http, licenseBody, clientBody } from "./helpers";
import { verifySignature } from "../src/crypto/signing";

describe("client API (Madar protocol)", () => {
  let headers: { Authorization: string };
  let licenseKey: string;
  let licenseId: string;
  const publicKey = { key: "", keyId: "" };

  beforeAll(async () => {
    await cleanDatabase();
    headers = await authed();
    const created = await http.post("/api/v1/licenses").set(headers).send(licenseBody({ maxDevices: 2 }));
    licenseKey = created.body.license.licenseKey;
    licenseId = created.body.license.id;

    const pk = await http.get("/api/v1/client/public-key");
    publicKey.key = pk.body.publicKey;
    publicKey.keyId = pk.body.keyId;
  });

  it("serves the Ed25519 public key", async () => {
    const res = await http.get("/api/v1/client/public-key");
    expect(res.status).toBe(200);
    expect(res.body.algorithm).toBe("ed25519");
    expect(res.body.publicKey).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(res.body.keyId).toBeTruthy();
  });

  it("activates a device and returns a SIGNED response that verifies", async () => {
    const res = await http.post("/api/v1/client/activate").send(clientBody(licenseKey, "MADAR-PC-0001", "nonce-act-0001"));
    expect(res.status).toBe(200);
    expect(res.body.keyId).toBe(publicKey.keyId);
    expect(res.body.algorithm).toBe("ed25519");
    expect(res.body.payload.status).toBe("active");
    expect(res.body.payload.type).toBe("activation");
    expect(res.body.payload.licenseKey).toBe(licenseKey);
    expect(res.body.payload.deviceId).toBe("MADAR-PC-0001");
    expect(res.body.payload.nonce).toBe("nonce-act-0001");
    expect(res.body.payload.validationIntervalHours).toBe(24);
    expect(res.body.payload.gracePeriodDays).toBe(14);

    // signature must verify against the advertised public key
    const ok = verifySignature(publicKey.key, res.body.payload, res.body.signature);
    expect(ok).toBe(true);

    // and a tampered payload must NOT verify
    const forged = { ...res.body.payload, status: "active", maxDevices: 999 };
    expect(verifySignature(publicKey.key, forged, res.body.signature)).toBe(false);
  });

  it("is idempotent: re-activating the same device succeeds", async () => {
    const res = await http.post("/api/v1/client/activate").send(clientBody(licenseKey, "MADAR-PC-0001", "nonce-act-0002"));
    expect(res.status).toBe(200);
    const devices = await http.get(`/api/v1/licenses/${licenseId}/devices`).set(headers);
    expect(devices.body.items.length).toBe(1);
  });

  it("activates up to maxDevices then rejects the next device", async () => {
    const second = await http.post("/api/v1/client/activate").send(clientBody(licenseKey, "MADAR-PC-0002", "nonce-act-0003"));
    expect(second.status).toBe(200);
    expect(second.body.payload.deviceLimitReached).toBe(true); // 2 of 2 now

    const third = await http.post("/api/v1/client/activate").send(clientBody(licenseKey, "MADAR-PC-0003", "nonce-act-0004"));
    expect(third.status).toBe(403);
    expect(third.body.error.code).toBe("DEVICE_LIMIT_REACHED");
  });

  it("concurrent activations never exceed maxDevices (transaction check)", async () => {
    const created = await http
      .post("/api/v1/licenses")
      .set(headers)
      .send(licenseBody({ email: "race@race.example", maxDevices: 1 }));
    const key = created.body.license.licenseKey;

    const results = await Promise.all([
      http.post("/api/v1/client/activate").send(clientBody(key, "RACE-DEV-0001", "nonce-race-001")),
      http.post("/api/v1/client/activate").send(clientBody(key, "RACE-DEV-0002", "nonce-race-002")),
    ]);
    const wins = results.filter((r) => r.status === 200);
    const rejects = results.filter((r) => r.status === 403 && r.body.error?.code === "DEVICE_LIMIT_REACHED");
    expect(wins.length).toBe(1);
    expect(rejects.length).toBe(1);

    const devices = await http.get(`/api/v1/licenses/${created.body.license.id}/devices`).set(headers);
    expect(devices.body.items.filter((d: { status: string }) => d.status === "active").length).toBe(1);
  });

  it("validates an activated device with a signed response", async () => {
    const res = await http.post("/api/v1/client/validate").send(clientBody(licenseKey, "MADAR-PC-0001", "nonce-val-0001"));
    expect(res.status).toBe(200);
    expect(res.body.payload.type).toBe("validation");
    expect(verifySignature(publicKey.key, res.body.payload, res.body.signature)).toBe(true);

    // lastValidation updated
    const devices = await http.get(`/api/v1/licenses/${licenseId}/devices`).set(headers);
    const dev = devices.body.items.find((d: { deviceId: string }) => d.deviceId === "MADAR-PC-0001");
    expect(dev.lastValidation).toBeTruthy();
  });

  it("refuses validation for an unactivated device", async () => {
    const res = await http.post("/api/v1/client/validate").send(clientBody(licenseKey, "UNKNOWN-DEV-999", "nonce-val-0002"));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("DEVICE_NOT_ACTIVATED");
  });

  it("deactivates a device (client-initiated) and blocks its re-validation", async () => {
    const off = await http.post("/api/v1/client/deactivate").send(clientBody(licenseKey, "MADAR-PC-0001", "nonce-deact-01"));
    expect(off.status).toBe(200);
    expect(off.body.payload.status).toBe("deactivated");
    expect(verifySignature(publicKey.key, off.body.payload, off.body.signature)).toBe(true);

    const val = await http.post("/api/v1/client/validate").send(clientBody(licenseKey, "MADAR-PC-0001", "nonce-deact-02"));
    expect(val.status).toBe(403);
    expect(val.body.error.code).toBe("DEACTIVATED_DEVICE");

    // re-activation of a deactivated device is rejected by the server
    const again = await http.post("/api/v1/client/activate").send(clientBody(licenseKey, "MADAR-PC-0001", "nonce-deact-03"));
    expect(again.status).toBe(403);
    expect(again.body.error.code).toBe("DEACTIVATED_DEVICE");
  });

  it("rejects an invalid license key", async () => {
    const res = await http.post("/api/v1/client/activate").send(clientBody("MDR-XXXX-XXXX-XXXX-XXXX", "DEV-X-000001", "nonce-bad-0001"));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("LICENSE_NOT_FOUND");
  });

  it("returns a SIGNED error for a revoked license", async () => {
    const created = await http.post("/api/v1/licenses").set(headers).send(licenseBody({ email: "rvk@test.example" }));
    const key = created.body.license.licenseKey;
    await http.post(`/api/v1/licenses/${created.body.license.id}/revoke`).set(headers).send({ reason: "test" });

    const res = await http.post("/api/v1/client/activate").send(clientBody(key, "DEV-R-000001", "nonce-rvk-0001"));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("LICENSE_REVOKED");
    // the error payload is signed and verifiable
    expect(res.body.keyId).toBe(publicKey.keyId);
    expect(res.body.payload.reason).toBe("LICENSE_REVOKED");
    expect(verifySignature(publicKey.key, res.body.payload, res.body.signature)).toBe(true);
  });

  it("returns a SIGNED error for an expired license", async () => {
    const past = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const created = await http
      .post("/api/v1/licenses")
      .set(headers)
      .send(licenseBody({ email: "exp@test.example", startDate: past, expirationDate: yesterday }));

    const res = await http.post("/api/v1/client/activate").send(clientBody(created.body.license.licenseKey, "DEV-E-000001", "nonce-exp-0001"));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("LICENSE_EXPIRED");
    expect(verifySignature(publicKey.key, res.body.payload, res.body.signature)).toBe(true);
  });

  it("rejects invalid nonce and deviceId formats", async () => {
    const shortNonce = await http.post("/api/v1/client/activate").send({ licenseKey, deviceId: "MADAR-PC-0002", nonce: "tiny" });
    expect(shortNonce.status).toBe(400);

    const badDevice = await http.post("/api/v1/client/activate").send({ licenseKey, deviceId: "bad device! id", nonce: "nonce-ok-00001" });
    expect(badDevice.status).toBe(400);
    expect(badDevice.body.error.code).toBe("INVALID_INPUT");
  });
});
