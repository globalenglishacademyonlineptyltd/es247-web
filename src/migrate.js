import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT_NAME === 'production';
if (!process.env.DATABASE_MIGRATION_URL) throw new Error('DATABASE_MIGRATION_URL is required for the migration job.');
if (production && !process.env.DATABASE_SSL_CA) throw new Error('DATABASE_SSL_CA is required for verified PostgreSQL TLS.');

const migrationPool = new Pool({
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

const email = value => {
  const result = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()) && String(value).length <= 254;
  if (!result) throw new Error('A valid administrator email address is required.');
  return String(value).trim().toLowerCase();
};
const password = value => {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new Error('Administrator bootstrap password must contain 12 to 128 characters.');
  return value;
};
const hashPassword = async value => {
  const bcrypt = (await import('bcryptjs')).default;
  return bcrypt.hash(value, 12);
};

async function run() {
  const tls = await migrationPool.query('SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid()');
  if (production && tls.rows[0]?.ssl !== true) throw new Error('Migration database TLS verification failed.');
  const identity = await migrationPool.query('SELECT current_user, current_database()');
  console.log('Migration database connected as ' + identity.rows[0].current_user + ' to ' + identity.rows[0].current_database());

  await migrate();
  console.log('Database schema migrations completed.');

  if (process.env.MASTER_ADMIN_2_EMAIL) {
    const e = email(process.env.MASTER_ADMIN_2_EMAIL);
    const target = await migrationPool.query('SELECT id,role,email,company_id,active FROM users WHERE LOWER(email)=LOWER($1)', [e]);
    if (target.rowCount) {
      await migrationPool.query("UPDATE users SET email=$1,role='master_admin_2',company_id=NULL,display_name='Chanelle',active=true,session_version=session_version+CASE WHEN LOWER(email)<>LOWER($1) OR role<>'master_admin_2' OR company_id IS NOT NULL OR active=false THEN 1 ELSE 0 END WHERE id=$2", [e,target.rows[0].id]);
      console.log('Second master administrator role verified; existing password preserved.');
    } else {
      const current = await migrationPool.query("SELECT id FROM users WHERE role='master_admin_2' ORDER BY id LIMIT 1");
      if (current.rowCount) {
        await migrationPool.query("UPDATE users SET email=$1,role='master_admin_2',company_id=NULL,display_name='Chanelle',active=true,session_version=session_version+CASE WHEN LOWER(email)<>LOWER($1) OR role<>'master_admin_2' OR company_id IS NOT NULL OR active=false THEN 1 ELSE 0 END WHERE id=$2", [e,current.rows[0].id]);
        console.log('Second master administrator email updated; existing password preserved.');
      } else {
        const oneTimePassword = (await import('node:crypto')).randomBytes(48).toString('base64url');
        await migrationPool.query("INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password,active) VALUES($1,$2,'master_admin_2',NULL,'Chanelle',true,true)", [e,await hashPassword(oneTimePassword)]);
        console.log('Second master administrator provisioned; password change required.');
      }
    }
  }

  const count = await migrationPool.query('SELECT COUNT(*)::int AS n FROM users');
  if (count.rows[0].n === 0 && process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
    const e = email(process.env.INITIAL_ADMIN_EMAIL);
    const p = password(process.env.INITIAL_ADMIN_PASSWORD);
    await migrationPool.query("INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password) VALUES($1,$2,'master_admin',NULL,'Master Administrator',false)", [e,await hashPassword(p)]);
    console.log('Initial master administrator created from migration-job configuration.');
  }
}

try {
  await run();
} catch (error) {
  console.error('Migration job failed:', error.message);
  process.exitCode = 1;
} finally {
  await migrationPool.end().catch(() => {});
}
