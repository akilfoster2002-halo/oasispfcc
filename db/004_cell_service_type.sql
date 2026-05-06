-- Migration: Add 'cell' service type for cell group meeting attendance
-- Run in Supabase SQL Editor BEFORE running scripts/import-cells.ts

-- Drop the auto-named check constraint on service_type (finds it by pattern)
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'meetings'::regclass
    AND contype = 'c'
    AND conname ILIKE '%service_type%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE meetings DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

-- Add updated constraint that includes 'cell'
ALTER TABLE meetings
  ADD CONSTRAINT meetings_service_type_check
  CHECK (service_type IN ('sunday_inperson', 'sunday_online', 'midweek', 'cell'));

-- Index for fast cell meeting queries
CREATE INDEX IF NOT EXISTS idx_meetings_cell ON meetings(service_type, date)
  WHERE service_type = 'cell';
