-- Add missing columns to existing events table for new execution engine
-- The events table already exists from initial_schema.sql
-- This migration adds columns needed by the TypeScript execution engine

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_payload JSONB,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

-- Backfill event_payload from payload_json for existing rows
UPDATE public.events
SET event_payload = payload_json
WHERE event_payload IS NULL AND payload_json IS NOT NULL;

-- Make event_payload NOT NULL after backfill (allow NULL for now to handle migration gracefully)
-- Note: New rows from execution engine will always set event_payload

-- Add index for event_type queries
CREATE INDEX IF NOT EXISTS idx_events_user_type ON public.events(user_id, event_type);

-- Update RLS: events should only be insertable (append-only pattern)
-- Keep existing "Users can CRUD own events" policy for backward compatibility
-- The application layer enforces immutability (no UPDATE/DELETE in client code)
