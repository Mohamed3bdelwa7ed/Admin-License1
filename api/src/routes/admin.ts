import type { z } from "zod";
import { Router, type Request, type Response } from "express";
import { Errors } from "../errors";
import { requireAuth, validateBody, validateQuery } from "../middleware/auth";
import {
  createLicenseSchema,
  deviceLimitSchema,
  licenseDefaultsSchema,
  licenseQuerySchema,
  renewSchema,
  revokeSchema,
} from "../schemas";
import { customersService, devicesService, licensesService } from "../services/licenses";
import { listEvents } from "../services/events";
import { getLicenseDefaults, saveLicenseDefaults } from "../services/settings";
import { Device, License } from "../models";
import { config as cfg } from "../config";

/**
 * Admin routes (JWT-protected). Response DTOs are camelCase and match the
 * React Admin frontend contract exactly.
 */

export interface AdminRouteDeps {
  jwtSecret: string;
}

export function adminRoutes(deps: AdminRouteDeps): Router {
  const router = Router();
  const auth = requireAuth({ jwtSecret: deps.jwtSecret });
  router.use(auth);

  const actor = (req: Request): string => req.user?.name ?? "Unknown";
  /** express types params as string | string[]; our routes always use plain strings */
  const p = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

  // ---- licenses ----
  router.get("/licenses", validateQuery(licenseQuerySchema), async (_req: Request, res: Response) => {
    const q = res.locals.query as z.infer<typeof licenseQuerySchema>;
    res.json(await licensesService.list(q));
  });

  router.post("/licenses", validateBody(createLicenseSchema), async (req: Request, res: Response) => {
    const { license, customerCreated } = await licensesService.create(req.body, actor(req));
    res.status(201).json({ license, customerCreated });
  });

  router.get("/licenses/:id", async (req: Request, res: Response) => {
    res.json(await licensesService.getById(p(req.params.id)));
  });

  router.post("/licenses/:id/revoke", validateBody(revokeSchema), async (req: Request, res: Response) => {
    res.json(await licensesService.revoke(p(req.params.id), (req.body as { reason: string }).reason, actor(req)));
  });

  router.post("/licenses/:id/reactivate", async (req: Request, res: Response) => {
    res.json(await licensesService.reactivate(p(req.params.id), actor(req)));
  });

  router.post("/licenses/:id/renew", validateBody(renewSchema), async (req: Request, res: Response) => {
    res.json(await licensesService.renew(p(req.params.id), (req.body as { expirationDate: string }).expirationDate, actor(req)));
  });

  router.post("/licenses/:id/device-limit", validateBody(deviceLimitSchema), async (req: Request, res: Response) => {
    res.json(await licensesService.setMaxDevices(p(req.params.id), (req.body as { maxDevices: number }).maxDevices, actor(req)));
  });

  router.get("/licenses/:id/devices", async (req: Request, res: Response) => {
    res.json({ items: await licensesService.devices(p(req.params.id)) });
  });

  router.delete("/licenses/:id/devices/:deviceId", async (req: Request, res: Response) => {
    await licensesService.deactivateDevice(p(req.params.id), p(req.params.deviceId), actor(req));
    res.status(204).end();
  });

  router.get("/licenses/:id/events", async (req: Request, res: Response) => {
    const license = await License.findOne({ stringId: p(req.params.id) });
    if (!license) throw Errors.licenseNotFound();
    res.json(await listEvents({ licenseId: license._id, limit: 100, offset: 0 }));
  });

  // ---- customers ----
  router.get("/customers", async (req: Request, res: Response) => {
    const search = p(req.query.search as string | string[] | undefined) || undefined;
    res.json({ items: await customersService.list(search) });
  });

  router.get("/customers/:id", async (req: Request, res: Response) => {
    res.json(await customersService.getById(p(req.params.id)));
  });

  // ---- devices ----
  router.get("/devices", async (req: Request, res: Response) => {
    const status = (p(req.query.status as string | string[] | undefined) as "all" | "active" | "deactivated" | undefined) ?? "all";
    const search = p(req.query.search as string | string[] | undefined) || undefined;
    res.json({ items: await devicesService.list({ search, status }) });
  });

  // ---- events ----
  router.get("/events", async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200);
    const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);
    const search = p(req.query.search as string | string[] | undefined) || undefined;
    res.json(await listEvents({ search, limit, offset }));
  });

  // ---- dashboard stats ----
  router.get("/stats", async (_req: Request, res: Response) => {
    const result = await licensesService.list({ page: 1, perPage: 1000, status: "all" });
    const all = result.items;
    const expiringSoon = all.filter(
      (l) =>
        l.status === "active" &&
        Math.ceil((new Date(`${l.expirationDate}T23:59:59.999Z`).getTime() - Date.now()) / 86_400_000) <= 30 &&
        Math.ceil((new Date(`${l.expirationDate}T23:59:59.999Z`).getTime() - Date.now()) / 86_400_000) >= 0,
    ).length;
    const activeDevices = await Device.countDocuments({ status: "active" });
    res.json({
      total: all.length,
      active: all.filter((l) => l.status === "active").length,
      expiringSoon,
      expired: all.filter((l) => l.status === "expired").length,
      revoked: all.filter((l) => l.status === "revoked").length,
      activeDevices,
    });
  });

  // ---- settings ----
  router.get("/settings/license-defaults", async (_req: Request, res: Response) => {
    res.json(
      await getLicenseDefaults({
        defaultDurationMonths: cfg.defaults.durationMonths,
        defaultMaxDevices: cfg.defaults.maxDevices,
        validationIntervalHours: cfg.defaults.validationIntervalHours,
        gracePeriodDays: cfg.defaults.gracePeriodDays,
      }),
    );
  });

  router.put("/settings/license-defaults", validateBody(licenseDefaultsSchema), async (req: Request, res: Response) => {
    res.json(await saveLicenseDefaults(req.body));
  });

  return router;
}
