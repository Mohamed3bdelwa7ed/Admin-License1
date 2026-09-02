import type { NextFunction, Request, Response } from "express";

/**
 * Simple in-memory fixed-window rate limiter (per IP + bucket name).
 * Sufficient for a single-instance deployment. For multi-instance
 * deployments replace with a shared store (e.g. Redis) — see docs.
 */

interface WindowState {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowState>();

// periodic cleanup so the map does not grow unbounded
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [k, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(k);
  }
}

export function rateLimit(options: { name: string; limitPerMinute: number }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    cleanup(now);

    const ip = req.ip ?? "unknown";
    const key = `${options.name}:${ip}`;
    const window = buckets.get(key);

    if (!window || window.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + 60_000 });
      return next();
    }

    window.count += 1;
    if (window.count > options.limitPerMinute) {
      const retryAfter = Math.ceil((window.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: `Too many requests. Try again in ${retryAfter}s`,
          details: { retryAfterSeconds: retryAfter },
        },
      });
      return;
    }
    next();
  };
}

/** Test helper: clear all rate-limit state. */
export function resetRateLimits(): void {
  buckets.clear();
}
