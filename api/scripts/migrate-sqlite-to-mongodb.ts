import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { connectMongo, disconnectMongo } from "../src/lib/mongo";
import {
  AdminUser,
  AppSetting,
  Customer,
  Device,
  License,
  LicenseEvent,
} from "../src/models";

/**
 * ONE-TIME migration: legacy SQLite database -> MongoDB (Atlas).
 *
 * Usage:  MONGODB_URI=... node --experimental-strip-types scripts/migrate-sqlite-to-mongodb.ts path/to/license.db
 * (or configure DB path in .env and run: npm run migrate:sqlite)
 *
 * - Preserves public string IDs, timestamps, license states, and relations.
 * - Idempotent: re-running matches existing records by (stringId / unique key)
 *   and skips them — no duplicates.
 * - Does NOT migrate raw refresh tokens (sessions): they are short-lived and
 *   users simply log in again. Password hashes migrate as-is (bcrypt), never
 *   in plaintext.
 * - Prints a verification report (SQLite vs MongoDB counts).
 */

interface Row {
  [k: string]: unknown;
}

async function main(): Promise<void> {
  const dbPath = process.argv[2] ?? process.env.LEGACY_SQLITE_PATH ?? "./data/license.db";
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`SQLite database not found: ${dbPath}`);
    console.error("Nothing to migrate — if this is unexpected, check the path.");
    process.exit(1);
  }

  console.log(`Source SQLite:  ${dbPath}`);
  console.log(`Target MongoDB: ${mongoUri.replace(/\/\/([^:]+):[^@]*@/, "//$1:****@")}\n`);

  const sql = new DatabaseSync(dbPath, { readOnly: true });
  await connectMongo(mongoUri);

  const all = (table: string): Row[] => {
    try {
      return sql.prepare(`SELECT * FROM ${table}`).all() as Row[];
    } catch {
      return []; // table missing in old schema — fine
    }
  };

  // ---- 1. admin users ----
  const adminRows = all("admin_users");
  let adminsMigrated = 0;
  for (const r of adminRows) {
    const existing = await AdminUser.findOne({ stringId: r.id as string });
    if (existing) continue;
    await AdminUser.create({
      stringId: r.id as string,
      name: r.name as string,
      email: (r.email as string).toLowerCase(),
      passwordHash: r.password_hash as string, // stays bcrypt-hashed
      role: ((r.role as string) === "viewer" ? "viewer" : "admin"),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    });
    adminsMigrated++;
  }

  // ---- 2. customers ----
  const customerRows = all("customers");
  let customersMigrated = 0;
  const customerIdMap = new Map<string, import("mongoose").Types.ObjectId>();
  for (const r of customerRows) {
    const sid = r.id as string;
    let doc = await Customer.findOne({ stringId: sid });
    if (!doc) {
      doc = await Customer.findOne({ email: (r.email as string).toLowerCase() });
      if (doc && doc.stringId !== sid) doc = null; // different customer, don't merge
    }
    if (!doc) {
      doc = await Customer.create({
        stringId: sid,
        name: r.name as string,
        company: (r.company as string) ?? "",
        email: (r.email as string).toLowerCase(),
        phone: (r.phone as string) ?? "",
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
      });
      customersMigrated++;
    }
    customerIdMap.set(sid, doc._id);
  }

  // ---- 3. licenses ----
  const licenseRows = all("licenses");
  let licensesMigrated = 0;
  const licenseIdMap = new Map<string, import("mongoose").Types.ObjectId>();
  for (const r of licenseRows) {
    const sid = r.id as string;
    let doc = await License.findOne({ stringId: sid });
    if (!doc) doc = await License.findOne({ key: r.key as string });
    if (!doc) {
      doc = await License.create({
        stringId: sid,
        key: (r.key as string).toUpperCase(),
        customer: customerIdMap.get(r.customer_id as string)!,
        status: r.status as "active" | "revoked" | "suspended",
        startDate: r.start_date as string,
        expiresAt: r.expiration_date as string,
        maxDevices: r.max_devices as number,
        notes: (r.notes as string) ?? "",
        revokedAt: (r.revoked_at as string | null) ?? null,
        revokedReason: (r.revoked_reason as string | null) ?? null,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
      });
      licensesMigrated++;
    }
    licenseIdMap.set(sid, doc._id);
  }

  // ---- 4. devices ----
  const deviceRows = all("devices");
  let devicesMigrated = 0;
  for (const r of deviceRows) {
    let doc = await Device.findOne({ stringId: r.id as string });
    if (!doc) {
      const licenseId = licenseIdMap.get(r.license_id as string);
      if (!licenseId) continue; // orphan device (license deleted in legacy) — skip
      doc = await Device.findOne({ license: licenseId, deviceId: r.device_id as string });
    }
    if (!doc) {
      const licenseId = licenseIdMap.get(r.license_id as string);
      if (!licenseId) continue;
      await Device.create({
        stringId: r.id as string,
        license: licenseId,
        deviceId: r.device_id as string,
        deviceName: (r.device_name as string) ?? "",
        activatedAt: r.activated_at as string,
        lastValidation: (r.last_validation as string | null) ?? null,
        status: r.status as "active" | "deactivated",
        deactivatedAt: (r.deactivated_at as string | null) ?? null,
        createdAt: r.activated_at as string,
        updatedAt: r.activated_at as string,
      });
      devicesMigrated++;
    }
  }

  // ---- 5. events ----
  const eventRows = all("license_events");
  let eventsMigrated = 0;
  for (const r of eventRows) {
    const exists = await LicenseEvent.exists({ stringId: r.id as string });
    if (exists) continue;
    await LicenseEvent.create({
      stringId: r.id as string,
      type: r.type as string,
      license: r.license_id ? (licenseIdMap.get(r.license_id as string) ?? null) : null,
      customer: r.customer_id ? (customerIdMap.get(r.customer_id as string) ?? null) : null,
      actor: r.actor as string,
      message: r.message as string,
      createdAt: r.created_at as string,
    });
    eventsMigrated++;
  }

  // ---- 6. settings ----
  const settingRows = all("app_settings");
  let settingsMigrated = 0;
  for (const r of settingRows) {
    const exists = await AppSetting.exists({ key: r.key as string });
    if (exists) continue;
    await AppSetting.create({ key: r.key as string, value: r.value as string });
    settingsMigrated++;
  }

  // ---- verification report ----
  const [mgCustomers, mgLicenses, mgDevices, mgEvents, mgAdmins] = await Promise.all([
    Customer.countDocuments(),
    License.countDocuments(),
    Device.countDocuments(),
    LicenseEvent.countDocuments(),
    AdminUser.countDocuments(),
  ]);

  console.log("================ VERIFICATION REPORT ================");
  console.log("                    SQLite      MongoDB");
  console.log(`Admin users:      ${String(adminRows.length).padStart(6)}      ${String(mgAdmins).padStart(6)}`);
  console.log(`Customers:        ${String(customerRows.length).padStart(6)}      ${String(mgCustomers).padStart(6)}`);
  console.log(`Licenses:         ${String(licenseRows.length).padStart(6)}      ${String(mgLicenses).padStart(6)}`);
  console.log(`Devices:          ${String(deviceRows.length).padStart(6)}      ${String(mgDevices).padStart(6)}`);
  console.log(`Events:           ${String(eventRows.length).padStart(6)}      ${String(mgEvents).padStart(6)}`);
  console.log(`Settings:         ${String(settingRows.length).padStart(6)}      ${String(settingsMigrated).padStart(6)} (skipped duplicates)`);
  console.log("====================================================");
  console.log(`
Migrated this run: ${adminsMigrated} admins, ${customersMigrated} customers, ${licensesMigrated} licenses, ${devicesMigrated} devices, ${eventsMigrated} events, ${settingsMigrated} settings.
Refresh tokens were intentionally NOT migrated (users must log in again).
The script is idempotent — re-running it skips already-migrated records.
`);

  sql.close();
  await disconnectMongo();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
