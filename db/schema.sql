CREATE TABLE IF NOT EXISTS companies (
 id BIGSERIAL PRIMARY KEY, registered_name TEXT NOT NULL, cipc_number TEXT NOT NULL UNIQUE,
 psira_number TEXT NOT NULL UNIQUE, bbbee_level TEXT, contact_number TEXT NOT NULL,
 contact_email TEXT NOT NULL, covering_areas TEXT NOT NULL, tax_number TEXT NOT NULL,
 vat_number TEXT, archived_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('master_admin','controller','client')),
 company_id BIGINT REFERENCES companies(id) ON DELETE RESTRICT, display_name TEXT NOT NULL,
 must_change_password BOOLEAN NOT NULL DEFAULT TRUE, active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('master_admin','master_admin_2','controller','client'));
CREATE TABLE IF NOT EXISTS clients (
 id BIGSERIAL PRIMARY KEY, company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE RESTRICT, full_name TEXT NOT NULL,
 phone TEXT, alternate_phone TEXT, email TEXT, address TEXT, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
 vehicles JSONB NOT NULL DEFAULT '[]'::jsonb, family_group_id BIGINT, is_family_primary BOOLEAN NOT NULL DEFAULT TRUE,
 app_download_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS incidents (
 id BIGSERIAL PRIMARY KEY, company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
 incident_type TEXT NOT NULL CHECK(incident_type IN ('Emergency Service','Accident','Fire Panic','Other')),
 status TEXT NOT NULL DEFAULT 'Panic Received' CHECK(status IN ('Panic Received','Acknowledged','Acknowledged - No Responder Available','Controller Responding','Response Dispatched','Response On Site','Incident Resolved')),
 ob_number TEXT, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, location_text TEXT,
 panic_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS incident_events (
 id BIGSERIAL PRIMARY KEY, incident_id BIGINT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
 actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, event_type TEXT NOT NULL,
 note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS incidents_company_panic_idx ON incidents(company_id,panic_at DESC);
CREATE INDEX IF NOT EXISTS incident_events_incident_idx ON incident_events(incident_id,created_at);
CREATE INDEX IF NOT EXISTS clients_company_idx ON clients(company_id);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens(user_id,created_at DESC);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS clients_company_archive_idx ON clients(company_id,archived_at,full_name);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS alternate_phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vehicles JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS family_group_id BIGINT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_family_primary BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE incidents DROP COLUMN IF EXISTS device_ip;

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS client_activated_at TIMESTAMPTZ;


ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_incident_type_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_incident_type_check CHECK(incident_type IN ('Emergency Service','Accident','Fire Panic','Other','Panic: Ambulance Assistance Needed','Panic: Police Assistance Needed','Panic: Fire Fighter Assistance Needed','Panic: Tow Truck Assistance Needed'));
CREATE TABLE IF NOT EXISTS client_requests (
 id BIGSERIAL PRIMARY KEY,
 company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
 request_type TEXT NOT NULL,
 family_member_count INTEGER NOT NULL CHECK(family_member_count BETWEEN 1 AND 20),
 request_message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'New',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS client_requests_company_idx ON client_requests(company_id,status,created_at DESC);

-- Preserve the device-reported GPS accuracy with each emergency location.
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location_accuracy_m DOUBLE PRECISION;
