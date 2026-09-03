import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { generateSecret, generateSync, verifySync } from "otplib";
import { generateTOTP } from "@otplib/uri";
import { findStaffByUsername, findStaffByEmail, findCustomerByEmail, findCustomerById, findProviderByEmail, updateCustomerLastLogin, getStoreSetting, getUserTotp, getPasswordChangedAt } from "./db";
import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";

// Per-account lockout with exponential backoff (A-2). In-memory, keyed by the
// normalized login identifier, so it resets on process restart (acceptable given
// the complementary per-IP auth rate limit). Throttles brute-force attempts that
// target one account from anywhere, without locking out unrelated users.
const MAX_ATTEMPTS = 5;
const BASE_LOCK_MS = 60 * 1000; // 1 minute, doubling each escalation
const FAILURE_WINDOW_MS = 15 * 60 * 1000; // failures older than 15min don't count
const loginFailures = new Map<string, { count: number; firstAt: number }>();

function clearLoginFailures(login: string): void { loginFailures.delete(normalizeLogin(login)); }

export function normalizeLogin(login: string): string { return String(login || "").trim().toLowerCase(); }

/** Returns remaining lockout ms if locked out (0 = not locked out). */
function accountLockoutMs(login: string): number {
  const key = normalizeLogin(login);
  const rec = loginFailures.get(key);
  if (!rec) return 0;
  const windowStart = Date.now() - FAILURE_WINDOW_MS;
  if (rec.firstAt < windowStart) { loginFailures.delete(key); return 0; }
  if (rec.count < MAX_ATTEMPTS) return 0;
  // Lock duration doubles per attempt past the threshold (capped at 30 min).
  const extra = Math.max(0, rec.count - MAX_ATTEMPTS);
  const lockMs = Math.min(BASE_LOCK_MS * Math.pow(2, extra), 30 * 60 * 1000);
  return lockMs;
}

function recordFailedLogin(login: string): number {
  const key = normalizeLogin(login);
  const now = Date.now();
  const windowStart = now - FAILURE_WINDOW_MS;
  let rec = loginFailures.get(key);
  if (!rec || rec.firstAt < windowStart) rec = { count: 0, firstAt: now };
  rec.count += 1;
  loginFailures.set(key, rec);
  return rec.count;
}

function isAccountLocked(login: string): boolean {
  return accountLockoutMs(login) > 0;
}

interface JwtPayload {
  sub: number;
  username?: string;
  email?: string;
  name?: string;
  role: string;
  purpose?: string;
  permissions?: string[];
  jti?: string;
  iat?: number;
}

interface StaffUser {
  id: number;
  username: string;
  password_hash: string;
  role: string;
}

interface CustomerUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  token?: string;
  username?: string;
  name?: string;
  email?: string;
  role?: string;
  totpRequired?: boolean;
  permissions?: string[];
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-this-to-a-long-random-string" || secret === "your-secret-key-change-this-in-production" || secret === "dev-only-secret-change-for-production" || secret === "gl-jwt-2024-secure-random-key-xK9mPq") {
    throw new Error("Set a strong JWT_SECRET in .env before running the server.");
  }
  return secret;
}

function signToken(payload: object, expiresIn: string = "24h"): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
}

function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as unknown as JwtPayload;
}

// A-1: reject any session token issued before the account's last password
// rotation. Reuses the existing password_changed_at infrastructure (users and
// customers); providers have no such column so they are unaffected. iat is epoch
// seconds, changedAt is a PG timestamp string.
async function verifySessionToken(token: string): Promise<JwtPayload> {
  const payload = verifyToken(token);
  const changedAt = await getPasswordChangedAt(payload.role, payload.sub);
  if (changedAt && payload.iat) {
    const changedSec = Math.floor(Date.parse(String(changedAt)) / 1000);
    if (payload.iat < changedSec) throw new Error("session rotated");
  }
  return payload;
}

// A-1: session token lives in an httpOnly, same-site cookie so it is never
// readable by JavaScript (XSS cannot exfiltrate it). We still accept the legacy
// Authorization: Bearer header (and opt-in query token) so existing clients,
// receipts, and the control-plane flow keep working during rollout.
export const SESSION_COOKIE = "gg_session";

function setSessionCookie(res: Response, token: string, maxAgeSec = 7 * 24 * 3600): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec * 1000,
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  // A-1: fall back to the httpOnly session cookie when no Authorization header.
  const fromCookie = typeof req.cookies?.[SESSION_COOKIE] === "string" ? req.cookies[SESSION_COOKIE] : null;
  if (fromCookie) return fromCookie;
  // Opt-in query token for opening protected pages/receipts in a new tab.
  if (req.query?.allowQueryToken === "1" && typeof req.query?.token === "string" && req.query.token) {
    return req.query.token;
  }
  return null;
}

