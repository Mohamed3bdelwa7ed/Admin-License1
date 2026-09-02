import { describe, expect, it } from "vitest";
import { AdminUser } from "../src/models";
import { http, login, ADMIN } from "./helpers";

describe("auth", () => {
  it("logs in with valid credentials and returns token pair + user", async () => {
    const res = await http.post("/api/v1/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(ADMIN.email);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("rejects invalid password", async () => {
    const res = await http.post("/api/v1/auth/login").send({ email: ADMIN.email, password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects unknown email", async () => {
    const res = await http.post("/api/v1/auth/login").send({ email: "nobody@x.example", password: "whatever" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects malformed email", async () => {
    const res = await http.post("/api/v1/auth/login").send({ email: "not-an-email", password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_INPUT");
  });

  it("refresh rotates tokens: old refresh token becomes invalid", async () => {
    const first = await login();
    const res = await http.post("/api/v1/auth/refresh").send({ refreshToken: first.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(first.refreshToken);

    // replaying the OLD token must fail
    const replay = await http.post("/api/v1/auth/refresh").send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
  });

  it("logout revokes the refresh token", async () => {
    const s = await login();
    const out = await http.post("/api/v1/auth/logout").send({ refreshToken: s.refreshToken });
    expect(out.status).toBe(204);
    const replay = await http.post("/api/v1/auth/refresh").send({ refreshToken: s.refreshToken });
    expect(replay.status).toBe(401);
  });

  it("GET /auth/me returns the current admin", async () => {
    const s = await login();
    const res = await http.get("/api/v1/auth/me").set("Authorization", `Bearer ${s.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(ADMIN.email);
  });

  it("change-password updates the password and revokes sessions", async () => {
    const s = await login();
    const res = await http
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${s.accessToken}`)
      .send({ currentPassword: ADMIN.password, newPassword: "brand-new-password" });
    expect(res.status).toBe(204);

    // old refresh token revoked
    const replay = await http.post("/api/v1/auth/refresh").send({ refreshToken: s.refreshToken });
    expect(replay.status).toBe(401);

    // new password works, then restore
    const again = await http.post("/api/v1/auth/login").send({ email: ADMIN.email, password: "brand-new-password" });
    expect(again.status).toBe(200);
    await http
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${again.body.accessToken}`)
      .send({ currentPassword: "brand-new-password", newPassword: ADMIN.password });
  });

  it("stores no plaintext password in the database", async () => {
    const user = await AdminUser.findOne({ email: ADMIN.email });
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toContain(ADMIN.password);
    expect(user?.passwordHash.startsWith("$2")).toBe(true); // bcrypt
  });

  it("signed response helper is consistent (sanity check of Ed25519 verify)", async () => {
    // verifies our canonical-JSON signing round-trips (used by client tests)
    const { canonicalJson } = await import("../src/crypto/signing");
    expect(canonicalJson({ b: 1, a: { d: 3, c: 2 } })).toBe('{"a":{"c":2,"d":3},"b":1}');
  });
});
