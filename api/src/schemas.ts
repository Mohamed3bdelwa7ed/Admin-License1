import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(2000),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).max(2000),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export const licenseDefaultsSchema = z.object({
  defaultDurationMonths: z.number().int().min(1).max(60),
  defaultMaxDevices: z.number().int().min(1).max(50),
  validationIntervalHours: z.number().int().min(1).max(168),
  gracePeriodDays: z.number().int().min(0).max(90),
});

export const createLicenseSchema = z
  .object({
    customerName: z.string().trim().min(1).max(200),
    company: z.string().trim().max(200).default(""),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().max(50).default(""),
    startDate: dateString,
    expirationDate: dateString,
    maxDevices: z.number().int().min(1).max(50),
    notes: z.string().trim().max(2000).default(""),
  })
  .refine((v) => v.expirationDate > v.startDate, {
    message: "expirationDate must be after startDate",
    path: ["expirationDate"],
  });

export const revokeSchema = z.object({
  reason: z.string().trim().max(500).default(""),
});

export const renewSchema = z.object({
  expirationDate: dateString,
});

export const deviceLimitSchema = z.object({
  maxDevices: z.number().int().min(1).max(50),
});

const deviceIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/, "deviceId may contain letters, digits, dot, underscore, dash");

const nonceSchema = z
  .string()
  .trim()
  .min(8)
  .max(128);

export const activateSchema = z.object({
  licenseKey: z.string().trim().min(10).max(100),
  deviceId: deviceIdSchema,
  deviceName: z.string().trim().max(200).default(""),
  nonce: nonceSchema,
});

export const validateSchema = z.object({
  licenseKey: z.string().trim().min(10).max(100),
  deviceId: deviceIdSchema,
  nonce: nonceSchema,
});

export const deactivateSchema = z.object({
  licenseKey: z.string().trim().min(10).max(100),
  deviceId: deviceIdSchema,
  nonce: nonceSchema,
});

export const licenseQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "expired", "revoked", "suspended"]).default("all"),
  expiringWithin: z.coerce.number().int().min(1).max(365).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(8),
});