async function staffAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Staff login required." });
    return;
  }
  try {
    const user = await verifySessionToken(token);
    const isStaff = user.role === "admin" || user.role === "owner" || user.role === "technician" || user.role === "manager" || user.role === "staff" || (user.role === "provider" && Array.isArray(user.permissions));
    if (!isStaff) {
      res.status(403).json({ error: "Staff access only." });
      return;
    }
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

async function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Admin login required." });
    return;
  }
  try {
    const user = await verifySessionToken(token);
    if (user.role !== "admin") {
      res.status(403).json({ error: "Admin access only." });
      return;
    }
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

async function customerAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  try {
    const user = await verifySessionToken(token);
    if (user.role !== "customer") {
      res.status(403).json({ error: "Customer account required." });
      return;
    }
    (req as any).customer = user;
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

async function loginStaff(login: string, password: string, totpCode?: string): Promise<AuthResult> {
  if (isAccountLocked(login)) return { ok: false, error: "Too many failed attempts. Try again later." };
  const isEmail = login.includes("@");
  let user = isEmail ? await findStaffByEmail(login) as StaffUser | undefined : await findStaffByUsername(login) as StaffUser | undefined;
  if (!user) {
    user = isEmail ? await findStaffByUsername(login) as StaffUser | undefined : await findStaffByEmail(login + "@gearandglitch.com") as StaffUser | undefined;
  }
  if (!user) {
    await bcrypt.compare(password, "$2a$10$xJwAL3vGpAe8xK9mPqRs7uKj2LmN4OpQ5RtY6UiO8AsD9FgH1JkLz");
    recordFailedLogin(login);
    return { ok: false, error: "Invalid username/email or password." };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    recordFailedLogin(login);
    return { ok: false, error: "Invalid username/email or password." };
  }

  // Check 2FA
  const totp = await getUserTotp(user.id);
  if (totp.totpEnabled) {
    if (!totpCode) {
      return { ok: false, error: "2FA required", totpRequired: true };
    }
    if (!verifyTotp(totp.totpSecret, totpCode)) {
      recordFailedLogin(login);
      return { ok: false, error: "Invalid 2FA code." };
    }
  }

  clearLoginFailures(login);
  const role = user.role || "technician";
  const userEmail = (user as any).email || `${user.username}@gearandglitch.com`;
  const { getUserPermissions } = require("./permissions");
  const permissions = await getUserPermissions(user.id);
  const token = signToken({ sub: user.id, username: user.username, email: userEmail, role, permissions });
  return { ok: true, token, username: user.username, email: userEmail, role, permissions };
}

async function registerCustomer({ name, email, password }: { name: string; email: string; password: string }): Promise<AuthResult> {
  const { createCustomer } = require("./db");
  const trimmedEmail = String(email || "").trim().toLowerCase();
  const trimmedName = String(name || "").trim();

  if (!trimmedName || !trimmedEmail || !password) {
    return { ok: false, error: "Name, email, and password are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (await findCustomerByEmail(trimmedEmail)) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const customer = await createCustomer({ name: trimmedName, email: trimmedEmail, password }) as CustomerUser;
  const token = signToken({
    sub: customer.id,
    email: customer.email,
    name: customer.name,
    role: "customer",
  }, "7d");
  return { ok: true, token, name: customer.name, email: customer.email, role: "customer" };
}

async function loginCustomer(email: string, password: string): Promise<AuthResult> {
  if (isAccountLocked(email)) return { ok: false, error: "Too many failed attempts. Try again later." };
  const customer = await findCustomerByEmail(String(email || "").trim().toLowerCase()) as CustomerUser | undefined;
  if (!customer) {
    await bcrypt.compare(password, "$2a$10$xJwAL3vGpAe8xK9mPqRs7uKj2LmN4OpQ5RtY6UiO8AsD9FgH1JkLz");
    recordFailedLogin(email);
    return { ok: false, error: "Invalid email or password." };
  }

  const match = await bcrypt.compare(password, customer.password_hash);
  if (!match) {
    recordFailedLogin(email);
    return { ok: false, error: "Invalid email or password." };
  }

  clearLoginFailures(email);
  const token = signToken({
    sub: customer.id,
    email: customer.email,
    name: customer.name,
    role: "customer",
  }, "7d");
  return { ok: true, token, name: customer.name, email: customer.email, role: "customer" };
}

async function providerAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Provider login required." });
    return;
  }
  try {
    const user = await verifySessionToken(token);
    if (user.role !== "provider") {
      res.status(403).json({ error: "Provider access only." });
      return;
    }
    (req as any).provider = user;
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

async function loginProvider(email: string, password: string): Promise<AuthResult> {
  if (isAccountLocked(email)) return { ok: false, error: "Too many failed attempts. Try again later." };
  const provider = await findProviderByEmail(String(email || "").trim().toLowerCase()) as any;
  if (!provider) {
    await bcrypt.compare(password, "$2a$10$xJwAL3vGpAe8xK9mPqRs7uKj2LmN4OpQ5RtY6UiO8AsD9FgH1JkLz");
    recordFailedLogin(email);
    return { ok: false, error: "Invalid email or password." };
  }
  const match = await bcrypt.compare(password, provider.password_hash);
  if (!match) {
    recordFailedLogin(email);
    return { ok: false, error: "Invalid email or password." };
  }
  clearLoginFailures(email);
  const token = signToken({
    sub: provider.id,
    email: provider.email,
    name: provider.contact_name,
    companyName: provider.company_name,
    role: "provider",
  });
  return { ok: true, token, name: provider.contact_name, email: provider.email, role: "provider" };
}

async function googleLogin(googleToken: string): Promise<AuthResult> {
  const clientId = (await getStoreSetting("google_client_id")) || process.env.GOOGLE_CLIENT_ID || "";
  if (!clientId) {
    return { ok: false, error: "Google login is not configured." };
  }
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: googleToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return { ok: false, error: "Google token missing email." };
    }
    const email = payload.email.toLowerCase();
    const name = payload.name || email.split("@")[0];

    let customer = await findCustomerByEmail(email);
    if (!customer) {
      const { createCustomer } = require("./db");
      const randomPass = crypto.randomBytes(16).toString("hex");
      customer = await createCustomer({ name, email, password: randomPass });
      if (!customer) {
        return { ok: false, error: "Failed to create account." };
      }
    }

    await updateCustomerLastLogin(customer.id);

    const token = signToken({
      sub: customer.id,
      email: customer.email,
      name: customer.name,
      role: "customer",
    }, "7d");
    return { ok: true, token, name: customer.name, email: customer.email, role: "customer" };
  } catch (err: any) {
    return { ok: false, error: err.message || "Google login failed." };
  }
}

async function ownerAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  if (!token) { res.status(401).json({ error: "Login required." }); return; }
  try {
    const user = await verifySessionToken(token);
    const isOwnerRole = user.role === "admin" || user.role === "owner" || user.role === "manager" || (user.role === "provider" && Array.isArray(user.permissions));
    if (!isOwnerRole) { res.status(403).json({ error: "Access restricted to admin, owner, or manager." }); return; }
    (req as any).user = user;
    next();
  } catch { res.status(401).json({ error: "Session expired. Please log in again." }); }
}

async function posAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  if (!token) { res.status(401).json({ error: "Login required." }); return; }
  try {
    const user = await verifySessionToken(token);
    if (user.role !== "admin" && user.role !== "owner" && user.role !== "technician" && user.role !== "manager" && user.role !== "provider" && user.role !== "staff") {
      res.status(403).json({ error: "Access restricted." }); return;
    }
    (req as any).user = user;
    next();
  } catch { res.status(401).json({ error: "Session expired. Please log in again." }); }
}

