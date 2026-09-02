import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomUUID,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";

/**
 * Ed25519 signing keys. The PRIVATE key never leaves the server process
 * (loaded from env). The PUBLIC key is served to Madar POS via
 * GET /api/v1/client/public-key so it can verify signed responses.
 */

export interface SigningKeys {
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** raw 32-byte public key, base64 (what clients verify with) */
  publicKeyBase64: string;
  keyId: string;
}

function toBase64(key: KeyObject): string {
  // full SPKI DER (includes the Ed25519 OID header), base64 — clients can
  // load this directly or use the raw key bytes from the tail if they prefer
  return key.export({ format: "der", type: "spki" }).toString("base64");
}

export function loadOrGenerateKeys(signing: {
  privateKey: string;
  publicKey: string;
  keyId: string;
}): SigningKeys {
  if (signing.privateKey && signing.publicKey) {
    const privateKey = createPrivateKey(signing.privateKey);
    const publicKey = signing.publicKey.startsWith("-----")
      ? createPublicKey(signing.publicKey)
      : createPublicKey({ key: Buffer.from(signing.publicKey, "base64"), format: "der", type: "spki" });
    return {
      privateKey,
      publicKey,
      publicKeyBase64: toBase64(publicKey),
      keyId: signing.keyId || "key-1",
    };
  }
  // development convenience: ephemeral keys (never rely on this in production)
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey,
    publicKey,
    publicKeyBase64: toBase64(publicKey),
    keyId: signing.keyId || `ephemeral-${randomUUID().slice(0, 8)}`,
  };
}

export function generateKeypair(): {
  privateKeyPem: string;
  publicKeyPem: string;
  publicKeyBase64: string;
  keyId: string;
} {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    publicKeyBase64: toBase64(publicKey),
    keyId: `kid-${randomUUID()}`,
  };
}

/** Canonical JSON: object keys sorted recursively, no whitespace, UTF-8. */
export function canonicalJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(walk);
    const obj = v as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) sorted[k] = walk(obj[k]);
    return sorted;
  };
  return JSON.stringify(walk(value));
}

export function signPayload(
  keys: SigningKeys,
  payload: Record<string, unknown>,
): string {
  const data = Buffer.from(canonicalJson(payload), "utf8");
  return sign(null, data, keys.privateKey).toString("base64");
}

export function verifySignature(
  publicKeyBase64: string,
  payload: Record<string, unknown>,
  signatureBase64: string,
): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      format: "der",
      type: "spki",
    });
    const data = Buffer.from(canonicalJson(payload), "utf8");
    return verify(null, data, key, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}
