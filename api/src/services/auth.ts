import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Errors } from "../errors";
import { nowISO, sha256, uuid } from "../lib/dates";
import { AdminUser, RefreshToken } from "../models";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const DUMMY_HASH = "$2a$10$C6UzMDM.H6dfI/f/IKcEeO7cOwZOE8vWKkHnOw6kS5VWkP0X7X2XK";

export interface AuthDeps {
  jwtSecret: string;
}

interface AdminUserDoc {
  _id: mongoose.Types.ObjectId;
  stringId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

function toApiUser(u: AdminUserDoc): ApiUser {
  return { id: u.stringId, email: u.email, name: u.name, role: u.role };
}

async function issueTokens(user: AdminUserDoc, jwtSecret: string): Promise<TokenPair> {
  const accessToken = signAccessToken(user, jwtSecret);
  const refreshToken = `${uuid()}.${sha256(uuid() + nowISO())}`;
  await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(refreshToken), // hashed at rest — raw token stored nowhere
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
  });
  return { accessToken, refreshToken };
}

export const authService = {
  async login(email: string, password: string, deps: AuthDeps): Promise<{ user: ApiUser; tokens: TokenPair }> {
    void deps;
    const user = (await AdminUser.findOne({ email }).lean()) as AdminUserDoc | null;
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const ok = bcrypt.compareSync(password, hash);
    if (!user || !ok) throw Errors.invalidCredentials();

    // one-time-use refresh tokens: revoke all previous
    await RefreshToken.deleteMany({ user: user._id });
    return { user: toApiUser(user), tokens: await issueTokens(user, deps.jwtSecret) };
  },

  async refresh(refreshToken: string, deps: AuthDeps): Promise<{ user: ApiUser; tokens: TokenPair }> {
    void deps;
    const doc = await RefreshToken.findOneAndDelete({ tokenHash: sha256(refreshToken) })
      .populate<{ user: AdminUserDoc }>("user");
    if (!doc || !doc.user) throw Errors.unauthorized("Invalid refresh token");
    if (doc.expiresAt.getTime() <= Date.now()) throw Errors.unauthorized("Refresh token expired");
    return { user: toApiUser(doc.user), tokens: await issueTokens(doc.user, deps.jwtSecret) };
  },

  async logout(refreshToken: string): Promise<void> {
    await RefreshToken.deleteOne({ tokenHash: sha256(refreshToken) });
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = (await AdminUser.findOne({ stringId: userId })) as (AdminUserDoc & { save(): Promise<unknown> }) | null;
    if (!user) throw Errors.notFound("Admin user not found");
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) throw Errors.invalidCredentials();
    user.passwordHash = bcrypt.hashSync(newPassword, 12);
    await user.save();
    // revoke all sessions
    await RefreshToken.deleteMany({ user: user._id });
  },

  async me(userId: string): Promise<ApiUser> {
    const user = (await AdminUser.findOne({ stringId: userId }).lean()) as AdminUserDoc | null;
    if (!user) throw Errors.unauthorized();
    return toApiUser(user);
  },
};

export async function upsertAdminUser(email: string, password: string, name: string, role: "admin" | "viewer" = "admin"): Promise<void> {
  const hash = bcrypt.hashSync(password, 12);
  await AdminUser.findOneAndUpdate(
    { email },
    { $set: { passwordHash: hash, name, role } },
    { upsert: true },
  );
}

// Access-token helpers: sign/verify with the single jwtSecret from config.
export function signAccessToken(user: AdminUserDoc, jwtSecret: string): string {
  return jwt.sign(
    { sub: user.stringId, email: user.email, name: user.name, role: user.role },
    jwtSecret,
    { expiresIn: ACCESS_TTL_SECONDS, algorithm: "HS256" },
  );
}

export function verifyAccessToken(token: string, jwtSecret: string): { sub: string; email: string; name: string; role: string } {
  return jwt.verify(token, jwtSecret, { algorithms: ["HS256"] }) as {
    sub: string;
    email: string;
    name: string;
    role: string;
  };
}
