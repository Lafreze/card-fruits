import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.DATABASE_SSL === "false" || databaseUrl.includes("localhost")
          ? false
          : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    })
  : null;

export async function initializeDatabase() {
  if (!pool) return false;
  const schemaPath = path.join(process.cwd(), "database", "schema.sql");
  const schema = await fs.readFile(schemaPath, "utf8");
  await pool.query(schema);
  return true;
}

export async function isDatabaseHealthy() {
  if (!pool) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export function hashIp(ip) {
  const salt = process.env.IP_HASH_SALT || "fruit-king-local";
  return crypto.createHash("sha256").update(`${salt}:${ip || "unknown"}`).digest("hex");
}
