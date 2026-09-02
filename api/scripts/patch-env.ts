import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync, randomUUID, randomBytes } from "node:crypto";

// Patches api/.env: fills JWT_SECRET + Ed25519 signing keys if missing/weak.
const path_ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");

const lines = fs.readFileSync(path_, "utf8").split(/\r?\n/);
const get = (k: string): string | undefined =>
  lines.find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1);

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicKeyBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const keyId = `kid-${randomUUID()}`;
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().trim();
const jwtSecret = randomBytes(48).toString("hex");

const weakJwt = get("JWT_SECRET");
const needsJwt = !weakJwt || weakJwt.length < 32;
const needsKeys = !get("LICENSE_SIGNING_PRIVATE_KEY") || !get("LICENSE_SIGNING_PUBLIC_KEY");

const out: string[] = [];
for (const line of lines) {
  if (needsJwt && line.startsWith("JWT_SECRET=")) {
    out.push(`JWT_SECRET=${jwtSecret}`);
  } else if (needsKeys && line.startsWith("LICENSE_SIGNING_PRIVATE_KEY=")) {
    out.push("LICENSE_SIGNING_PRIVATE_KEY=" + JSON.stringify(privateKeyPem));
  } else if (needsKeys && line.startsWith("LICENSE_SIGNING_PUBLIC_KEY=")) {
    out.push(`LICENSE_SIGNING_PUBLIC_KEY=${publicKeyBase64}`);
  } else if (needsKeys && line.startsWith("LICENSE_SIGNING_KEY_ID=")) {
    out.push(`LICENSE_SIGNING_KEY_ID=${keyId}`);
  } else {
    out.push(line);
  }
}
fs.writeFileSync(path_, out.join("\n"));
console.log(`Patched .env:`);
console.log(`  JWT_SECRET: ${needsJwt ? "generated (96 hex chars)" : "kept (already strong)"}`);
console.log(`  signing keys: ${needsKeys ? `generated, keyId=${keyId}` : "kept"}`);
console.log(`  Madar public key (base64): ${publicKeyBase64}`);
