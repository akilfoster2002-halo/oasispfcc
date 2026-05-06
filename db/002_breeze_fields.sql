-- Migration: Add Breeze ChMS import support
-- Run this in the Supabase SQL Editor before running scripts/import-breeze.ts

-- 1. Add breeze_id to people (Breeze's numeric ID for each person)
ALTER TABLE people ADD COLUMN IF NOT EXISTS breeze_id BIGINT UNIQUE;

-- 2. Add service_type to meetings (distinguishes Sunday in-person vs Sunday online vs midweek)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS service_type TEXT
  CHECK (service_type IN ('sunday_inperson', 'sunday_online', 'midweek'));

-- 3. Add unique constraint on (date, title) so the import script can upsert safely
DO $$ BEGIN
  ALTER TABLE meetings ADD CONSTRAINT meetings_date_title_unique UNIQUE (date, title);
EXCEPTION WHEN others THEN NULL;
END $$;

-- 4. Index for breeze_id lookups
CREATE INDEX IF NOT EXISTS idx_people_breeze_id ON people(breeze_id);
CREATE INDEX IF NOT EXISTS idx_meetings_service_type ON meetings(service_type);
