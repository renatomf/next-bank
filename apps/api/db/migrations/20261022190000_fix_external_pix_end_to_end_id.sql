-- migrate:up
-- An external Pix that fails at authorization (no balance, a blocked
-- account) never reached the SPI, so it has no end-to-end id; one the SPI
-- rejects (task 4) keeps the id it was sent with. The previous rule asked an
-- id of every failed external Pix, which refused the first kind.
ALTER TABLE payments.pix_transfers
  DROP CONSTRAINT pix_transfers_end_to_end_id_check,
  ADD CONSTRAINT pix_transfers_end_to_end_id_check CHECK (
    CASE
      WHEN payee_ispb IS NULL THEN (status = 'COMPLETED') = (end_to_end_id IS NOT NULL)
      WHEN status = 'FAILED' THEN true
      ELSE (status IN ('PROCESSING', 'COMPLETED')) = (end_to_end_id IS NOT NULL)
    END
  );

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
