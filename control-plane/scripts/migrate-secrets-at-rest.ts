import dotenv from "dotenv";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { decryptSecret, ENC_PREFIX, encryptSecret } from "../server/cp-secrets";

// Load the control-plane's local environment without ever printing its values.
dotenv.config({ path: resolve(process.cwd(), ".env"), quiet: true });

const SECRET_COLUMNS = [
  { table: "clients", column: "cp_secret" },
  { table: "clients", column: "neon_db_url" },
  { table: "cp_users", column: "api_key" },
  { table: "cp_users", column: "totp_secret" },
  { table: "smtp_config", column: "pass" },
  { table: "cloudinary_config", column: "api_secret" },
] as const;

type SecretColumn = (typeof SECRET_COLUMNS)[number];
type SecretRow = { id: number | string; value: string };
type Counts = Record<string, number>;

class SafeConfigError extends Error {
  readonly safeToDisplay = true;
}

function countKey(target: SecretColumn): string {
  return `${target.table}.${target.column}`;
}

function isApplyMode(args: string[]): boolean {
  return args.includes("--apply");
}

function backupReference(args: string[]): string | null {
  const index = args.indexOf("--backup-ref");
  return index >= 0 ? args[index + 1]?.trim() || null : null;
}

function requiresDatabaseWriteConfirmation(args: string[]): boolean {
  return args.includes("--confirm-database-write");
}

function confirmsKeyCopiedFromRender(args: string[]): boolean {
  return args.includes("--confirm-key-copied-from-render");
}

function legacyValueWhere(target: SecretColumn): string {
  return `"${target.column}" IS NOT NULL AND "${target.column}" <> '' AND "${target.column}" NOT LIKE '${ENC_PREFIX}%'`;
}

async function validateExistingCiphertexts(client: PoolClient): Promise<number> {
  let verified = 0;
  for (const target of SECRET_COLUMNS) {
    const result = await client.query<{ value: string }>(
      `SELECT "${target.column}" AS value FROM "${target.table}" WHERE "${target.column}" LIKE $1`,
      [`${ENC_PREFIX}%`],
    );
    // This deliberately verifies ciphertext but never logs the decrypted value.
    for (const row of result.rows) {
      decryptSecret(row.value);
      verified += 1;
    }
  }
  return verified;
}

async function countLegacyValues(client: PoolClient): Promise<Counts> {
  const counts: Counts = {};
  for (const target of SECRET_COLUMNS) {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "${target.table}" WHERE ${legacyValueWhere(target)}`,
    );
    counts[countKey(target)] = Number(result.rows[0]?.count || 0);
  }
  return counts;
}

async function migrate(client: PoolClient, keyCopiedFromRender: boolean): Promise<Counts> {
  const migrated: Counts = {};
  await client.query("BEGIN");
  try {
    // Fail before changing anything if any existing ciphertext is unreadable.
    const verifiedCiphertexts = await validateExistingCiphertexts(client);
    if (verifiedCiphertexts === 0 && !keyCopiedFromRender) {
      throw new Error("No existing ciphertext can confirm this key matches the live service key.");
    }

    for (const target of SECRET_COLUMNS) {
      const selected = await client.query<SecretRow>(
        `SELECT id, "${target.column}" AS value FROM "${target.table}" WHERE ${legacyValueWhere(target)} FOR UPDATE`,
      );
      let changed = 0;
      for (const row of selected.rows) {
        const encrypted = encryptSecret(row.value);
        if (!encrypted.startsWith(ENC_PREFIX)) {
          throw new Error("Encryption did not produce the required ciphertext format.");
        }
        const updated = await client.query(
          `UPDATE "${target.table}" SET "${target.column}" = $1 WHERE id = $2 AND "${target.column}" = $3`,
          [encrypted, row.id, row.value],
        );
        if (updated.rowCount !== 1) throw new Error("A secret row changed concurrently; migration will be rolled back.");
        changed += 1;
      }
      migrated[countKey(target)] = changed;
    }

    const remaining = await countLegacyValues(client);
    if (Object.values(remaining).some((count) => count !== 0)) {
      throw new Error("Legacy secret values remain after migration; transaction will be rolled back.");
    }
    await client.query("COMMIT");
    return migrated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function printCounts(title: string, counts: Counts): void {
  console.log(title);
  for (const target of SECRET_COLUMNS) {
    console.log(`  ${countKey(target)}: ${counts[countKey(target)] ?? 0}`);
  }
  console.log(`  total: ${Object.values(counts).reduce((sum, count) => sum + count, 0)}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = isApplyMode(args);
  const backupRef = backupReference(args);

  if (!process.env.CONTROL_PLANE_DATABASE_URL) {
    throw new SafeConfigError("CONTROL_PLANE_DATABASE_URL is required (value is never displayed).");
  }
  if (!process.env.CP_SECRETS_KEY || process.env.CP_SECRETS_KEY.length < 16) {
    throw new SafeConfigError("Set the active dedicated CP_SECRETS_KEY (at least 16 characters) before running this migration.");
  }
  if (apply && (!backupRef || !requiresDatabaseWriteConfirmation(args))) {
    throw new SafeConfigError("Apply requires --backup-ref <verified backup reference> and --confirm-database-write.");
  }

  const sslVerify = process.env.CONTROL_PLANE_SSL_VERIFY !== "false";
  const pool = new Pool({
    connectionString: process.env.CONTROL_PLANE_DATABASE_URL,
    ssl: sslVerify ? { rejectUnauthorized: true } : false,
    max: 1,
  });

  try {
    const client = await pool.connect();
    try {
      if (apply) {
        const changed = await migrate(client, confirmsKeyCopiedFromRender(args));
        printCounts("Secret-at-rest migration committed (counts only):", changed);
        if (confirmsKeyCopiedFromRender(args)) {
          console.log("Key match basis: operator confirmed the exact key was copied from Render.");
        }
        console.log(`Backup reference recorded: ${backupRef}`);
      } else {
        await client.query("BEGIN READ ONLY");
        try {
          const verifiedCiphertexts = await validateExistingCiphertexts(client);
          const counts = await countLegacyValues(client);
          printCounts("Dry run only; no database rows changed. Plaintext secret counts:", counts);
          console.log(`Existing ciphertexts verified with this key: ${verifiedCiphertexts}`);
          if (verifiedCiphertexts === 0) {
            console.log("No ciphertext exists for an independent key check; apply requires --confirm-key-copied-from-render after copying the exact active key from Render.");
          }
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const code = (error as { code?: string })?.code;
  console.error(`Secret migration stopped without exposing database values${code ? ` (database error ${code})` : ""}.`);
  if (error instanceof SafeConfigError) console.error(error.message);
  else console.error("No further error details are printed to avoid exposing secret-bearing database diagnostics.");
  process.exitCode = 1;
});
