import { generateKeypair } from "../src/crypto/signing";

/**
 * Generates an Ed25519 keypair for signing client (Madar) responses.
 * Copy the printed values into the server environment (Render env vars
 * or api/.env). The PRIVATE key must never reach React, Madar, Git, or
 * MongoDB.
 */

const kp = generateKeypair();
const jwtSecret = (
  await import("node:crypto")
).randomBytes(48).toString("hex");

console.log(`
Add the following to api/.env (local) or the Render environment (production):

LICENSE_SIGNING_PRIVATE_KEY=
${kp.privateKeyPem.trim().replace(/\n/g, "\n")}

LICENSE_SIGNING_PUBLIC_KEY=${kp.publicKeyBase64}

LICENSE_SIGNING_KEY_ID=${kp.keyId}

JWT_SECRET=${jwtSecret}

# Madar POS needs only these two values (public!):
#   keyId:    ${kp.keyId}
#   publicKey (base64): ${kp.publicKeyBase64}
`);
