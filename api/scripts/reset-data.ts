/**
 * Cleans data from the MongoDB database (your MONGODB_URI from .env).
 *
 * Usage:
 *   npx tsx scripts/reset-data.ts             -> shows what WOULD be deleted (dry run)
 *   npx tsx scripts/reset-data.ts --licenses   -> deletes only licenses (+ their devices + events)
 *   npx tsx scripts/reset-data.ts --customers  -> deletes customers + licenses + devices + events
 *   npx tsx scripts/reset-data.ts --all        -> deletes EVERYTHING including admin users + settings
 *                                                (restart the API afterwards: it re-creates the
 *                                                 admin from ADMIN_EMAIL/ADMIN_PASSWORD in .env)
 *
 * The admin account and license defaults are always KEPT unless you use --all.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo, disconnectMongo } from "../src/lib/mongo";
import { AdminUser, AppSetting, Customer, Device, License, LicenseEvent } from "../src/models";

const arg = process.argv[2] ?? "--dry-run";

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }
  await connectMongo(uri);

  const [customers, licenses, devices, events, admins, settings] = await Promise.all([
    Customer.countDocuments(),
    License.countDocuments(),
    Device.countDocuments(),
    LicenseEvent.countDocuments(),
    AdminUser.countDocuments(),
    AppSetting.countDocuments(),
  ]);

  console.log("\nCurrent database contents:");
  console.table({ customers, licenses, devices, events, adminUsers: admins, settings });

  if (arg === "--dry-run") {
    console.log("DRY RUN — nothing deleted. Choose: --licenses | --customers | --all");
    await disconnectMongo();
    return;
  }

  if (arg === "--licenses") {
    const licenseIds = (await License.find({}).select("_id")).map((l) => l._id);
    const r1 = await Device.deleteMany({ license: { $in: licenseIds } });
    const r2 = await LicenseEvent.deleteMany({ license: { $in: licenseIds } });
    const r3 = await License.deleteMany({});
    console.log(`Deleted ${r3.deletedCount} licenses, ${r1.deletedCount} devices, ${r2.deletedCount} events. (Customers kept)`);
  } else if (arg === "--customers") {
    const r1 = await Device.deleteMany({});
    const r2 = await LicenseEvent.deleteMany({});
    const r3 = await License.deleteMany({});
    const r4 = await Customer.deleteMany({});
    console.log(`Deleted ${r4.deletedCount} customers, ${r3.deletedCount} licenses, ${r1.deletedCount} devices, ${r2.deletedCount} events.`);
  } else if (arg === "--all") {
    const r1 = await Device.deleteMany({});
    const r2 = await LicenseEvent.deleteMany({});
    const r3 = await License.deleteMany({});
    const r4 = await Customer.deleteMany({});
    const r5 = await AdminUser.deleteMany({});
    const r6 = await AppSetting.deleteMany({});
    console.log(`Wiped everything: ${r4.deletedCount} customers, ${r3.deletedCount} licenses, ${r1.deletedCount} devices, ${r2.deletedCount} events, ${r5.deletedCount} admins, ${r6.deletedCount} settings.`);
    console.log("Restart the API (npm run start/dev) to re-create the admin from .env.");
  } else {
    console.error(`Unknown option: ${arg}`);
    console.error("Use: --dry-run | --licenses | --customers | --all");
    process.exit(1);
  }

  const after = {
    customers: await Customer.countDocuments(),
    licenses: await License.countDocuments(),
    devices: await Device.countDocuments(),
    events: await LicenseEvent.countDocuments(),
    adminUsers: await AdminUser.countDocuments(),
    settings: await AppSetting.countDocuments(),
  };
  console.log("\nAfter reset:");
  console.table(after);

  await disconnectMongo();
  process.exit(0);
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
