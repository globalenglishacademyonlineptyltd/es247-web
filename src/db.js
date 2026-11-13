import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { Pool } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Attach PostgreSQL before starting ES 24/7.');
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_SSL_CA) {
  throw new Error('DATABASE_SSL_CA is required in production to verify the Railway PostgreSQL certificate.');
}
const sslOptions = process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: true, ca: process.env.DATABASE_SSL_CA }
  : false;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslOptions,
  max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000
});

// Keep the public incident API company-scoped while exposing the persistent
// company-local panic number to the existing frontend without changing its
// internal/global incident ID used by database relationships.
const rawPoolQuery = pool.query.bind(pool);
pool.query = function(text, values) {
  if (typeof text === 'string') {
    if (text.includes('SELECT i.id,i.incident_type,i.status,i.ob_number')) {
      text = text.replace('SELECT i.id,i.incident_type,i.status,i.ob_number', 'SELECT i.id,i.incident_number,i.incident_type,i.status,i.ob_number');
    }
    if (text.includes('SELECT i.id,i.incident_type,i.status,i.location_text,i.panic_at')) {
      text = text.replace('SELECT i.id,i.incident_type,i.status,i.location_text,i.panic_at', 'SELECT i.id,i.incident_number,i.incident_type,i.status,i.location_text,i.panic_at');
    }
  }
  return rawPoolQuery(text, values);
};

const migrationPool = new Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL,
  ssl: sslOptions,
  max: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000
});

export async function migrate() {
  // Production uses the separate privileged migration account. Normal app
  // queries continue using the restricted runtime DATABASE_URL account.
  await migrationPool.query(await fs.readFile(path.resolve(here, '../db/schema.sql'), 'utf8'));
}
