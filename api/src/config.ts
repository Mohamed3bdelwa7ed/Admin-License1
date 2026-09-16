import dotenv from "dotenv";

dotenv.config();

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Invalid number for ${name}: ${v}`);
  return n;
}

function str(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function parseOrigins(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function resolveCorsOrigins(): string[] {
  // Primary: CORS_ORIGINS (comma-separated, existing convention).
  // Alias: FRONTEND_URL (single URL, common on Render/Cloudflare hosting).
  // Both are merged + deduplicated so either env var works.
  const fromList = parseOrigins(str("CORS_ORIGINS", ""));
  const fromSingle = parseOrigins(str("FRONTEND_URL", ""));
  const merged = [...fromList, ...fromSingle].filter((v, i, arr) => arr.indexOf(v) === i);
  if (merged.length > 0) return merged;
  // Sensible defaults: local Vite dev + production Cloudflare Workers frontend.
  return ["http://localhost:5173", "https://admin-licensev2.jamm7498.workers.dev"];
}

export const config = {
  env: str("NODE_ENV", "development"),
  port: num("PORT", 4000),
  mongoUri: str("MONGODB_URI"),
  corsOrigins: resolveCorsOrigins(),
  admin: {
    email: str("ADMIN_EMAIL", "admin@madar.example"),
    password: str("ADMIN_PASSWORD", ""),
    name: str("ADMIN_NAME", "Admin"),
  },
  jwtSecret: str("JWT_SECRET", ""),
  signing: {
    privateKey: str("LICENSE_SIGNING_PRIVATE_KEY"),
    publicKey: str("LICENSE_SIGNING_PUBLIC_KEY"),
    keyId: str("LICENSE_SIGNING_KEY_ID"),
  },
  defaults: {
    durationMonths: num("DEFAULT_DURATION_MONTHS", 12),
    maxDevices: num("DEFAULT_MAX_DEVICES", 2),
    validationIntervalHours: num("VALIDATION_INTERVAL_HOURS", 24),
    gracePeriodDays: num("GRACE_PERIOD_DAYS", 14),
  },
  rateLimits: {
    loginPerMinute: num("RATE_LIMIT_LOGIN_PER_MINUTE", 5),
    clientPerMinute: num("RATE_LIMIT_CLIENT_PER_MINUTE", 60),
  },
};

export function assertProductionConfig(): void {
  const problems: string[] = [];
  if (!config.mongoUri || !/^mongodb(\+srv)?:\/\//.test(config.mongoUri))
    problems.push("MONGODB_URI must be set (MongoDB Atlas connection string)");
  if (!config.jwtSecret || config.jwtSecret.length < 32)
    problems.push("JWT_SECRET must be set (>= 32 chars)");
  if (!config.signing.privateKey || !config.signing.publicKey)
    problems.push("LICENSE_SIGNING_PRIVATE_KEY / LICENSE_SIGNING_PUBLIC_KEY must be set (run: npm run keygen)");
  if (!config.signing.keyId) problems.push("LICENSE_SIGNING_KEY_ID must be set");
  if (problems.length > 0) {
    throw new Error(`Production configuration error:\n  - ${problems.join("\n  - ")}`);
  }
}
