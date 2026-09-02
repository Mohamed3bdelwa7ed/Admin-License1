import { connectMongo, disconnectMongo } from "../src/lib/mongo";
import { ensureIndexes } from "../src/models";
import { upsertAdminUser } from "../src/services/auth";
import { licensesService } from "../src/services/licenses";
import { addMonthsStr, todayStr } from "../src/lib/dates";
import { config } from "../src/config";
import { saveLicenseDefaults } from "../src/services/settings";

/**
 * Seeds demo data (customers + licenses with varied states) so the admin
 * frontend has something to show. Requires MONGODB_URI in the environment.
 */

async function main(): Promise<void> {
  if (!config.mongoUri) {
    console.error("MONGODB_URI is not set. Copy .env.example to .env and configure it first.");
    process.exit(1);
  }
  const email = process.env.SEED_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "admin@madar.example";
  // IMPORTANT: default to ADMIN_PASSWORD from .env so seeding never
  // locks you out with a different password than the server expects.
  const password = process.env.SEED_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    console.error("No password configured. Set ADMIN_PASSWORD (or SEED_ADMIN_PASSWORD) in .env first.");
    process.exit(1);
  }

  await connectMongo(config.mongoUri);
  await ensureIndexes();
  await upsertAdminUser(email, password, "MoHashem");
  await saveLicenseDefaults({
    defaultDurationMonths: config.defaults.durationMonths,
    defaultMaxDevices: config.defaults.maxDevices,
    validationIntervalHours: config.defaults.validationIntervalHours,
    gracePeriodDays: config.defaults.gracePeriodDays,
  });

  const demo = [
    { customerName: "Omar Haddad", company: "Al Noor Store", email: "omar@alnoor.example", phone: "+963 991 111 222", months: 12, maxDevices: 2, notes: "Main branch license" },
    { customerName: "Layla Kassem", company: "Bloom Supermarket", email: "layla@bloom.example", phone: "+963 992 333 444", months: 1, maxDevices: 3, notes: "Trial converted to annual" },
    { customerName: "Fadi Zaher", company: "Zaher Electronics", email: "fadi@zaher.example", phone: "+963 993 555 666", months: 1, maxDevices: 1, notes: "" },
    { customerName: "Rania Saeed", company: "Saeed Pharma", email: "rania@saeed.example", phone: "+963 994 777 888", months: 12, maxDevices: 5, notes: "HQ + 4 branches" },
    { customerName: "Mahmoud Ali", company: "Ali Textiles", email: "mahmoud@alitextiles.example", phone: "+963 995 999 000", months: -1, maxDevices: 2, notes: "Awaiting renewal payment" },
  ];

  let created = 0;
  for (const d of demo) {
    const start = d.months >= 0 ? todayStr() : addMonthsStr(todayStr(), d.months);
    const expiration = addMonthsStr(start, Math.max(d.months, 1));
    await licensesService.create(
      {
        customerName: d.customerName,
        company: d.company,
        email: d.email,
        phone: d.phone,
        startDate: start,
        expirationDate: expiration,
        maxDevices: d.maxDevices,
        notes: d.notes,
      },
      "Seed",
    );
    created++;
  }

  console.log(`Seeded ${created} demo licenses. Admin login: ${email} / ${password}`);
  await disconnectMongo();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
