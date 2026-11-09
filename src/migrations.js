import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT_NAME === 'production';
if (!process.env.DATABASE_MIGRATION_URL) throw new Error('DATABASE_MIGRATION_URL is required for the migration job.');
if (production && !process.env.DATABASE_SSL_CA) throw new Error('DATABASE_SSL_CA is required for verified PostgreSQL TLS.');

export const migrationPool = new Pool({
  max: 2,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  connectionString: process.env.DATABASE_MIGRATION_URL,
  ssl: production ? { rejectUnauthorized: true, ca: process.env.DATABASE_SSL_CA } : false
});

export async function migrate() {
  await migrationPool.query(await fs.readFile(path.resolve(here, '../db/schema.sql'), 'utf8'));
  await migrationPool.query('CREATE TABLE IF NOT EXISTS app_migrations (migration_key TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const migration = await migrationPool.query("INSERT INTO app_migrations(migration_key) VALUES ('existing-clients-no-forced-password-reset-v1') ON CONFLICT DO NOTHING RETURNING migration_key");
  if (migration.rowCount) {
    await migrationPool.query("UPDATE users SET must_change_password = false WHERE role = 'client'");
  }
}
