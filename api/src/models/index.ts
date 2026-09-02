import mongoose, { Schema, type Model } from "mongoose";
import { uuid } from "../lib/dates";

/**
 * Mongoose models for the License Admin system.
 * Design notes:
 *  - Entities stay independent (references, not embedding) — matches the
 *    existing domain model and keeps queries predictable.
 *  - `stringId` (UUID) mirrors the previous public IDs; `_id` is ObjectId.
 *  - Unique constraints from the old SQLite schema are preserved as
 *    MongoDB unique indexes.
 */

export interface IAdminUser {
  stringId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "viewer";
  createdAt: string;
  updatedAt: string;
}

const AdminUserSchema = new Schema<IAdminUser>(
  {
    stringId: { type: String, required: true, default: uuid },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "viewer"], default: "admin" },
  },
  {     timestamps: { currentTime: () => new Date() }, versionKey: false },
);
AdminUserSchema.index({ email: 1 }, { unique: true });
AdminUserSchema.index({ stringId: 1 }, { unique: true });

export const AdminUser: Model<IAdminUser> =
  (mongoose.models.AdminUser as Model<IAdminUser>) ??
  mongoose.model<IAdminUser>("AdminUser", AdminUserSchema);

export interface ICustomer {
  stringId: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    stringId: { type: String, required: true, default: uuid },
    name: { type: String, required: true },
    company: { type: String, default: "" },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
  },
  { timestamps: { currentTime: () => new Date() }, versionKey: false },
);
CustomerSchema.index({ email: 1 }, { unique: true });
CustomerSchema.index({ stringId: 1 }, { unique: true });
CustomerSchema.index({ name: 1 });

export const Customer: Model<ICustomer> =
  (mongoose.models.Customer as Model<ICustomer>) ??
  mongoose.model<ICustomer>("Customer", CustomerSchema);

export type LicenseStatus = "active" | "revoked" | "suspended";

export interface ILicense {
  stringId: string;
  key: string;
  customer: mongoose.Types.ObjectId;
  status: LicenseStatus;
  startDate: string; // YYYY-MM-DD
  expiresAt: string; // YYYY-MM-DD
  maxDevices: number;
  notes: string;
  revokedAt: string | null;
  revokedReason: string | null;
  /** count of active devices; maintained atomically to enforce maxDevices */
  activeSlots: number;
  createdAt: string;
  updatedAt: string;
}

