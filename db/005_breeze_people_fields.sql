-- Migration: Add Breeze profile fields to people table
-- Run in Supabase SQL Editor before running scripts/sync-breeze-people.ts

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS address        TEXT,
  ADD COLUMN IF NOT EXISTS gender         TEXT,
  ADD COLUMN IF NOT EXISTS birthdate      DATE,
  ADD COLUMN IF NOT EXISTS group_name     TEXT,
  ADD COLUMN IF NOT EXISTS pastor         TEXT,
  ADD COLUMN IF NOT EXISTS designation    TEXT,
  ADD COLUMN IF NOT EXISTS cell_name      TEXT,
  ADD COLUMN IF NOT EXISTS fellowship     TEXT,
  ADD COLUMN IF NOT EXISTS who_invited    TEXT,
  ADD COLUMN IF NOT EXISTS joined_oasis   TEXT,
  ADD COLUMN IF NOT EXISTS baptized       TEXT,
  ADD COLUMN IF NOT EXISTS foundation_school          TEXT,
  ADD COLUMN IF NOT EXISTS foundation_school_grad_year TEXT,
  ADD COLUMN IF NOT EXISTS school                     TEXT,
  ADD COLUMN IF NOT EXISTS major                      TEXT,
  ADD COLUMN IF NOT EXISTS profession                 TEXT,
  ADD COLUMN IF NOT EXISTS marital_status             TEXT,
  ADD COLUMN IF NOT EXISTS state                      TEXT,
  ADD COLUMN IF NOT EXISTS unique_id                  TEXT,
  ADD COLUMN IF NOT EXISTS breeze_synced_at           TIMESTAMPTZ;

-- Indexes for common AI/filter queries
CREATE INDEX IF NOT EXISTS idx_people_designation  ON people(designation);
CREATE INDEX IF NOT EXISTS idx_people_group_name   ON people(group_name);
CREATE INDEX IF NOT EXISTS idx_people_pastor        ON people(pastor);
CREATE INDEX IF NOT EXISTS idx_people_baptized      ON people(baptized);
CREATE INDEX IF NOT EXISTS idx_people_cell_name     ON people(cell_name);
