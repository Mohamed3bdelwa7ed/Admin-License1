/** Removes smoke-test licenses/customers created by smoke-live.ts. */
import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo, disconnectMongo } from "../src/lib/mongo";
import { Customer, Device, License, LicenseEvent } from "../src/models";

const uri = process.env.MONGODB_URI ?? "";
await connectMongo(uri);

const smokeCustomers = await Customer.find({ email: /^smoke\+.*@test\.example$/ });
const ids = smokeCustomers.map((c) => c._id);
const licenses = await License.find({ customer: { $in: ids } });
const licenseIds = licenses.map((l) => l._id);
await Device.deleteMany({ license: { $in: licenseIds } });
await LicenseEvent.deleteMany({ license: { $in: licenseIds } });
await License.deleteMany({ _id: { $in: licenseIds } });
await Customer.deleteMany({ _id: { $in: ids } });
console.log(`Cleaned: ${ids.length} customers, ${licenseIds.length} licenses`);
void mongoose;
await disconnectMongo();
