import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { Pool } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Attach PostgreSQL before starting ES 24/7.');
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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

export async function migrate() {
  await rawPoolQuery(await fs.readFile(path.resolve(here, '../db/schema.sql'), 'utf8'));
  // One-time compatibility migration: existing client accounts keep their
  // current passwords and are not forced through a password change screen.
  // Newly created clients still receive must_change_password=true.
  await rawPoolQuery(`CREATE TABLE IF NOT EXISTS app_migrations (migration_key TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const migration = await rawPoolQuery(`INSERT INTO app_migrations(migration_key) VALUES ('existing-clients-no-forced-password-reset-v1') ON CONFLICT DO NOTHING RETURNING migration_key`);
  if (migration.rowCount) {
    await rawPoolQuery(`UPDATE users SET must_change_password = false WHERE role = 'client'`);
  }
}
