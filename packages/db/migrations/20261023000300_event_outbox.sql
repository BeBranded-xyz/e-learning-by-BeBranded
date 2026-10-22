-- Migration: 20261023000300_event_outbox
-- Author: BeBranded maintainers
-- Date: 2026-10-23
-- Description: Creates the event outbox (spec 04, section 5): events are
--   written in the same transaction as the state change, then delivered at
--   least once to the host's handlers.
-- Dependencies: none
-- Rollback: DROP TABLE event_outbox.
--
-- Changes:
--   - table event_outbox, with RLS enabled

CREATE TABLE event_outbox (
  id uuid PRIMARY KEY,
  tenant_id text NULL,
  type text NOT NULL CHECK (length(type) BETWEEN 1 AND 100),
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text NULL CHECK (length(last_error) <= 1000)
);
-- Partial index: delivery only ever scans undelivered events.
CREATE INDEX idx_event_outbox_pending ON event_outbox (next_attempt_at) WHERE delivered_at IS NULL;
CREATE INDEX idx_event_outbox_tenant_id ON event_outbox (tenant_id);
ALTER TABLE event_outbox ENABLE ROW LEVEL SECURITY;
COMMENT ON COLUMN event_outbox.id IS 'Event id, also the idempotency key for host handlers.';
COMMENT ON COLUMN event_outbox.next_attempt_at IS 'Earliest next delivery; also the lease of a claimed event.';
COMMENT ON COLUMN event_outbox.last_error IS 'Truncated error message of the last failed delivery, without payload data.';
