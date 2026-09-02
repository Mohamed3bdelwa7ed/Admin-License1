import { beforeAll, describe, expect, it } from "vitest";
import { authed, cleanDatabase, http, licenseBody } from "./helpers";

describe("licenses (admin API)", () => {
  let headers: { Authorization: string };

  beforeAll(async () => {
    await cleanDatabase();
    headers = await authed();
  });

  it("requires authentication", async () => {
    const res = await http.get("/api/v1/licenses");
    expect(res.status).toBe(401);
  });

  it("creates a license with a securely-generated key", async () => {
    const res = await http.post("/api/v1/licenses").set(headers).send(licenseBody());
    expect(res.status).toBe(201);
    expect(res.body.license.licenseKey).toMatch(/^MDR-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(res.body.license.status).toBe("active");
    expect(res.body.license.activeDevices).toBe(0);
    expect(res.body.customerCreated).toBe(true);
  });

  it("reuses an existing customer by email (no duplicate customers)", async () => {
    const first = await http.post("/api/v1/licenses").set(headers).send(licenseBody());
    const second = await http.post("/api/v1/licenses").set(headers).send(licenseBody({ company: "Other Co" }));
    expect(second.status).toBe(201);
    expect(second.body.customerCreated).toBe(false);
    expect(second.body.license.customerId).toBe(first.body.license.customerId);
  });

  it("rejects invalid license input", async () => {
    const res = await http.post("/api/v1/licenses").set(headers).send(licenseBody({ expirationDate: "2020-01-01" }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_INPUT");
  });

  it("rejects maxDevices out of range", async () => {
    const res = await http.post("/api/v1/licenses").set(headers).send(licenseBody({ maxDevices: 99 }));
    expect(res.status).toBe(400);
  });

  it("lists licenses with pagination and filters", async () => {
    const res = await http.get("/api/v1/licenses?page=1&perPage=5").set(headers);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
    expect(res.body.page).toBe(1);

    const filtered = await http.get("/api/v1/licenses?status=active").set(headers);
    expect(filtered.status).toBe(200);
    expect(filtered.body.items.every((l: { status: string }) => l.status === "active")).toBe(true);
  });

  it("searches by customer name and key", async () => {
    const created = await http
      .post("/api/v1/licenses")
      .set(headers)
      .send(licenseBody({ customerName: "Zayn Searchable", company: "Zayn Co", email: "zayn@search.example" }));
    const byName = await http.get("/api/v1/licenses?search=zayn").set(headers);
    expect(byName.body.items.some((l: { id: string }) => l.id === created.body.license.id)).toBe(true);

    const byKey = await http.get(`/api/v1/licenses?search=${created.body.license.licenseKey.slice(0, 8)}`).set(headers);
    expect(byKey.body.items.some((l: { id: string }) => l.id === created.body.license.id)).toBe(true);
  });

  it("retrieves license details", async () => {
    const created = await http.post("/api/v1/licenses").set(headers).send(licenseBody());
    const res = await http.get(`/api/v1/licenses/${created.body.license.id}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.licenseKey).toBe(created.body.license.licenseKey);
    expect(res.body.customerName).toBe("Omar Haddad");
  });

  it("404s for an unknown license", async () => {
    const res = await http.get("/api/v1/licenses/nope").set(headers);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("LICENSE_NOT_FOUND");
  });

  it("renews a license (extends expiration)", async () => {
    const created = await http.post("/api/v1/licenses").set(headers).send(licenseBody());
    const newExp = new Date(Date.now() + 2 * 365 * 86_400_000).toISOString().slice(0, 10);
    const res = await http.post(`/api/v1/licenses/${created.body.license.id}/renew`).set(headers).send({ expirationDate: newExp });
    expect(res.status).toBe(200);
    expect(res.body.expirationDate).toBe(newExp);
  });

  it("refuses renewal that does not extend", async () => {
    const created = await http.post("/api/v1/licenses").set(headers).send(licenseBody());
    const res = await http
      .post(`/api/v1/licenses/${created.body.license.id}/renew`)
      .set(headers)
      .send({ expirationDate: created.body.license.expirationDate });
    expect(res.status).toBe(400);
  });

  it("revokes and reactivates a license", async () => {
    const created = await http.post("/api/v1/licenses").set(headers).send(licenseBody());
    const revoked = await http
      .post(`/api/v1/licenses/${created.body.license.id}/revoke`)
      .set(headers)
      .send({ reason: "test revocation" });
    expect(revoked.status).toBe(200);
    expect(revoked.body.status).toBe("revoked");

    // double revoke fails
    const again = await http.post(`/api/v1/licenses/${created.body.license.id}/revoke`).set(headers).send({});
    expect(again.status).toBe(400);

    const reactivated = await http.post(`/api/v1/licenses/${created.body.license.id}/reactivate`).set(headers);
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.status).toBe("active");
  });

  it("shows an expired license as expired (derived status)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const past = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const created = await http.post("/api/v1/licenses").set(headers).send(licenseBody({ startDate: past, expirationDate: yesterday }));
    const res = await http.get(`/api/v1/licenses/${created.body.license.id}`).set(headers);
    expect(res.body.status).toBe("expired");

    // and it appears under the expired filter
    const filtered = await http.get("/api/v1/licenses?status=expired").set(headers);
    expect(filtered.body.items.some((l: { id: string }) => l.id === created.body.license.id)).toBe(true);

    void today;
  });

  it("changes the device limit and refuses limits below active devices", async () => {
    const created = await http.post("/api/v1/licenses").set(headers).send(licenseBody({ maxDevices: 3 }));
    const up = await http.post(`/api/v1/licenses/${created.body.license.id}/device-limit`).set(headers).send({ maxDevices: 5 });
    expect(up.status).toBe(200);
    expect(up.body.maxDevices).toBe(5);

    // activate 2 devices then try lowering below it
    const key = created.body.license.licenseKey;
    await http.post("/api/v1/client/activate").send({ licenseKey: key, deviceId: "DEV-A-000001", nonce: "nonce-aaaabbbb" });
    await http.post("/api/v1/client/activate").send({ licenseKey: key, deviceId: "DEV-B-000002", nonce: "nonce-aaaacccc" });
    const down = await http.post(`/api/v1/licenses/${created.body.license.id}/device-limit`).set(headers).send({ maxDevices: 1 });
    expect(down.status).toBe(400);
  });

  it("deactivates a device via the admin endpoint", async () => {
    const created = await http.post("/api/v1/licenses").set(headers).send(licenseBody());
    const key = created.body.license.licenseKey;
    await http.post("/api/v1/client/activate").send({ licenseKey: key, deviceId: "DEV-C-000003", nonce: "nonce-aaaadddd" });

    const devices = await http.get(`/api/v1/licenses/${created.body.license.id}/devices`).set(headers);
    expect(devices.body.items.length).toBe(1);

    const res = await http.delete(`/api/v1/licenses/${created.body.license.id}/devices/${devices.body.items[0].id}`).set(headers);
    expect(res.status).toBe(204);

    const after = await http.get(`/api/v1/licenses/${created.body.license.id}/devices`).set(headers);
    expect(after.body.items[0].status).toBe("deactivated");
  });

  it("exposes license events (audit trail)", async () => {
    const created = await http.post("/api/v1/licenses").set(headers).send(licenseBody());
    const res = await http.get(`/api/v1/licenses/${created.body.license.id}/events`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0].type).toBe("license_created");
  });
});
