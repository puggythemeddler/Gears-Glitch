import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import {
  normalizePhone,
  isValidKenyanPhone,
  isWithin24Hours,
  buildWhatsAppSignature,
  signaturesMatch,
  verifyWhatsAppSignature,
  handleWhatsAppWebhook,
  whatsAppWebhookHttpStatus,
  type WhatsAppWebhookResult,
} from "../server/whatsapp";
import { getPool, query, queryOne, runSchema } from "../server/db-helpers";
import {
  claimWebhookEvent,
  completeWebhookClaim,
  failWebhookClaim,
  WEBHOOK_LEASE_SECONDS,
} from "../server/integrations-store";

// DB-backed webhook-ledger checks. These tests MUST run against a disposable,
// explicitly configured test database. The suite will refuse to run if the
// database target is unsafe (e.g. appears to be production/Neon) or cannot be
// validated.
function isUnsafeTestDbUrl(url: string | undefined): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  // Common production indicators
  if (u.includes("neon.tech")) return true;
  if (u.includes("prod")) return true;
  if (u.includes("production")) return true;
  if (u.includes("prd")) return true;
  // If it points to a common prod host or non-local, treat as unsafe unless explicitly whitelisted?
  // Be conservative: allow only localhost/127.0.0.1 or ::1 or .local in CI contexts; also allow docker hostnames? For safety, require local hosts.
  if (u.includes("localhost") || u.includes("127.0.0.1") || u.includes("::1") || u.includes("host.docker.internal")) {
    return false;
  }
  // Default to unsafe for non-local targets
  return true;
}

function getTestDbConfig(): { url: string | undefined; enabled: boolean } {
  const url = process.env.TEST_DATABASE_URL || process.env.WA_TEST_DATABASE_URL;
  if (!url) return { url: undefined, enabled: false };
  if (isUnsafeTestDbUrl(url)) return { url, enabled: false };
  return { url, enabled: true };
}

const TEST_DB = getTestDbConfig();

// Never fall back to the application DATABASE_URL. If a production URL is
// accidentally provided, we must not use it.
const HAS_TEST_DB = TEST_DB.enabled;

// Validate configuration early for DB tests.
if (process.env.TEST_DATABASE_URL && !HAS_TEST_DB) {
  console.error("[whatsapp tests] Unsafe or invalid TEST_DATABASE_URL; aborting DB tests.");
  // Force process to exit with error to prevent accidental destructive runs.
  process.exit(1);
}

function emptyResult(): WhatsAppWebhookResult {
  return { ok: true, processed: 0, skipped: 0, deferred: 0, failed: 0, errors: [] };
}
