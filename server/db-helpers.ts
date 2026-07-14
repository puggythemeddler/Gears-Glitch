import { Pool, PoolClient, QueryResult } from "pg";

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
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
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

async function runSchema(schemaSql: string): Promise<void> {
  await query(schemaSql);
}

function closePool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    return p.end();
  }
  return Promise.resolve();
}

export { getPool, query, queryOne, queryAll, transaction, runSchema, closePool };
