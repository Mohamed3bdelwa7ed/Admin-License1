import { config, assertProductionConfig } from "./config";
import { connectMongo, disconnectMongo } from "./lib/mongo";
import { ensureIndexes } from "./models";
import { upsertAdminUser } from "./services/auth";
import { saveLicenseDefaults } from "./services/settings";
import { buildAppFromConfig } from "./server";

/**
 * Server bootstrap:
 *  1. Validate config (production checks are strict)
 *  2. Connect MongoDB — the process REFUSES to start if the DB is unreachable
 *  3. Ensure indexes
 *  4. Bootstrap the admin account (if ADMIN_PASSWORD set)
 *  5. Persist env-provided license defaults on first boot
 *  6. Listen; graceful shutdown on SIGTERM/SIGINT
 */

async function main(): Promise<void> {
  const isProd = config.env === "production";
  if (isProd) assertProductionConfig();

  // 1. database — fail fast, never start "as if healthy"
  try {
    await connectMongo(config.mongoUri);
    console.log("[api] MongoDB connected");
  } catch (err) {
    console.error("[api] FATAL: could not connect to MongoDB.");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // 2. indexes
  await ensureIndexes();

  // 3. bootstrap admin
  if (config.admin.password) {
    await upsertAdminUser(config.admin.email, config.admin.password, config.admin.name);
    console.log(`[api] Admin account ready: ${config.admin.email}`);
  }

  // 4. seed license defaults once (DB overrides env after first save)
  if (!(await isDefaultsSeeded())) {
    await saveLicenseDefaults({
      defaultDurationMonths: config.defaults.durationMonths,
      defaultMaxDevices: config.defaults.maxDevices,
      validationIntervalHours: config.defaults.validationIntervalHours,
      gracePeriodDays: config.defaults.gracePeriodDays,
    });
  }

  const app = buildAppFromConfig();

  const server = app.listen(config.port, () => {
    console.log(`[api] License API listening on http://localhost:${config.port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[api] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectMongo();
      console.log("[api] MongoDB disconnected. Bye.");
      process.exit(0);
    });
    // hard exit if graceful close hangs
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  mongooseErrorHandlers();
}

async function isDefaultsSeeded(): Promise<boolean> {
  const { AppSetting } = await import("./models");
  return (await AppSetting.countDocuments({ key: "license_defaults" })) > 0;
}

function mongooseErrorHandlers(): void {
  process.on("unhandledRejection", (reason) => {
    console.error("[api] Unhandled rejection:", reason);
  });
}

main().catch((err) => {
  console.error("[api] Fatal startup error:", err);
  process.exit(1);
});
