import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { ApiError } from "./errors";
import { mongoHealth } from "./lib/mongo";
import { loadOrGenerateKeys } from "./crypto/signing";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { clientRoutes } from "./routes/client";
import { config } from "./config";

/**
 * Express app factory. Exported separately so tests can build the app
 * against an isolated MongoDB test database.
 */

export interface AppDeps {
  jwtSecret: string;
  signing: { privateKey: string; publicKey: string; keyId: string };
  policy: { validationIntervalHours: number; gracePeriodDays: number };
  rateLimits: { loginPerMinute: number; clientPerMinute: number };
  corsOrigins: string[];
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // for correct req.ip behind Render/Cloudflare
  app.use(express.json({ limit: "64kb" }));
  app.use(cors({ origin: deps.corsOrigins, credentials: false }));

  // ---- health ----
  app.get("/health", (_req: Request, res: Response) => {
    const db = mongoHealth();
    // do not expose host details in production
    res.status(db.connected ? 200 : 503).json({
      status: db.connected ? "ok" : "degraded",
      api: true,
      database: db.connected ? "connected" : "disconnected",
    });
  });

  const keys = loadOrGenerateKeys(deps.signing);

  app.use(
    "/api/v1/auth",
    authRoutes({
      jwtSecret: deps.jwtSecret,
      rateLimits: {
        loginPerMinute: deps.rateLimits.loginPerMinute,
        clientPerMinute: deps.rateLimits.clientPerMinute,
      },
    }),
  );
  // client (Madar) routes MUST be mounted before the admin catch-all at /api/v1
  app.use("/api/v1/client", clientRoutes(keys, deps.policy, { loginPerMinute: deps.rateLimits.loginPerMinute, clientPerMinute: deps.rateLimits.clientPerMinute }));
  app.use("/api/v1", adminRoutes({ jwtSecret: deps.jwtSecret }));

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Endpoint not found" } });
  });

  // central error handler — stable JSON error shape
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
      return;
    }
    // JSON body parse errors
    if (err instanceof SyntaxError && "status" in err && (err as { status: number }).status === 400) {
      res.status(400).json({ error: { code: "INVALID_INPUT", message: "Malformed JSON body" } });
      return;
    }
    console.error("[api] internal error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  });

  return app;
}

export function buildAppFromConfig(): Express {
  return createApp({
    jwtSecret: config.jwtSecret,
    signing: config.signing,
    policy: {
      validationIntervalHours: config.defaults.validationIntervalHours,
      gracePeriodDays: config.defaults.gracePeriodDays,
    },
    rateLimits: config.rateLimits,
    corsOrigins: config.corsOrigins,
  });
}
