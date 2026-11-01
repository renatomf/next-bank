-- migrate:up
-- The trace of the participant's Pix (v1.2.0 plan, task 8, T3): the payment
-- keeps the traceparent it came with, and its webhook goes out with it.
-- Random ids only (W3C Trace Context); null when nothing was traced. Written
-- once with the payment, and outside its request hash: the same payment sent
-- again in another trace is still the same payment.
ALTER TABLE simulator.payments
  ADD COLUMN trace_parent text
    CONSTRAINT payments_trace_parent_check
    CHECK (trace_parent ~ '^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$');

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
