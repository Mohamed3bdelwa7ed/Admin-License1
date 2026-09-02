import { beforeAll, describe, expect, it } from "vitest";
import { AdminUser, AppSetting, Customer, Device, License, LicenseEvent, RefreshToken } from "../src/models";
import { connectMongo, isMongoConnected, mongoHealth } from "../src/lib/mongo";
import { cleanDatabase, http, authed } from "./helpers";

describe("database (MongoDB)", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  it("is connected and health reports it", () => {
    expect(isMongoConnected()).toBe(true);
    const h = mongoHealth();
    expect(h.connected).toBe(true);
    expect(h.name).toBeTruthy();
  });

  it("rejects duplicate license keys (unique index)", async () => {
    const c = await Customer.create({ name: "U Customer", email: "uniq@test.example" });
    await License.create({ key: "MDR-UNIQ-TEST-KEY1", customer: c._id, startDate: "2026-01-01", expiresAt: "2027-01-01", maxDevices: 1 });
    await expect(
      License.create({ key: "MDR-UNIQ-TEST-KEY1", customer: c._id, startDate: "2026-01-01", expiresAt: "2027-01-01", maxDevices: 1 }),
    ).rejects.toThrow(/duplicate key|E11000/i);
  });

  it("rejects duplicate customer emails (unique index)", async () => {
    await Customer.create({ name: "A", email: "dup@test.example" });
    await expect(Customer.create({ name: "B", email: "dup@test.example" })).rejects.toThrow(
      /duplicate key|E11000/i,
    );
  });

  it("rejects duplicate admin emails (unique index)", async () => {
    await AdminUser.create({ name: "A", email: "dupadmin@test.example", passwordHash: "x", role: "admin" });
    await expect(
      AdminUser.create({ name: "B", email: "dupadmin@test.example", passwordHash: "y", role: "admin" }),
    ).rejects.toThrow(/duplicate key|E11000/i);
  });

  it("rejects duplicate device binding per license (compound unique index)", async () => {
    const c = await Customer.create({ name: "Dev Customer", email: "devbind@test.example" });
    const l = await License.create({ key: "MDR-UNIQ-TEST-KEY2", customer: c._id, startDate: "2026-01-01", expiresAt: "2027-01-01", maxDevices: 2 });
    await Device.create({ license: l._id, deviceId: "SAME-DEVICE-001", activatedAt: new Date().toISOString(), status: "active" });
    await expect(
      Device.create({ license: l._id, deviceId: "SAME-DEVICE-001", activatedAt: new Date().toISOString(), status: "active" }),
    ).rejects.toThrow(/duplicate key|E11000/i);
  });

  it("rejects duplicate refresh token hashes (unique index)", async () => {
    const u = await AdminUser.create({ name: "RT", email: "rt@test.example", passwordHash: "x" });
    await RefreshToken.create({ user: u._id, tokenHash: "hash-unique-001", expiresAt: new Date(Date.now() + 1000) });
    await expect(
      RefreshToken.create({ user: u._id, tokenHash: "hash-unique-001", expiresAt: new Date(Date.now() + 1000) }),
    ).rejects.toThrow(/duplicate key|E11000/i);
  });

  it("created the expected indexes", async () => {
    const indexes = async (m: { listIndexes(): Promise<Array<{ name: string }>> }): Promise<string[]> =>
      (await m.listIndexes()).map((i) => i.name);

    expect(await indexes(License)).toEqual(expect.arrayContaining(["key_1", "status_1", "expiresAt_1", "stringId_1", "customer_1_createdAt_-1"]));
    expect(await indexes(Device)).toEqual(expect.arrayContaining(["license_1_deviceId_1", "license_1_status_1", "deviceId_1", "stringId_1"]));
    expect(await indexes(Customer)).toEqual(expect.arrayContaining(["email_1", "name_1", "stringId_1"]));
    expect(await indexes(AdminUser)).toEqual(expect.arrayContaining(["email_1", "stringId_1"]));
    expect(await indexes(LicenseEvent)).toEqual(expect.arrayContaining(["license_1_createdAt_-1", "createdAt_-1", "stringId_1"]));
    expect(await indexes(RefreshToken)).toEqual(expect.arrayContaining(["tokenHash_1", "expiresAt_1"]));
    expect(await indexes(AppSetting)).toEqual(expect.arrayContaining(["key_1"]));
  });

  it("cascades cleanly: deleting a license removes its devices", async () => {
    const c = await Customer.create({ name: "Cascade", email: "cascade@test.example" });
    const l = await License.create({ key: "MDR-CASCADE-KEY01", customer: c._id, startDate: "2026-01-01", expiresAt: "2027-01-01", maxDevices: 1 });
    await Device.create({ license: l._id, deviceId: "CASCADE-DEV-001", activatedAt: new Date().toISOString(), status: "active" });
    expect(await Device.countDocuments({ license: l._id })).toBe(1);
    await l.deleteOne();
    expect(await Device.countDocuments({ license: l._id })).toBe(0);
  });

  it("repository operations via the API work end-to-end (stats + customers + devices + events)", async () => {
    const headers = await authed();
    const today = new Date().toISOString().slice(0, 10);
    const next = new Date(Date.now() + 30_000_000_000).toISOString().slice(0, 10);
    const created = await http.post("/api/v1/licenses").set(headers).send({
      customerName: "Stats Person",
      company: "Stats Co",
      email: "stats@test.example",
      phone: "",
      startDate: today,
      expirationDate: next,
      maxDevices: 1,
      notes: "",
    });
    expect(created.status).toBe(201);
    const key = created.body.license.licenseKey;

    await http.post("/api/v1/client/activate").send({ licenseKey: key, deviceId: "STATS-DEV-0001", nonce: "nonce-stats-01" });

    const stats = await http.get("/api/v1/stats").set(headers);
    expect(stats.status).toBe(200);
    expect(stats.body.total).toBeGreaterThan(0);
    expect(stats.body.active).toBeGreaterThan(0);
    expect(stats.body.activeDevices).toBeGreaterThan(0);

    const customers = await http.get("/api/v1/customers").set(headers);
    const statsCustomer = customers.body.items.find((c: { email: string }) => c.email === "stats@test.example");
    expect(statsCustomer).toBeTruthy();
    expect(statsCustomer.licenseCount).toBe(1);
    expect(statsCustomer.activeLicenses).toBe(1);
    expect(statsCustomer.deviceCount).toBe(1);

    const customerDetail = await http.get(`/api/v1/customers/${statsCustomer.id}`).set(headers);
    expect(customerDetail.body.licenses.length).toBe(1);

    const devices = await http.get("/api/v1/devices").set(headers);
    expect(devices.body.items.some((d: { deviceId: string }) => d.deviceId === "STATS-DEV-0001")).toBe(true);
    const devicesFiltered = await http.get("/api/v1/devices?status=deactivated").set(headers);
    expect(devicesFiltered.body.items.every((d: { status: string }) => d.status === "deactivated")).toBe(true);

    const events = await http.get("/api/v1/events").set(headers);
    expect(events.body.items.some((e: { type: string }) => e.type === "device_added")).toBe(true);
    expect(events.body.items.some((e: { licenseKey: string | null }) => e.licenseKey === key)).toBe(true);
  });

  it("settings round-trips", async () => {
    const headers = await authed();
    const updated = await http
      .put("/api/v1/settings/license-defaults")
      .set(headers)
      .send({ defaultDurationMonths: 6, defaultMaxDevices: 3, validationIntervalHours: 12, gracePeriodDays: 7 });
    expect(updated.status).toBe(200);
    expect(updated.body.defaultDurationMonths).toBe(6);

    const read = await http.get("/api/v1/settings/license-defaults").set(headers);
    expect(read.body).toEqual({ defaultDurationMonths: 6, defaultMaxDevices: 3, validationIntervalHours: 12, gracePeriodDays: 7 });
  });

  it("connectMongo fails clearly without a URI", async () => {
    await expect(connectMongo("")).rejects.toThrow(/MONGODB_URI is not set/);
    expect(isMongoConnected()).toBe(true); // original connection untouched
  });
});
