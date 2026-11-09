import pg from 'pg';
const { Pool } = pg;
export const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT_NAME === 'production';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Attach PostgreSQL before starting ES 24/7.');
if (isProduction && !process.env.DATABASE_SSL_CA) {
  throw new Error('DATABASE_SSL_CA is required in production to verify the Railway PostgreSQL certificate.');
}
const databaseSsl = isProduction
  ? { rejectUnauthorized: true, ca: process.env.DATABASE_SSL_CA }
  : false;
const poolOptions = { max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 };
// Normal application queries use the restricted DATABASE_URL account.
// Migrations and one-time startup provisioning use the separate admin URL.
export const pool = new Pool({ ...poolOptions, connectionString: process.env.DATABASE_URL, ssl: databaseSsl });
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

// Confirm the live pooled connection is encrypted, not merely that SSL is configured.
export async function verifyDatabaseTls() {
  if (!isProduction) return null;
  const result = await pool.query('SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
  const connection = result.rows[0];
  if (!connection || connection.ssl !== true) {
    throw new Error('PostgreSQL TLS verification failed: the active database connection is not encrypted.');
  }
  const databaseUrl = new URL(process.env.DATABASE_URL);
  return {
    databaseHost: databaseUrl.hostname,
    databaseName: decodeURIComponent(databaseUrl.pathname.slice(1)),
    version: connection.version,
    cipher: connection.cipher
  };
}
