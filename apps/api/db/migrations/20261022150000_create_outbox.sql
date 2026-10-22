-- migrate:up
-- The transactional outbox (v1.2.0 plan, task 2; ADR 0016): what a command
-- must still tell the outside world, written in the command's own
-- transaction and delivered at least once by the worker. In the shared
-- platform schema, as the idempotency records (ADR 0015): every module uses it.
-- Only ids and codes go in it (O1): nothing personal (API-04).

CREATE TABLE platform.outbox_messages (
  id uuid PRIMARY KEY,
  type text NOT NULL CHECK (type ~ '^[a-z]+(\.[a-z0-9-]+)+$'),
  payload jsonb NOT NULL
    CHECK (jsonb_typeof(payload) = 'object' AND pg_column_size(payload) <= 2048),
  -- The request that wrote it, for the end-to-end trace (task 8).
  request_id text CHECK (char_length(request_id) <= 64),
  status text NOT NULL CHECK (status IN ('PENDING', 'DONE', 'DEAD')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL,
  -- A worker's claim while its handler runs, outside any transaction; a claim
  -- left by a worker that died runs out, and the message is taken again.
  locked_until timestamptz,
  -- The name of the last error only, never its message (API-04).
  last_error text CHECK (char_length(last_error) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT outbox_messages_processed_at_status_check
    CHECK ((status = 'DONE') = (processed_at IS NOT NULL))
);

-- What the worker asks: the pending messages already available.
CREATE INDEX outbox_messages_available_idx ON platform.outbox_messages (available_at)
  WHERE status = 'PENDING';

-- What a message says never changes; only how it is delivered. No DELETE:
-- clearing the delivered ones is a job of its own, later.
GRANT SELECT, INSERT ON platform.outbox_messages TO nextbank_app;
GRANT UPDATE (status, attempts, available_at, locked_until, last_error, processed_at)
  ON platform.outbox_messages TO nextbank_app;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
