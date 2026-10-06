-- migrate:up
-- Identity context (database.md, section 5.1). The API role gets only the
-- privileges listed in database.md, section 6. Forward only: never edit a
-- published migration; fix with a new one.

CREATE SCHEMA identity;
GRANT USAGE ON SCHEMA identity TO nextbank_app;

CREATE TABLE identity.users (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  -- CPF is personal sensitive data: encrypted in the application (AES-256-GCM),
  -- unique through a blind index (HMAC-SHA256), shown only masked.
  cpf_ciphertext bytea NOT NULL,
  cpf_hmac bytea NOT NULL UNIQUE CHECK (octet_length(cpf_hmac) = 32),
  cpf_masked text NOT NULL,
  cpf_key_version smallint NOT NULL CHECK (cpf_key_version > 0),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND char_length(email) <= 254),
  password_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'LOCKED')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

-- A session is a family of rotating refresh tokens.
CREATE TABLE identity.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users (id),
  device_label text CHECK (char_length(device_label) <= 100),
  created_at timestamptz NOT NULL,
  last_used_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text,
  CONSTRAINT sessions_absolute_expires_at_check CHECK (absolute_expires_at > created_at),
  CONSTRAINT sessions_idle_expires_at_check CHECK (idle_expires_at <= absolute_expires_at),
  -- Written without OR over nullable values: a CHECK that evaluates to NULL passes.
  CONSTRAINT sessions_revoked_reason_check CHECK (
    (revoked_at IS NULL) = (revoked_reason IS NULL)
    AND coalesce(revoked_reason IN ('LOGOUT', 'REFRESH_TOKEN_REUSE', 'PASSWORD_CHANGED'), true)
  )
);
-- Active sessions of a user (Security screen, password change revokes all).
CREATE INDEX sessions_user_id_active_idx ON identity.sessions (user_id) WHERE revoked_at IS NULL;

-- Rotation history, needed to detect reuse of a replaced token (AUTH-03).
CREATE TABLE identity.refresh_tokens (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES identity.sessions (id),
  -- SHA-256 of a 256-bit opaque token: the token itself is never stored.
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_at timestamptz NOT NULL,
  replaced_at timestamptz,
  replaced_by_id uuid REFERENCES identity.refresh_tokens (id),
  CONSTRAINT refresh_tokens_replaced_check CHECK ((replaced_at IS NULL) = (replaced_by_id IS NULL))
);
CREATE INDEX refresh_tokens_session_id_idx ON identity.refresh_tokens (session_id);
CREATE INDEX refresh_tokens_replaced_by_id_idx ON identity.refresh_tokens (replaced_by_id);

CREATE TABLE identity.transaction_pins (
  user_id uuid PRIMARY KEY REFERENCES identity.users (id),
  pin_hash text NOT NULL,
  failed_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL
);

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity TO nextbank_app;
-- Only expired refresh tokens are ever removed (cleanup job); nothing else is deleted.
GRANT DELETE ON identity.refresh_tokens TO nextbank_app;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
