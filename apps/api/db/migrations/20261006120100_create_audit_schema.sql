-- migrate:up
-- Audit trail (database.md, section 5.5): append-only, enforced twice.
-- The API role can only read and insert, and a trigger refuses changes even
-- from roles that have the privilege (API-05, T-DB-04).

CREATE SCHEMA audit;
GRANT USAGE ON SCHEMA audit TO nextbank_app;

CREATE TABLE audit.audit_events (
  id uuid PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('USER', 'SYSTEM', 'STAFF')),
  actor_id uuid,
  action text NOT NULL CHECK (action ~ '^[A-Z][A-Z_]{2,63}$'),
  subject_type text NOT NULL CHECK (subject_type ~ '^[A-Z][A-Z_]{2,63}$'),
  subject_id uuid NOT NULL,
  request_id text CHECK (char_length(request_id) <= 128),
  -- Allowed fields are checked in the application; never CPF, token, PIN or full Pix key.
  metadata jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT audit_events_actor_id_check CHECK (actor_type = 'SYSTEM' OR actor_id IS NOT NULL),
  CONSTRAINT audit_events_metadata_check CHECK (
    jsonb_typeof(metadata) = 'object' AND pg_column_size(metadata) <= 4096
  )
);
CREATE INDEX audit_events_subject_idx
  ON audit.audit_events (subject_type, subject_id, occurred_at DESC);
CREATE INDEX audit_events_actor_idx ON audit.audit_events (actor_id, occurred_at DESC);

CREATE FUNCTION audit.reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
-- Functions are executable by PUBLIC by default; triggers do not need that.
REVOKE EXECUTE ON FUNCTION audit.reject_change() FROM PUBLIC;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit.audit_events
  FOR EACH ROW EXECUTE FUNCTION audit.reject_change();
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit.audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_change();

GRANT SELECT, INSERT ON audit.audit_events TO nextbank_app;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
