-- migrate:up
-- The trace across the wait (v1.2.0 plan, task 8, T3): the message keeps the
-- traceparent of the transaction that wrote it, so the worker delivers it in
-- the same trace. Random ids only (W3C Trace Context), nothing personal
-- (ADR 0016); null when nothing was traced. Written once with the message:
-- the API's grant to update the table leaves it out.
ALTER TABLE platform.outbox_messages
  ADD COLUMN trace_parent text
    CONSTRAINT outbox_messages_trace_parent_check
    CHECK (trace_parent ~ '^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$');

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
