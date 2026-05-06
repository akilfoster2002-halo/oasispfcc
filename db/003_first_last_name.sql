-- Migration: Split name into first_name + last_name, better service querying
-- Run in Supabase SQL Editor

-- 1. Add first_name and last_name to people
ALTER TABLE people ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE people ADD COLUMN IF NOT EXISTS last_name  TEXT NOT NULL DEFAULT '';

-- 2. Backfill from the existing name column
UPDATE people SET
  first_name = trim(split_part(trim(name), ' ', 1)),
  last_name  = trim(substring(trim(name) FROM position(' ' IN trim(name)) + 1))
WHERE name IS NOT NULL AND trim(name) <> '';

-- Clean up any nulls left behind
UPDATE people SET first_name = '' WHERE first_name IS NULL;
UPDATE people SET last_name  = '' WHERE last_name  IS NULL;

-- 3. Indexes for name-based searches
CREATE INDEX IF NOT EXISTS idx_people_first_name ON people(lower(first_name));
CREATE INDEX IF NOT EXISTS idx_people_last_name  ON people(lower(last_name));
