import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { findStaffByUsername, findStaffByEmail, findCustomerByEmail, findCustomerById, findProviderByEmail, updateCustomerLastLogin, getStoreSetting } from "./db";
import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";

interface JwtPayload {
  sub: number;
  username?: string;
  email?: string;
  name?: string;
  role: string;
  purpose?: string;
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
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-this-to-a-long-random-string" || secret === "your-secret-key-change-this-in-production" || secret === "dev-only-secret-change-for-production") {
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

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  const queryToken = String(req.query?.token || "");
  return queryToken || null;
}

function staffAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Staff login required." });
    return;
  }
  try {
    const user = verifyToken(token);
    if (user.role !== "admin" && user.role !== "owner" && user.role !== "technician") {
      res.status(403).json({ error: "Staff access only." });
      return;
    }
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Admin login required." });
    return;
  }
  try {
    const user = verifyToken(token);
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

function customerAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  try {
    const user = verifyToken(token);
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

async function loginStaff(login: string, password: string): Promise<AuthResult> {
  const isEmail = login.includes("@");
  let user = isEmail ? findStaffByEmail(login) as StaffUser | undefined : findStaffByUsername(login) as StaffUser | undefined;
  // Fallback: try username lookup for email input, or email lookup for username input
  if (!user) {
    user = isEmail ? findStaffByUsername(login) as StaffUser | undefined : findStaffByEmail(login + "@gearandglitch.com") as StaffUser | undefined;
  }
  if (!user) {
    return { ok: false, error: "Invalid username/email or password." };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { ok: false, error: "Invalid username/email or password." };
  }

  const role = user.role || "admin";
  const userEmail = (user as any).email || `${user.username}@gearandglitch.com`;
  const token = signToken({ sub: user.id, username: user.username, email: userEmail, role });
  return { ok: true, token, username: user.username, email: userEmail, role };
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
  if (findCustomerByEmail(trimmedEmail)) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const customer = createCustomer(trimmedName, trimmedEmail, password) as CustomerUser;
  const token = signToken({
    sub: customer.id,
    email: customer.email,
    name: customer.name,
    role: "customer",
  }, "7d");
  return { ok: true, token, name: customer.name, email: customer.email, role: "customer" };
}

async function loginCustomer(email: string, password: string): Promise<AuthResult> {
  const customer = findCustomerByEmail(String(email || "").trim().toLowerCase()) as CustomerUser | undefined;
  if (!customer) {
    return { ok: false, error: "Invalid email or password." };
  }

  const match = await bcrypt.compare(password, customer.password_hash);
  if (!match) {
    return { ok: false, error: "Invalid email or password." };
  }

  const token = signToken({
    sub: customer.id,
    email: customer.email,
    name: customer.name,
    role: "customer",
  }, "7d");
  return { ok: true, token, name: customer.name, email: customer.email, role: "customer" };
}

function providerAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Provider login required." });
    return;
  }
  try {
    const user = verifyToken(token);
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
  const provider = findProviderByEmail(String(email || "").trim().toLowerCase()) as any;
  if (!provider) {
    return { ok: false, error: "Invalid email or password." };
  }
  const match = await bcrypt.compare(password, provider.password_hash);
  if (!match) {
    return { ok: false, error: "Invalid email or password." };
  }
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
  const clientId = getStoreSetting("google_client_id") || process.env.GOOGLE_CLIENT_ID || "";
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

    let customer = findCustomerByEmail(email);
    if (!customer) {
      const { createCustomer } = require("./db");
      const randomPass = crypto.randomBytes(16).toString("hex");
      customer = createCustomer(name, email, randomPass);
      if (!customer) {
        return { ok: false, error: "Failed to create account." };
      }
    }

    updateCustomerLastLogin(customer.id);

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

function ownerAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) { res.status(401).json({ error: "Login required." }); return; }
  try {
    const user = verifyToken(token);
    if (user.role !== "admin" && user.role !== "owner") { res.status(403).json({ error: "Access restricted to admin or owner." }); return; }
    (req as any).user = user;
    next();
  } catch { res.status(401).json({ error: "Session expired. Please log in again." }); }
}

export {
  adminAuthMiddleware,
  ownerAuthMiddleware,
  staffAuthMiddleware,
  customerAuthMiddleware,
  providerAuthMiddleware,
  loginStaff,
  loginCustomer,
  registerCustomer,
  loginProvider,
  googleLogin,
  signToken,
  verifyToken,
  getBearerToken,
};
