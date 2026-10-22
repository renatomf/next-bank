-- migrate:up
-- The simulator of the Bacen and the other partners (v1.2.0 plan, D13), in a
-- schema of its own that only its own role reaches (S1): it talks to the API
-- the way the Bacen would, over HTTP, and never reads the API's tables, nor
-- the API its. Every bank, person and key here is made up (DEMO-01).

CREATE SCHEMA simulator;
GRANT USAGE ON SCHEMA simulator TO nextbank_simulator;

-- The participants on the other side of a Pix: made-up banks, by a made-up ISPB.
CREATE TABLE simulator.banks (
  ispb char(8) PRIMARY KEY CHECK (ispb ~ '^[0-9]{8}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80)
);

-- The DICT: Pix keys of the made-up banks' made-up customers.
CREATE TABLE simulator.dict_keys (
  key text PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 77),
  key_type text NOT NULL CHECK (key_type IN ('CPF', 'EMAIL', 'PHONE', 'RANDOM')),
  bank_ispb char(8) NOT NULL REFERENCES simulator.banks (ispb),
  owner_name text NOT NULL CHECK (char_length(owner_name) BETWEEN 1 AND 80),
  owner_document_masked text NOT NULL CHECK (owner_document_masked ~ '^\*\*\*\.[0-9]{3}\.[0-9]{3}-\*\*$')
);

-- A payment the SPI took. The request hash tells a repeated request from a
-- different one with the same end-to-end id (ADR 0007).
CREATE TABLE simulator.payments (
  end_to_end_id text PRIMARY KEY CHECK (end_to_end_id ~ '^E[0-9]{8}[0-9]{12}[A-Za-z0-9]{11}$'),
  request_hash text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL CHECK (currency = 'BRL'),
  payer_ispb char(8) NOT NULL CHECK (payer_ispb ~ '^[0-9]{8}$'),
  payer_name text NOT NULL,
  payer_document_masked text NOT NULL,
  payee_key text NOT NULL,
  payee_ispb char(8) REFERENCES simulator.banks (ispb),
  status text NOT NULL CHECK (status IN ('PENDING', 'SETTLED', 'REJECTED')),
  reason text CHECK (reason IN ('PAYEE_KEY_NOT_FOUND', 'PAYEE_BANK_REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  -- Written as equalities, as in the API's Pix: no OR over nullable columns.
  CONSTRAINT payments_settled_at_status_check CHECK ((status = 'SETTLED') = (settled_at IS NOT NULL)),
  CONSTRAINT payments_reason_status_check CHECK ((status = 'REJECTED') = (reason IS NOT NULL))
);
-- The day's settlement file reads the payments settled in a day.
CREATE INDEX payments_settled_at_idx ON simulator.payments (settled_at) WHERE status = 'SETTLED';

-- The webhooks the SPI owes the participant, delivered by the dispatcher when
-- due. A duplicated delivery repeats the event id; a lost one is dropped.
CREATE TABLE simulator.webhook_deliveries (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  end_to_end_id text NOT NULL REFERENCES simulator.payments (end_to_end_id),
  payload jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'DELIVERED', 'DROPPED')),
  due_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  delivered_at timestamptz,
  CONSTRAINT webhook_deliveries_delivered_at_status_check
    CHECK ((status = 'DELIVERED') = (delivered_at IS NOT NULL))
);
-- What the dispatcher asks: the pending deliveries already due.
CREATE INDEX webhook_deliveries_due_idx ON simulator.webhook_deliveries (due_at)
  WHERE status = 'PENDING';

-- Least privilege: the banks and keys are read only; a payment's request never
-- changes, only its outcome; a delivery's payload never changes.
GRANT SELECT ON simulator.banks, simulator.dict_keys TO nextbank_simulator;
GRANT SELECT, INSERT ON simulator.payments TO nextbank_simulator;
GRANT UPDATE (status, reason, settled_at) ON simulator.payments TO nextbank_simulator;
GRANT SELECT, INSERT ON simulator.webhook_deliveries TO nextbank_simulator;
GRANT UPDATE (status, due_at, attempts, delivered_at) ON simulator.webhook_deliveries
  TO nextbank_simulator;

-- Made-up banks and customers, with made-up but valid CPFs, masked.
INSERT INTO simulator.banks (ispb, name) VALUES
  ('99900001', 'Banco Aurora'),
  ('99900002', 'Banco Horizonte'),
  ('99900003', 'Cooperativa Raiz');

INSERT INTO simulator.dict_keys (key, key_type, bank_ispb, owner_name, owner_document_masked) VALUES
  ('31840725680', 'CPF', '99900001', 'Clara Aurora Teixeira', '***.407.256-**'),
  ('clara.aurora@example.com', 'EMAIL', '99900001', 'Clara Aurora Teixeira', '***.407.256-**'),
  ('+5511900009001', 'PHONE', '99900002', 'Davi Horizonte Lima', '***.913.028-**'),
  ('67491302831', 'CPF', '99900002', 'Davi Horizonte Lima', '***.913.028-**'),
  ('3f6c2a7e-9b41-4d5a-8e2f-1c7b9d0a4e63', 'RANDOM', '99900003', 'Elisa Raiz Moreira', '***.781.463-**'),
  ('20578146371', 'CPF', '99900003', 'Elisa Raiz Moreira', '***.781.463-**');

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
