import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { resetRateLimits } from "../src/middleware/rateLimit";
import { authed, cleanDatabase, http } from "./helpers";

describe("security", () => {
  beforeAll(async () => {
    await cleanDatabase();
    resetRateLimits();
  });

  it("blocks unauthorized admin API access", async () => {
    const endpoints = [
      ["get", "/api/v1/licenses"],
      ["get", "/api/v1/customers"],
      ["get", "/api/v1/devices"],
      ["get", "/api/v1/events"],
      ["get", "/api/v1/stats"],
      ["get", "/api/v1/settings/license-defaults"],
      ["post", "/api/v1/licenses"],
    ] as const;
    for (const [method, url] of endpoints) {
      const res = method === "get" ? await http.get(url) : await http.post(url).send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("rejects a garbage bearer token", async () => {
    const res = await http.get("/api/v1/licenses").set("Authorization", "Bearer not-a-jwt");
    expect(res.status).toBe(401);
  });

  it("rate-limits login attempts", async () => {
    resetRateLimits();
    // dedicated app instance with a LOW login limit for this explicit test
    const strictApp = createApp({
      jwtSecret: "test-jwt-secret-32-chars-minimum-value",
      signing: { privateKey: "", publicKey: "", keyId: "" },
      policy: { validationIntervalHours: 24, gracePeriodDays: 14 },
      rateLimits: { loginPerMinute: 5, clientPerMinute: 1000 },
      corsOrigins: [],
    });
    const attempts = Array.from({ length: 6 }, (_, i) =>
      request(strictApp).post("/api/v1/auth/login").send({ email: `user${i}@x.example`, password: "wrong" }),
    );
    const results = await Promise.all(attempts);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses[0]).toBe(401); // some get 401 invalid credentials
    expect(statuses[statuses.length - 1]).toBe(429); // but eventually rate limited
    expect(results.some((r) => r.body.error?.code === "RATE_LIMITED")).toBe(true);
    resetRateLimits();
  });

  it("rate-limits client endpoints", async () => {
    resetRateLimits();
    const strictApp = createApp({
      jwtSecret: "test-jwt-secret-32-chars-minimum-value",
      signing: { privateKey: "", publicKey: "", keyId: "" },
      policy: { validationIntervalHours: 24, gracePeriodDays: 14 },
      rateLimits: { loginPerMinute: 1000, clientPerMinute: 60 },
      corsOrigins: [],
    });
    const attempts = Array.from({ length: 70 }, (_, i) =>
      request(strictApp)
        .post("/api/v1/client/activate")
        .send({ licenseKey: `MDR-XXXX-XXXX-XXXX-${i}`, deviceId: `DEV-${i}-00001`, nonce: `nonce-rl-${i}pad` }),
    );
    const results = await Promise.all(attempts);
    expect(results.some((r) => r.status === 429)).toBe(true);
    const limited = results.find((r) => r.status === 429)!;
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    resetRateLimits();
  });

  it("responds with a stable error format for unknown public endpoints", async () => {
    const res = await http.get("/api/v2/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects malformed JSON bodies", async () => {
    const res = await http
      .post("/api/v1/client/activate")
      .set("Content-Type", "application/json")
      .send('{"licenseKey": broken');
    expect(res.status).toBe(400);
  });

  it("does not expose the private signing key anywhere public", async () => {
    const pk = await http.get("/api/v1/client/public-key");
    expect(pk.body.privateKey).toBeUndefined();
    expect(JSON.stringify(pk.body)).not.toMatch(/PRIVATE KEY/);

    const me = await (await authed()).Authorization;
    const settings = await http.get("/api/v1/settings/license-defaults").set("Authorization", me);
    expect(settings.status).toBe(200);
    expect(JSON.stringify(settings.body)).not.toMatch(/PRIVATE KEY/);
  });

  it("health endpoint reports database connectivity", async () => {
    const res = await http.get("/health");
    expect(res.status).toBe(200);
    expect(res.body.database).toBe("connected");
  });
});
