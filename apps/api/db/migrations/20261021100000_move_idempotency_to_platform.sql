-- migrate:up
-- What every module's financial commands share (ADR 0015). The idempotency
-- records move out of the payments schema so the top-ups (v1.1.0 plan, task
-- 5) use the same table without one module writing in another's schema
-- (ADR 0002). SET SCHEMA keeps the rows, the constraints, the indexes and the
-- table's grants; the API role only needs to reach the new schema.

CREATE SCHEMA platform;
GRANT USAGE ON SCHEMA platform TO nextbank_app;

ALTER TABLE payments.idempotency_records SET SCHEMA platform;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
