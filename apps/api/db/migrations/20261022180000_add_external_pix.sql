-- migrate:up
-- The Pix to another bank (v1.2.0 plan, task 3). The payee is either an
-- account of next bank or a key of another (made-up) bank, never both nor
-- neither (P3). The other bank's key is kept encrypted, with the same
-- protector as the Pix keys, because it is sent to the SPI; the masked key,
-- the name and the document stay the snapshot the receipt shows.

ALTER TABLE payments.pix_transfers
  ALTER COLUMN payee_account_id DROP NOT NULL,
  ADD COLUMN payee_ispb char(8) CHECK (payee_ispb ~ '^[0-9]{8}$'),
  ADD COLUMN payee_bank_name text CHECK (char_length(payee_bank_name) BETWEEN 1 AND 80),
  ADD COLUMN payee_key_ciphertext bytea,
  ADD COLUMN payee_key_version smallint CHECK (payee_key_version > 0),
  ADD CONSTRAINT pix_transfers_one_payee_check
    CHECK ((payee_account_id IS NULL) <> (payee_ispb IS NULL)),
  ADD CONSTRAINT pix_transfers_external_payee_check CHECK (
    (payee_ispb IS NULL) = (payee_bank_name IS NULL)
    AND (payee_ispb IS NULL) = (payee_key_ciphertext IS NULL)
    AND (payee_ispb IS NULL) = (payee_key_version IS NULL)
  ),
  -- An external Pix is sent with its end-to-end id from the authorization,
  -- and every attempt carries the same one (EXT-03); an internal Pix gets it
  -- only when completed, as before.
  DROP CONSTRAINT pix_transfers_end_to_end_id_check,
  ADD CONSTRAINT pix_transfers_end_to_end_id_check CHECK (
    CASE
      WHEN payee_ispb IS NULL THEN (status = 'COMPLETED') = (end_to_end_id IS NOT NULL)
      ELSE (status IN ('PROCESSING', 'COMPLETED', 'FAILED')) = (end_to_end_id IS NOT NULL)
    END
  );

-- Where the money of an external Pix waits for the SPI (domain-model.md,
-- section 5): the transitory account, settled or refunded in task 4.
INSERT INTO ledger.ledger_accounts (id, code, kind, currency, created_at)
VALUES ('01a10000-0000-7000-8000-000000000021', 'system:pix_clearing', 'SYSTEM', 'BRL', now());

ALTER TABLE ledger.journal_entries
  DROP CONSTRAINT journal_entries_kind_check,
  ADD CONSTRAINT journal_entries_kind_check
    CHECK (kind IN ('FUNDING', 'PIX_INTERNAL', 'TOP_UP', 'PIX_EXTERNAL'));

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
