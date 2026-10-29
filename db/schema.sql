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

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location_accuracy_m DOUBLE PRECISION;

-- Each company has its own independent panic/incident numbering sequence.
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS incident_number BIGINT;
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY panic_at, id) AS rn
  FROM incidents
)
UPDATE incidents i
SET incident_number=n.rn
FROM numbered n
WHERE i.id=n.id AND i.incident_number IS NULL;
ALTER TABLE incidents ALTER COLUMN incident_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS incidents_company_incident_number_idx ON incidents(company_id,incident_number);

CREATE TABLE IF NOT EXISTS company_incident_sequences (
 company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
 next_number BIGINT NOT NULL CHECK(next_number > 0)
);

INSERT INTO company_incident_sequences(company_id,next_number)
SELECT c.id, COALESCE(MAX(i.incident_number),0)+1
FROM companies c
LEFT JOIN incidents i ON i.company_id=c.id
GROUP BY c.id
ON CONFLICT(company_id) DO NOTHING;

CREATE OR REPLACE FUNCTION assign_company_incident_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.incident_number IS NULL THEN
    INSERT INTO company_incident_sequences(company_id,next_number)
    VALUES(NEW.company_id,2)
    ON CONFLICT(company_id)
    DO UPDATE SET next_number=company_incident_sequences.next_number+1
    RETURNING next_number-1 INTO NEW.incident_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incidents_assign_company_number ON incidents;
CREATE TRIGGER incidents_assign_company_number
BEFORE INSERT ON incidents
FOR EACH ROW
EXECUTE FUNCTION assign_company_incident_number();

-- One-time repair for any incidents created before the company-local numbering
-- migration was fully applied. This makes the existing history company-local,
-- then preserves the resulting next number for each company permanently.
CREATE TABLE IF NOT EXISTS company_incident_numbering_repairs (
 repair_key TEXT PRIMARY KEY,
 repaired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM company_incident_numbering_repairs WHERE repair_key='company-local-v1') THEN
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY panic_at, id) AS rn
      FROM incidents
    )
    UPDATE incidents i
    SET incident_number=n.rn
    FROM numbered n
    WHERE i.id=n.id;

    INSERT INTO company_incident_sequences(company_id,next_number)
    SELECT c.id, COALESCE(MAX(i.incident_number),0)+1
    FROM companies c
    LEFT JOIN incidents i ON i.company_id=c.id
    GROUP BY c.id
    ON CONFLICT(company_id)
    DO UPDATE SET next_number=EXCLUDED.next_number;

    INSERT INTO company_incident_numbering_repairs(repair_key)
    VALUES('company-local-v1');
  END IF;
END;
$$;


CREATE TABLE IF NOT EXISTS legal_acceptances (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 document_type TEXT NOT NULL CHECK (document_type IN ('client_app_terms','company_dashboard_terms')),
 document_version TEXT NOT NULL,
 accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id, document_type, document_version)
);
CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx ON legal_acceptances(user_id, accepted_at DESC);

-- One-time migration: preserve access for accounts that existed before acceptance
-- tracking was introduced. Accounts created after this migration must accept.
CREATE TABLE IF NOT EXISTS legal_acceptance_migrations (
 migration_key TEXT PRIMARY KEY,
 applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $
BEGIN
 IF NOT EXISTS (SELECT 1 FROM legal_acceptance_migrations WHERE migration_key='backfill-existing-accounts-v1') THEN
  INSERT INTO legal_acceptances(user_id,document_type,document_version)
  SELECT id,'client_app_terms','1.1' FROM users WHERE role='client'
  ON CONFLICT(user_id,document_type,document_version) DO NOTHING;
  INSERT INTO legal_acceptances(user_id,document_type,document_version)
  SELECT id,'company_dashboard_terms','1.0-draft' FROM users WHERE role='controller'
  ON CONFLICT(user_id,document_type,document_version) DO NOTHING;
  INSERT INTO legal_acceptance_migrations(migration_key) VALUES('backfill-existing-accounts-v1');
 END IF;
END;
$;
