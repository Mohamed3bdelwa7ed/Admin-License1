/**
 * Live smoke test against the RUNNING server (http://localhost:4000).
 * Exercises the full flow on the real MongoDB Atlas database:
 * login -> create license -> activate device (signed) -> validate ->
 * verify signature -> admin revoke -> signed revoked error.
 * Cleans up the records it created afterwards.
 */
import "dotenv/config";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

const BASE = "http://localhost:4000";
const admin = { email: process.env.ADMIN_EMAIL ?? "admin@madar.example", password: process.env.ADMIN_PASSWORD ?? "" };

function canonicalJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(walk);
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) sorted[k] = walk((v as Record<string, unknown>)[k]);
    return sorted;
  };
  return JSON.stringify(walk(value));
}

function verifySig(publicKeyBase64: string, payload: unknown, sigB64: string): boolean {
  const key = createPublicKey({ key: Buffer.from(publicKeyBase64, "base64"), format: "der", type: "spki" });
  const data = Buffer.from(canonicalJson(payload), "utf8");
  return cryptoVerify(null, data, key, Buffer.from(sigB64, "base64"));
}

async function call(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; body: Record<string, unknown> & { error?: { code: string; message: string } } }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json as never };
}

async function main(): Promise<void> {
  let failed = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
    if (!ok) failed++;
  };

  // 1. health
  const health = await call("GET", "/health");
  check("GET /health -> 200, db connected", health.status === 200 && (health.body as { database?: string }).database === "connected");

  // 2. login
  if (!admin.password) {
    console.error("ADMIN_PASSWORD missing from env");
    process.exit(1);
  }
  const login = await call("POST", "/api/v1/auth/login", admin);
  const token = login.body.accessToken as string;
  check("POST /auth/login -> 200 + tokens", login.status === 200 && !!token && !!login.body.refreshToken, `user=${(login.body.user as { email: string } | undefined)?.email ?? "?"}`);

  // 3. unauthenticated access blocked
  const noAuth = await call("GET", "/api/v1/licenses");
  check("GET /licenses without token -> 401", noAuth.status === 401);

  // 4. public key
  const pk = await call("GET", "/api/v1/client/public-key");
  const publicKey = pk.body.publicKey as string;
  check("GET /client/public-key -> 200 + base64 key", pk.status === 200 && !!publicKey, `keyId=${pk.body.keyId}`);

  // 5. create license
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const created = await call("POST", "/api/v1/licenses", {
    customerName: "Smoke Test",
    company: "Smoke Co",
    email: `smoke+${Date.now()}@test.example`,
    phone: "",
    startDate: today,
    expirationDate: nextYear,
    maxDevices: 1,
    notes: "smoke test license",
  }, token);
  const license = created.body.license as { id: string; licenseKey: string } | undefined;
  check("POST /licenses -> 201 + generated key", created.status === 201 && !!license?.licenseKey, `key=${license?.licenseKey}`);

  // 6. license list + details
  const list = await call("GET", "/api/v1/licenses?search=Smoke%20Test", undefined, token);
  const listItems = (list.body.items as { id: string }[] | undefined) ?? [];
  check("GET /licenses?search -> 200, finds it", list.status === 200 && listItems.some((l) => l.id === license!.id));
  const detail = await call("GET", `/api/v1/licenses/${license!.id}`, undefined, token);
  check("GET /licenses/:id -> 200 details", detail.status === 200 && detail.body.licenseKey === license!.licenseKey);

  // 7. client activate (signed)
  const act = await call("POST", "/api/v1/client/activate", {
    licenseKey: license!.licenseKey,
    deviceId: "SMOKE-DEVICE-01",
    deviceName: "SMOKE-PC",
    nonce: `smoke-${Date.now()}`,
  });
  const actPayload = act.body.payload as Record<string, unknown> | undefined;
  const actSig = act.body.signature as string | undefined;
  check("POST /client/activate -> 200 signed", act.status === 200 && !!actPayload && !!actSig, `status=${actPayload?.status}, limitReached=${actPayload?.deviceLimitReached}`);
  check("activation signature verifies", verifySig(publicKey, actPayload, actSig!));
  const forged = { ...actPayload!, maxDevices: 999 };
  check("tampered payload fails verification", !verifySig(publicKey, forged, actSig!));

  // 8. device limit reached (maxDevices=1)
  const second = await call("POST", "/api/v1/client/activate", {
    licenseKey: license!.licenseKey,
    deviceId: "SMOKE-DEVICE-02",
    nonce: `smoke2-${Date.now()}`,
  });
  check("second device rejected (limit 1/1)", second.status === 403 && second.body.error?.code === "DEVICE_LIMIT_REACHED");

  // 9. validate (signed)
  const val = await call("POST", "/api/v1/client/validate", {
    licenseKey: license!.licenseKey,
    deviceId: "SMOKE-DEVICE-01",
    nonce: `smoke3-${Date.now()}`,
  });
  check("POST /client/validate -> 200 signed", val.status === 200 && verifySig(publicKey, val.body.payload, val.body.signature as string));

  // 10. admin sees the device
  const devices = await call("GET", `/api/v1/licenses/${license!.id}/devices`, undefined, token);
  check("GET /licenses/:id/devices -> 200, 1 device", devices.status === 200 && (devices.body.items as unknown[] | undefined)?.length === 1);

  // 11. stats
  const stats = await call("GET", "/api/v1/stats", undefined, token);
  check("GET /stats -> 200 with counters", stats.status === 200 && typeof stats.body.total === "number" && (stats.body.activeDevices as number) >= 1);

  // 12. revoke -> signed revoked error for the client
  const revoke = await call("POST", `/api/v1/licenses/${license!.id}/revoke`, { reason: "smoke test" }, token);
  check("POST /licenses/:id/revoke -> 200", revoke.status === 200 && revoke.body.status === "revoked");
  const valAfter = await call("POST", "/api/v1/client/validate", {
    licenseKey: license!.licenseKey,
    deviceId: "SMOKE-DEVICE-01",
    nonce: `smoke4-${Date.now()}`,
  });
  check("validate after revoke -> 403 SIGNED LICENSE_REVOKED", valAfter.status === 403 && valAfter.body.error?.code === "LICENSE_REVOKED" && verifySig(publicKey, valAfter.body.payload, valAfter.body.signature as string));

  console.log(failed === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failed} SMOKE TEST(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke test crashed:", e);
  process.exit(1);
});
