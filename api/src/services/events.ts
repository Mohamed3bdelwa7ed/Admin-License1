import mongoose from "mongoose";
import { iso } from "../lib/dates";
import { LicenseEvent } from "../models";

export interface EventInput {
  type: string;
  license?: mongoose.Types.ObjectId | null;
  customer?: mongoose.Types.ObjectId | null;
  actor: string;
  message: string;
}

export async function recordEvent(input: EventInput): Promise<void> {
  await LicenseEvent.create({
    type: input.type,
    license: input.license ?? null,
    customer: input.customer ?? null,
    actor: input.actor,
    message: input.message,
  });
}

export interface EventDTO {
  id: string;
  type: string;
  licenseId: string | null;
  customerId: string | null;
  actor: string;
  message: string;
  createdAt: string;
  licenseKey: string | null;
  customerName: string | null;
}

export interface EventFilter {
  licenseId?: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  search?: string;
  limit: number;
  offset: number;
}

export async function listEvents(filter: EventFilter): Promise<{ items: EventDTO[]; total: number }> {
  const rx = filter.search
    ? new RegExp(filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : null;

  const match: Record<string, unknown> = {};
  if (filter.licenseId) match.license = filter.licenseId;
  if (filter.customerId) match.customer = filter.customerId;
  if (rx) match.$or = [{ message: rx }, { actor: rx }, { type: rx }];

  const total = await LicenseEvent.countDocuments(match);
  const rows = await LicenseEvent.find(match)
    .sort({ createdAt: -1 })
    .skip(filter.offset)
    .limit(filter.limit)
    .populate("license", "stringId key")
    .populate("customer", "stringId name");

  return {
    items: rows.map((e) => {
      const license = e.license as unknown as { stringId?: string; key?: string } | null;
      const customer = e.customer as unknown as { stringId?: string; name?: string } | null;
      return {
        id: e.stringId,
        type: e.type,
        licenseId: license?.stringId ?? null,
        customerId: customer?.stringId ?? null,
        actor: e.actor,
        message: e.message,
        createdAt: iso(e.createdAt),
        licenseKey: license?.key ?? null,
        customerName: customer?.name ?? null,
      };
    }),
    total,
  };
}
