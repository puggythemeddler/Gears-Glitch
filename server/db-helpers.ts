import { Pool, PoolClient, QueryResult, types } from "pg";

// Money columns are stored as exact NUMERIC(12,2) (see migration 0002).
// node-postgres returns NUMERIC/float8/oid-1700 as strings by default; register
// a parser so these values keep coming back as JS numbers (matching the previous
// DOUBLE PRECISION behaviour) and no API contract changes.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set. Set it in .env or your hosting platform.");
    }
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: process.env.DB_SSL_REJECT !== "false" } : false,
    });
    pool.on("error", (err) => {
      console.error("Unexpected PostgreSQL pool error:", err);
    });
  }
  return pool;
}

async function query(text: string, params?: any[]): Promise<QueryResult> {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function queryOne(text: string, params?: any[]): Promise<any | undefined> {
  const result = await query(text, params);
  return result.rows[0];
}

async function queryAll(text: string, params?: any[]): Promise<any[]> {
  const result = await query(text, params);
  return result.rows;
}

async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Split a SQL script at statement terminators without splitting quoted strings,
 * comments, or PostgreSQL dollar-quoted function bodies. PostgreSQL parses a
 * multi-statement simple-query string before executing its statements, so a
 * later index can fail to resolve a column that an earlier ALTER in the same
 * string would add. Running statements in order lets legacy-schema repairs take
 * effect before dependent indexes are planned.
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let i = 0;
  let singleQuoted = false;
  let backslashEscapes = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockCommentDepth = 0;
  let dollarTag: string | null = null;

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      i++;
      continue;
    }
    if (blockCommentDepth > 0) {
      if (char === "/" && next === "*") { blockCommentDepth++; i += 2; continue; }
      if (char === "*" && next === "/") { blockCommentDepth--; i += 2; continue; }
      i++;
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { i += dollarTag.length; dollarTag = null; continue; }
      i++;
      continue;
    }
    if (singleQuoted) {
      if (char === "'" && next === "'") { i += 2; continue; }
      if (backslashEscapes && char === "\\") { i += 2; continue; }
      if (char === "'") singleQuoted = false;
      i++;
      continue;
    }
    if (doubleQuoted) {
      if (char === '"' && next === '"') { i += 2; continue; }
      if (char === '"') doubleQuoted = false;
      i++;
      continue;
    }

    if (char === "-" && next === "-") { lineComment = true; i += 2; continue; }
    if (char === "/" && next === "*") { blockCommentDepth = 1; i += 2; continue; }
    if (char === "'") {
      const prefix = sql[i - 1];
      const beforePrefix = sql[i - 2];
      backslashEscapes = (prefix === "E" || prefix === "e") && !/[A-Za-z0-9_$]/.test(beforePrefix || " ");
      singleQuoted = true;
      i++;
      continue;
    }
    if (char === '"') { doubleQuoted = true; i++; continue; }
    if (char === "$" && !/[A-Za-z0-9_$]/.test(sql[i - 1] || " ")) {
      const match = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*|)\$/);
      if (match) { dollarTag = match[0]; i += dollarTag.length; continue; }
    }
    if (char === ";") {
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
    i++;
  }

  const finalStatement = sql.slice(start).trim();
  if (finalStatement) statements.push(finalStatement);
  return statements;
}

async function runSchema(schemaSql: string): Promise<void> {
  for (const statement of splitSqlStatements(schemaSql)) {
    await query(statement);
  }
}

function closePool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    return p.end();
  }
  return Promise.resolve();
}

export { getPool, query, queryOne, queryAll, transaction, runSchema, closePool, splitSqlStatements };
