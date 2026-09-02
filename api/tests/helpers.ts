import { afterAll, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createApp } from "../src/server";
import { ensureIndexes } from "../src/models";
import { upsertAdminUser } from "../src/services/auth";
import { resetRateLimits } from "../src/middleware/rateLimit";

/**
 * Test environment: in-memory MongoDB REPLICA SET (not the production DB).
 * A replica set is required so MongoDB transactions work — the same
 * mechanism used by MongoDB Atlas in production.
 */

export const ADMIN = { email: "admin@test.example", password: "test-password-123", name: "Test Admin" };

let replSet: MongoMemoryReplSet;
let testUri = "";

export let app: Express;
export let http: request.Agent;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  testUri = replSet.getUri("license_test");
  mongoose.set("strictQuery", true);
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 30_000 });

  await ensureIndexes();
  await upsertAdminUser(ADMIN.email, ADMIN.password, ADMIN.name);

  app = createApp({
    jwtSecret: "test-jwt-secret-32-chars-minimum-value",
    signing: { privateKey: "", publicKey: "", keyId: "" }, // -> ephemeral keys
    policy: { validationIntervalHours: 24, gracePeriodDays: 14 },
    rateLimits: { loginPerMinute: 1000, clientPerMinute: 1000 }, // high limits; rate limiting is tested explicitly
    corsOrigins: ["http://localhost:5173"],
  });
  http = request(app);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}, 30_000);

/** Drops all collections + resets rate-limit state between test files. */
export async function cleanDatabase(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("test database not connected");
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  await upsertAdminUser(ADMIN.email, ADMIN.password, ADMIN.name);
  resetRateLimits();
}

/** URI of the in-memory test replica set (for reconnect helpers). */
export function getTestUri(): string {
  return testUri;
}

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
}

export async function login(): Promise<AdminSession> {
  const res = await http.post("/api/v1/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
}

export async function authed(): Promise<{ Authorization: string }> {
  const s = await login();
  return { Authorization: `Bearer ${s.accessToken}` };
}

export function licenseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  return {
    customerName: "Omar Haddad",
    company: "Al Noor Store",
    email: "omar@alnoor.example",
    phone: "+963 991 111 222",
    startDate: today,
    expirationDate: nextYear,
    maxDevices: 2,
    notes: "test license",
    ...overrides,
  };
}

export function clientBody(licenseKey: string, deviceId = "TEST-DEVICE-0001", nonce = "nonce-12345678"): Record<string, string> {
  return { licenseKey, deviceId, nonce };
}