// ─── Control-plane machine-to-machine auth ──────────────────────────
// The control plane authenticates with a per-tenant shared secret sent in
// the x-control-plane-key header. The secret is provisioned as the
// CONTROL_PLANE_SECRET env var on each client backend.

const CP_SECRET_MIN_LENGTH = 16;

function isControlPlaneRequest(req: Request): boolean {
  const secret = process.env.CONTROL_PLANE_SECRET || "";
  if (secret.length < CP_SECRET_MIN_LENGTH) return false;
  const provided = req.headers["x-control-plane-key"];
  if (typeof provided !== "string" || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function setControlPlaneUser(req: Request): void {
  (req as any).user = { sub: 0, username: "control-plane", role: "admin" };
}

// Only the control plane may access the route. Routes guarded by this are
// disabled entirely when CONTROL_PLANE_SECRET is not configured.
function controlPlaneAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.CONTROL_PLANE_SECRET || "";
  if (secret.length < CP_SECRET_MIN_LENGTH) {
    res.status(403).json({ error: "Control plane access is not configured on this server." });
    return;
  }
  if (!isControlPlaneRequest(req)) {
    res.status(401).json({ error: "Invalid control plane key." });
    return;
  }
  setControlPlaneUser(req);
  next();
}

// Wraps an existing auth middleware, additionally allowing control-plane requests.
function allowControlPlane(middleware: (req: Request, res: Response, next: NextFunction) => void) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (isControlPlaneRequest(req)) {
      setControlPlaneUser(req);
      next();
      return;
    }
    middleware(req, res, next);
  };
}

function generateTotpSecret(username: string): { secret: string; otpauthUrl: string } {
  const secret = generateSecret();
  const otpauthUrl = generateTOTP({ issuer: "Gear&Glitch", label: username, secret });
  return { secret, otpauthUrl };
}

function verifyTotp(secret: string, token: string): boolean {
  try {
    const result = verifySync({ token, secret });
    return result?.valid === true;
  } catch {
    return false;
  }
}

export {
  adminAuthMiddleware,
  ownerAuthMiddleware,
  staffAuthMiddleware,
  customerAuthMiddleware,
  providerAuthMiddleware,
  posAuthMiddleware,
  controlPlaneAuthMiddleware,
  allowControlPlane,
  isControlPlaneRequest,
  loginStaff,
  loginCustomer,
  registerCustomer,
  loginProvider,
  googleLogin,
  signToken,
  verifyToken,
  getBearerToken,
  setSessionCookie,
  clearSessionCookie,
  generateTotpSecret,
  verifyTotp,
};
