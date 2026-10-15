import assert from 'assert';
import { test } from 'node:test';

import {
  isValidTestDbUrl,
  getTestDatabaseUrl,
  hasSafeTestDatabase,
  applyTestDatabaseUrl,
} from '../server/test-db';

// Helper to save/restore the two DB env vars around a test so the suite never
// leaks state into another test file.
function withEnv(testDb: string | undefined, databaseUrl: string | undefined, fn: () => void): void {
  const oldTest = process.env.TEST_DATABASE_URL;
  const oldDb = process.env.DATABASE_URL;
  try {
    if (testDb === undefined) delete process.env.TEST_DATABASE_URL; else process.env.TEST_DATABASE_URL = testDb;
    if (databaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = databaseUrl;
    fn();
  } finally {
    if (oldTest === undefined) delete process.env.TEST_DATABASE_URL; else process.env.TEST_DATABASE_URL = oldTest;
    if (oldDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldDb;
  }
}

test('db safety: DATABASE_URL alone cannot enable DB tests (no fallback)', () => {
  withEnv(undefined, 'postgres://localhost:5432/whatever', () => {
    assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
    assert.strictEqual(hasSafeTestDatabase(), false);
    assert.throws(() => getTestDatabaseUrl(), /TEST_DATABASE_URL is not set/);
  });
});

test('db safety: unsafe TEST_DATABASE_URL is rejected (neon.tech)', () => {
  withEnv('postgres://user:pass@ep-prod.neon.tech/db', undefined, () => {
    assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
    assert.throws(() => getTestDatabaseUrl(), /not a safe disposable database URL/);
  });
});

test('db safety: unsafe TEST_DATABASE_URL is rejected (production)', () => {
  withEnv('postgres://prod-host/db', undefined, () => {
    assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
  });
  withEnv('postgres://my-prd-db.internal/db', undefined, () => {
    assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
  });
});

test('db safety: malformed URL is rejected', () => {
  withEnv('not-a-url', undefined, () => {
    assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
  });
  withEnv('mysql://localhost/db', undefined, () => {
    assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
  });
});

test('db safety: valid disposable TEST_DATABASE_URL passes', () => {
  withEnv('postgres://127.0.0.1:5432/testdb', undefined, () => {
    assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), true);
    assert.strictEqual(hasSafeTestDatabase(), true);
    assert.strictEqual(getTestDatabaseUrl(), 'postgres://127.0.0.1:5432/testdb');
  });
});

test('db safety: remote non-local host is rejected', () => {
  withEnv('postgres://1.2.3.4:5432/db', undefined, () => {
    assert.strictEqual(isValidTestDbUrl(process.env.TEST_DATABASE_URL), false);
  });
});

test('db safety: applyTestDatabaseUrl points the pool at the validated test DB only', () => {
  withEnv('postgres://localhost:5432/gg_test', 'postgres://prod.example/db', () => {
    const applied = applyTestDatabaseUrl();
    assert.strictEqual(applied, 'postgres://localhost:5432/gg_test');
    assert.strictEqual(process.env.DATABASE_URL, 'postgres://localhost:5432/gg_test');
  });
  // Without a safe TEST_DATABASE_URL, apply must throw and NOT overwrite DATABASE_URL.
  withEnv(undefined, 'postgres://prod.example/db', () => {
    assert.throws(() => applyTestDatabaseUrl());
    assert.strictEqual(process.env.DATABASE_URL, 'postgres://prod.example/db');
  });
});
