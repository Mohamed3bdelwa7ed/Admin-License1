import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Errors } from "../errors";
import type { z } from "zod";
import type { ApiUser } from "../services/auth";

/**
 * Admin authentication middleware. Veries the bearer JWT issued by
 * /api/v1/auth/login. Client (Madar) endpoints do NOT use this — they
 * authenticate by licenseKey + deviceId and get signed responses.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: ApiUser;
    }
  }
}

export interface AuthDeps {
  jwtSecret: string;
}

export function requireAuth(deps: AuthDeps) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      next(Errors.unauthorized("Missing bearer token"));
      return;
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, deps.jwtSecret, { algorithms: ["HS256"] }) as {
        sub: string;
        email: string;
        name: string;
        role: string;
      };
      req.user = { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
      next();
    } catch {
      next(Errors.unauthorized("Invalid or expired token"));
    }
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(Errors.unauthorized());
    return;
  }
  if (req.user.role !== "admin") {
    next(Errors.forbidden("Admin role required"));
    return;
  }
  next();
}

/** Zod body validation middleware. */
export function validateBody<S extends z.ZodType>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        Errors.invalidInput("Invalid request body", result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }))),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Zod query validation middleware. Parsed data lands in res.locals.query. */
export function validateQuery<S extends z.ZodType>(schema: S) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(
        Errors.invalidInput("Invalid query parameters", result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }))),
      );
      return;
    }
    // Express 5 req.query is getter-only; pass parsed values via res.locals
    res.locals = res.locals ?? {};
    res.locals.query = result.data;
    next();
  };
}
