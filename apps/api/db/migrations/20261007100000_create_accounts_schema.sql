-- migrate:up
-- Current accounts (database.md, section 5.2; domain-model.md 3.2). An account
-- never holds a balance: that is the ledger's job. No foreign key to identity:
-- contexts reference each other by id (database.md, section 1).

CREATE SCHEMA accounts;
GRANT USAGE ON SCHEMA accounts TO nextbank_app;

-- Six digits plus a mod-11 check digit computed by the domain. A sequence is
-- safe under concurrency without locks; a number lost to a rollback is a gap.
CREATE SEQUENCE accounts.account_number_seq
  AS integer START 100000 MINVALUE 100000 MAXVALUE 999999 NO CYCLE;
GRANT USAGE ON SEQUENCE accounts.account_number_seq TO nextbank_app;

CREATE TABLE accounts.accounts (
  id uuid PRIMARY KEY,
  -- One account per customer in V1.
  holder_user_id uuid NOT NULL CONSTRAINT accounts_holder_user_id_key UNIQUE,
  branch char(4) NOT NULL CHECK (branch = '0001'),
  number text NOT NULL CHECK (number ~ '^[0-9]{6}-[0-9]$'),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'BLOCKED', 'CLOSED')),
  opened_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT accounts_branch_number_key UNIQUE (branch, number)
);

-- Least privilege: the API opens accounts and changes their status, nothing else.
GRANT SELECT, INSERT ON accounts.accounts TO nextbank_app;
GRANT UPDATE (status, updated_at) ON accounts.accounts TO nextbank_app;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