const LicenseSchema = new Schema<ILicense>(
  {
    stringId: { type: String, required: true, default: uuid },
    key: { type: String, required: true, uppercase: true, trim: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    status: { type: String, enum: ["active", "revoked", "suspended"], default: "active" },
    startDate: { type: String, required: true },
    expiresAt: { type: String, required: true },
    maxDevices: { type: Number, required: true, min: 1 },
    notes: { type: String, default: "" },
    revokedAt: { type: String, default: null },
    revokedReason: { type: String, default: null },
    activeSlots: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { currentTime: () => new Date() }, versionKey: false },
);
LicenseSchema.index({ key: 1 }, { unique: true });
LicenseSchema.index({ stringId: 1 }, { unique: true });
LicenseSchema.index({ status: 1 });
LicenseSchema.index({ expiresAt: 1 });
LicenseSchema.index({ customer: 1, createdAt: -1 });

export type DeviceStatus = "active" | "deactivated";

export interface IDevice {
  stringId: string;
  license: mongoose.Types.ObjectId;
  deviceId: string; // hardware fingerprint from Madar POS
  deviceName: string;
  activatedAt: string;
  lastValidation: string | null;
  status: DeviceStatus;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const DeviceSchema = new Schema<IDevice>(
  {
    stringId: { type: String, required: true, default: uuid },
    license: { type: Schema.Types.ObjectId, ref: "License", required: true, index: true },
    deviceId: { type: String, required: true, trim: true },
    deviceName: { type: String, default: "" },
    activatedAt: { type: String, required: true },
    lastValidation: { type: String, default: null },
    status: { type: String, enum: ["active", "deactivated"], default: "active" },
    deactivatedAt: { type: String, default: null },
  },
  { timestamps: { currentTime: () => new Date() }, versionKey: false },
);
// one device entry per license+deviceId (device binding)
DeviceSchema.index({ license: 1, deviceId: 1 }, { unique: true });
DeviceSchema.index({ stringId: 1 }, { unique: true });
DeviceSchema.index({ license: 1, status: 1 });
DeviceSchema.index({ deviceId: 1 });

// cascade: deleting a license removes its devices.
// Registered BEFORE License model compilation (hooks added after are ignored).
LicenseSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (this: ILicense & { _id: mongoose.Types.ObjectId }) {
    const DeviceModel = (mongoose.models.Device ?? mongoose.model("Device", DeviceSchema)) as Model<IDevice>;
    await DeviceModel.deleteMany({ license: this._id });
  },
);

export const License: Model<ILicense> =
  (mongoose.models.License as Model<ILicense>) ??
  mongoose.model<ILicense>("License", LicenseSchema);

export const Device: Model<IDevice> =
  (mongoose.models.Device as Model<IDevice>) ??
  mongoose.model<IDevice>("Device", DeviceSchema);

export interface ILicenseEvent {
  stringId: string;
  type: string;
  license: mongoose.Types.ObjectId | null;
  customer: mongoose.Types.ObjectId | null;
  actor: string;
  message: string;
  createdAt: string;
}

const LicenseEventSchema = new Schema<ILicenseEvent>(
  {
    stringId: { type: String, required: true, default: uuid },
    type: { type: String, required: true },
    license: { type: Schema.Types.ObjectId, ref: "License", default: null },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    actor: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: { currentTime: () => new Date(), createdAt: true, updatedAt: false }, versionKey: false },
);
LicenseEventSchema.index({ stringId: 1 }, { unique: true });
LicenseEventSchema.index({ license: 1, createdAt: -1 });
LicenseEventSchema.index({ customer: 1 });
LicenseEventSchema.index({ createdAt: -1 });

export const LicenseEvent: Model<ILicenseEvent> =
  (mongoose.models.LicenseEvent as Model<ILicenseEvent>) ??
  mongoose.model<ILicenseEvent>("LicenseEvent", LicenseEventSchema);

export interface IRefreshToken {
  stringId: string;
  user: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: string;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    stringId: { type: String, required: true, default: uuid },
    user: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { currentTime: () => new Date(), createdAt: true, updatedAt: false }, versionKey: false },
);
RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
RefreshTokenSchema.index({ user: 1 });
// TTL index: Mongo auto-deletes expired refresh tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<IRefreshToken> =
  (mongoose.models.RefreshToken as Model<IRefreshToken>) ??
  mongoose.model<IRefreshToken>("RefreshToken", RefreshTokenSchema);

export interface IAppSetting {
  key: string;
  value: string;
}

const AppSettingSchema = new Schema<IAppSetting>(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
  },
  { versionKey: false },
);
AppSettingSchema.index({ key: 1 }, { unique: true });

export const AppSetting: Model<IAppSetting> =
  (mongoose.models.AppSetting as Model<IAppSetting>) ??
  mongoose.model<IAppSetting>("AppSetting", AppSettingSchema);

export async function ensureIndexes(): Promise<void> {
  await Promise.all([
    AdminUser.syncIndexes(),
    Customer.syncIndexes(),
    License.syncIndexes(),
    Device.syncIndexes(),
    LicenseEvent.syncIndexes(),
    RefreshToken.syncIndexes(),
    AppSetting.syncIndexes(),
  ]);
}

export function resetModelsForTest(): Promise<void> {
  const collections = [AdminUser, Customer, License, Device, LicenseEvent, RefreshToken, AppSetting];
  return Promise.all(
    collections.map((m) => mongoose.connection.dropCollection(m.collection.name).catch(() => undefined)),
  ) as unknown as Promise<void>;
}
