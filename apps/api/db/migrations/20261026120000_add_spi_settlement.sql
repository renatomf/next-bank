-- migrate:up
-- The SPI's answer to a Pix to another bank (v1.2.0 plan, task 4).

-- The inbox (ADR 0016, EXT-02): every webhook event the API took, by its id,
-- written in the transaction that applies it, so a repeated event finds its
-- row and changes nothing. Only the id and what was done with it: never the
-- body, which names the Pix.
CREATE TABLE platform.inbox_events (
  event_id uuid PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('spi')),
  outcome text NOT NULL CHECK (outcome IN ('APPLIED', 'IGNORED')),
  received_at timestamptz NOT NULL
);

-- What was received never changes, and is never deleted by the API.
GRANT SELECT, INSERT ON platform.inbox_events TO nextbank_app;

-- Where the money of a settled external Pix ends (domain-model.md, section 6).
INSERT INTO ledger.ledger_accounts (id, code, kind, currency, created_at)
VALUES ('01a10000-0000-7000-8000-000000000022', 'system:bacen_settlement', 'SYSTEM', 'BRL', now());

ALTER TABLE ledger.journal_entries
  DROP CONSTRAINT journal_entries_kind_check,
  ADD CONSTRAINT journal_entries_kind_check CHECK (kind IN (
    'FUNDING', 'PIX_INTERNAL', 'TOP_UP', 'PIX_EXTERNAL',
    'PIX_EXTERNAL_SETTLEMENT', 'PIX_EXTERNAL_REFUND'
  ));

-- The SPI's refusal, whatever its cause (W1).
ALTER TABLE payments.pix_transfers
  DROP CONSTRAINT pix_transfers_failure_reason_check,
  ADD CONSTRAINT pix_transfers_failure_reason_check CHECK (
    (status = 'FAILED') = (failure_reason IS NOT NULL)
    AND coalesce(
      failure_reason IN (
        'INSUFFICIENT_FUNDS', 'LIMIT_EXCEEDED', 'PAYEE_UNAVAILABLE', 'ACCOUNT_BLOCKED',
        'PAYEE_BANK_REJECTED'
      ),
      true
    )
  );

-- What the status check asks (W2): the external Pix still waiting for the
-- SPI, oldest first.
CREATE INDEX pix_transfers_external_processing_idx ON payments.pix_transfers (authorized_at)
  WHERE status = 'PROCESSING' AND payee_ispb IS NOT NULL;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
