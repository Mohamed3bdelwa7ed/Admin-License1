/**
 * Demo data enrichment: activates devices through the real client API
 * (exactly like Madar POS would) and revokes one license, so the admin
 * dashboard shows a realistic mix of states.
 */
import "dotenv/config";

const BASE = "http://localhost:4000";

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const login = await call("POST", "/api/v1/auth/login", {
  email: process.env.ADMIN_EMAIL ?? "admin@madar.example",
  password: process.env.ADMIN_PASSWORD ?? "",
});
const token = login.body.accessToken as string;
if (!token) throw new Error(`login failed: ${JSON.stringify(login.body)}`);

const list = await call("GET", "/api/v1/licenses?perPage=50", undefined, token);
const items = list.body.items as { id: string; licenseKey: string; customerCompany: string; maxDevices: number }[];

const plan: Record<string, { devices: string[]; action?: "revoke" }> = {
  "Al Noor Store": { devices: ["ALNOOR-CASHIER-01", "ALNOOR-CASHIER-02"] },
  "Bloom Supermarket": { devices: ["BLOOM-POS-1", "BLOOM-POS-2"] },
  "Zaher Electronics": { devices: ["ZAHER-DESKTOP"] },
  "Saeed Pharma": { devices: ["SAEED-HQ-POS", "SAEED-BRANCH-1", "SAEED-BRANCH-2"] },
  "Ali Textiles": { devices: ["ALI-TEXTILE-01"], action: "revoke" },
};

const seen = new Set<string>();
let activated = 0;
let revoked = 0;

for (const lic of items) {
  if (seen.has(lic.customerCompany)) continue; // first license per customer only
  seen.add(lic.customerCompany);
  const p = plan[lic.customerCompany];
  if (!p) continue;

  for (let i = 0; i < Math.min(p.devices.length, lic.maxDevices); i++) {
    const r = await call("POST", "/api/v1/client/activate", {
      licenseKey: lic.licenseKey,
      deviceId: p.devices[i].replace(/[^A-Za-z0-9._-]/g, ""),
      deviceName: p.devices[i],
      nonce: `demo-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    });
    if (r.status === 200) activated++;
  }

  if (p.action === "revoke") {
    const r = await call("POST", `/api/v1/licenses/${lic.id}/revoke`, { reason: "Demo: chargeback dispute" }, token);
    if (r.status === 200) revoked++;
  }
}

console.log(`Activated ${activated} devices, revoked ${revoked} license.`);
console.log("Dashboard is now populated — open http://localhost:5173");
