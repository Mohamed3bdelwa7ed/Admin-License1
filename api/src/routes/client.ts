import { Router, type NextFunction, type Request, type Response } from "express";
import { ApiError } from "../errors";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/auth";
import { activateSchema, deactivateSchema, validateSchema } from "../schemas";
import { activationService, type ActivationDeps, type Policy, type SignedResponse } from "../services/activation";
import { signPayload } from "../crypto/signing";
import type { config } from "../config";

/**
 * Madar POS client endpoints. Public (no JWT) but rate limited per IP.
 * Success responses are signed Ed25519. License-state failures
 * (expired/revoked/suspended) return 403 with a SIGNED error payload so
 * the client can verify the verdict is authentic.
 */

export function clientRoutes(keys: ActivationDeps["keys"], policy: Policy, rateLimits: typeof config.rateLimits): Router {
  const router = Router();
  const limit = rateLimit({ name: "client", limitPerMinute: rateLimits.clientPerMinute });
  router.use(limit);

  // GET /api/v1/client/public-key — Ed25519 public key for response verification
  router.get("/public-key", (_req: Request, res: Response) => {
    res.json({
      keyId: keys.keyId,
      algorithm: "ed25519",
      publicKey: keys.publicKeyBase64, // base64 (raw 32-byte key)
    });
  });

  router.post("/activate", validateBody(activateSchema), asyncClient(keys, policy, (deps, body) =>
    activationService.activate(deps, body),
  ));

  router.post("/validate", validateBody(validateSchema), asyncClient(keys, policy, (deps, body) =>
    activationService.validate(deps, body),
  ));

  router.post("/deactivate", validateBody(deactivateSchema), asyncClient(keys, policy, (deps, body) =>
    activationService.deactivate(deps, body),
  ));

  return router;
}

type Handler = (
  deps: ActivationDeps,
  body: { licenseKey: string; deviceId: string; deviceName: string; nonce: string },
) => Promise<SignedResponse>;

function asyncClient(keys: ActivationDeps["keys"], policy: Policy, handler: Handler) {
  const deps: ActivationDeps = { keys, policy };
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(deps, req.body as Parameters<Handler>[1])
      .then((result) => res.status(200).json(result))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.signed) {
          // sign the license-state failure payload (same structure, status reflects the failure)
          const body = req.body as { licenseKey: string; deviceId: string; nonce: string };
          const payload = {
            type: "error",
            licenseKey: body.licenseKey ?? "",
            deviceId: body.deviceId ?? "",
            nonce: body.nonce ?? "",
            status: err.code
              .replace("LICENSE_", "")
              .toLowerCase(),
            reason: err.code,
            message: err.message,
            serverTime: new Date().toISOString(),
          };
          res.status(err.status).json({
            keyId: keys.keyId,
            algorithm: "ed25519",
            payload,
            signature: signPayload(keys, payload),
            error: { code: err.code, message: err.message },
          });
          return;
        }
        next(err);
      });
  };
}
