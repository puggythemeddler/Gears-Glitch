import assert from 'assert';
import { test } from 'node:test';

function isValidTestDbUrl(u: string | undefined): boolean {
  if (!u) return false;
  const s = u.trim();
  if (!s) return false;
  let url: URL;
  try { url = new URL(s); } catch { return false; }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return false;
  const host = url.hostname.toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === 'host.docker.internal') return true;
  if (host.endsWith('.neon.tech')) return false;
  if (/(^|\.)prod(uction)?($|\.)/i.test(host)) return false;
  if (/(^|\.)prd($|\.)/i.test(host)) return false;
  return false;
}

test('db safety: only DATABASE_URL cannot enable DB tests', () => {
  const oldTest = process.env.TEST_DATABASE_URL;
  const oldDb = process.env.DATABASE_URL;
  delete process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://localhost:5432/whatever';
  assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
  if (oldTest !== undefined) process.env.TEST_DATABASE_URL = oldTest; else delete process.env.TEST_DATABASE_URL;
  if (oldDb !== undefined) process.env.DATABASE_URL = oldDb; else delete process.env.DATABASE_URL;
});

test('db safety: unsafe TEST_DATABASE_URL is rejected (neon.tech)', () => {
  const oldTest = process.env.TEST_DATABASE_URL;
  const oldDb = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.TEST_DATABASE_URL = 'postgres://user:pass@ep-prod.neon.tech/db';
  assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
  if (oldTest !== undefined) process.env.TEST_DATABASE_URL = oldTest; else delete process.env.TEST_DATABASE_URL;
  if (oldDb !== undefined) process.env.DATABASE_URL = oldDb; else delete process.env.DATABASE_URL;
});

test('db safety: unsafe TEST_DATABASE_URL is rejected (production)', () => {
  const oldTest = process.env.TEST_DATABASE_URL;
  const oldDb = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.TEST_DATABASE_URL = 'postgres://prod-host/db';
  assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
  if (oldTest !== undefined) process.env.TEST_DATABASE_URL = oldTest; else delete process.env.TEST_DATABASE_URL;
  if (oldDb !== undefined) process.env.DATABASE_URL = oldDb; else delete process.env.DATABASE_URL;
});

test('db safety: malformed URL is rejected', () => {
  const oldTest = process.env.TEST_DATABASE_URL;
  const oldDb = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.TEST_DATABASE_URL = 'not-a-url';
  assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
  if (oldTest !== undefined) process.env.TEST_DATABASE_URL = oldTest; else delete process.env.TEST_DATABASE_URL;
  if (oldDb !== undefined) process.env.DATABASE_URL = oldDb; else delete process.env.DATABASE_URL;
});

test('db safety: valid disposable TEST_DATABASE_URL passes', () => {
  const oldTest = process.env.TEST_DATABASE_URL;
  const oldDb = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.TEST_DATABASE_URL = 'postgres://127.0.0.1:5432/testdb';
  assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), true);
  if (oldTest !== undefined) process.env.TEST_DATABASE_URL = oldTest; else delete process.env.TEST_DATABASE_URL;
  if (oldDb !== undefined) process.env.DATABASE_URL = oldDb; else delete process.env.DATABASE_URL;
});
