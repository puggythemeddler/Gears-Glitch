// Test-only database isolation.
//
// Destructive integration tests (schema drops, TRUNCATEs) must NEVER run against
// the runtime/production database. They are therefore gated on an explicit,
// separately-supplied `TEST_DATABASE_URL`, and only when it passes validation:
// the runtime `DATABASE_URL` is *never* used as a fallback. The URL is validated before any
// pool is created or any destructive statement runs.
//
// Safe targets are local/disposable hosts only. Managed/production hosts
// (Neon, anything that looks like prod/prd) are rejected outright.

// Returns true only when `u` is a syntactically valid Postgres URL whose host is
// an accepted disposable/local target. Anything else (missing, malformed,
// remote/managed, production-looking) is false — fail closed.
export function isValidTestDbUrl(u: string | undefined): boolean {
  if (!u) return false;
  const s = u.trim();
  if (!s) return false;
  let url: URL;
  try { url = new URL(s); } catch { return false; }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return false;
  const host = url.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]" || host === "host.docker.internal") return true;
  if (host.endsWith(".neon.tech")) return false;
  if (/(^|\.)prod(uction)?($|\.)/i.test(host)) return false;
  if (/(^|\.)prd($|\.)/i.test(host)) return false;
  return false;
}

// Reads and validates `TEST_DATABASE_URL`. Throws when it is absent or unsafe;
// it does not consult `DATABASE_URL` under any circumstance.
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !url.trim()) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Destructive integration tests require an explicit disposable test database; DATABASE_URL is never used as a fallback."
    );
  }
  if (!isValidTestDbUrl(url)) {
    throw new Error(
      "TEST_DATABASE_URL is not a safe disposable database URL (it must be local/disposable; managed or production hosts are rejected)."
    );
  }
  return url.trim();
}

// True when a safe TEST_DATABASE_URL is configured. Used to skip DB suites.
export function hasSafeTestDatabase(): boolean {
  return isValidTestDbUrl(process.env.TEST_DATABASE_URL);
}

// Validates TEST_DATABASE_URL and points the shared pool at it. Must be called
// AFTER validation and BEFORE getPool()/any destructive query. Returns the URL.
export function applyTestDatabaseUrl(): string {
  const url = getTestDatabaseUrl();
  process.env.DATABASE_URL = url;
  return url;
}

// One-call bootstrap for DB-gated test files. When a safe TEST_DATABASE_URL is
// present it becomes the effective DATABASE_URL (the explicit, validated opt-in)
// and returns true. Otherwise it removes any inherited DATABASE_URL so DB suites
// skip rather than accidentally running against an unvalidated/production URL.
// Never throws, so it is safe to call at module load time.
export function bootstrapTestDatabase(): boolean {
  if (hasSafeTestDatabase()) {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    return true;
  }
  delete process.env.DATABASE_URL;
  return false;
}
