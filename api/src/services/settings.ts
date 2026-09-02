import { AppSetting } from "../models";

export interface LicenseDefaults {
  defaultDurationMonths: number;
  defaultMaxDevices: number;
  validationIntervalHours: number;
  gracePeriodDays: number;
}

const KEY = "license_defaults";

export async function getLicenseDefaults(fallback: LicenseDefaults): Promise<LicenseDefaults> {
  const row = await AppSetting.findOne({ key: KEY });
  if (!row) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(row.value) as Partial<LicenseDefaults>) };
  } catch {
    return fallback;
  }
}

export async function saveLicenseDefaults(defaults: LicenseDefaults): Promise<LicenseDefaults> {
  await AppSetting.findOneAndUpdate(
    { key: KEY },
    { $set: { value: JSON.stringify(defaults) } },
    { upsert: true },
  );
  return defaults;
}
