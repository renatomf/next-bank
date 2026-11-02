-- migrate:up
-- The staff of the backoffice (v1.3.0 plan, task 1): its own bounded context,
-- apart from the customers' Identity (B4), so its own schema. A member signs
-- in with password and TOTP; a session is stored only as the hash of its
-- token (S1). The API deletes nothing here.

CREATE SCHEMA staff;
GRANT USAGE ON SCHEMA staff TO nextbank_app;

CREATE TABLE staff.members (
  id uuid PRIMARY KEY,
  -- Normalized by the application: trimmed and lowercase.
  email text NOT NULL CONSTRAINT members_email_key UNIQUE
    CHECK (email = lower(email) AND char_length(email) BETWEEN 3 AND 254),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  password_hash text NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  -- Sealed with STAFF_TOTP_KEY (S5): nonce, tag and ciphertext.
  totp_secret_ciphertext bytea NOT NULL CHECK (octet_length(totp_secret_ciphertext) > 28),
  totp_key_version smallint NOT NULL CHECK (totp_key_version > 0),
  -- The TOTP step of the last code accepted: a code works once (RFC 6238, 5.2).
  last_totp_step bigint CHECK (last_totp_step >= 0),
  role text NOT NULL CHECK (role IN ('OPERATOR', 'ANALYST', 'ADMIN')),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
  -- A member of the public demo, who sees only demo customers (B5).
  is_demo boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE staff.sessions (
  id uuid PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES staff.members (id),
  -- SHA-256 of the 256-bit token: the token itself is never stored.
  token_hash bytea NOT NULL CONSTRAINT sessions_token_hash_key UNIQUE
    CHECK (octet_length(token_hash) = 32),
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  -- At most 8 hours (STF-06); 15 minutes without use end it earlier.
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT sessions_times_check CHECK (
    last_seen_at >= created_at
    AND expires_at > created_at
    AND expires_at <= created_at + interval '8 hours'
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  )
);
-- The sessions of a member, to end them all when it is disabled (task 7).
CREATE INDEX sessions_member_id_idx ON staff.sessions (member_id);

-- A login changes only the last TOTP step; a session, its last use and its
-- revocation. Roles and statuses change with the admin's screen (task 7).
GRANT SELECT, INSERT ON staff.members, staff.sessions TO nextbank_app;
GRANT UPDATE (last_totp_step, updated_at) ON staff.members TO nextbank_app;
GRANT UPDATE (last_seen_at, revoked_at) ON staff.sessions TO nextbank_app;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
