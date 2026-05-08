-- ============================================================
-- Oasis PFCC — Attendance System
-- Minimal schema: groups → meetings → attendees → attendance
-- Run in Supabase SQL Editor (wipes and rebuilds everything).
-- ============================================================

-- ── Drop everything ──────────────────────────────────────────
DROP TABLE IF EXISTS chat_messages          CASCADE;
DROP TABLE IF EXISTS chat_sessions          CASCADE;
DROP TABLE IF EXISTS sync_log               CASCADE;
DROP TABLE IF EXISTS attendance             CASCADE;
DROP TABLE IF EXISTS meetings               CASCADE;
DROP TABLE IF EXISTS attendees              CASCADE;
DROP TABLE IF EXISTS groups                 CASCADE;

-- Legacy tables from old schema (safe to ignore errors)
DROP TABLE IF EXISTS relationship_history   CASCADE;
DROP TABLE IF EXISTS person_cell_memberships CASCADE;
DROP TABLE IF EXISTS person_group_memberships CASCADE;
DROP TABLE IF EXISTS leaders                CASCADE;
DROP TABLE IF EXISTS events                 CASCADE;
DROP TABLE IF EXISTS people                 CASCADE;
DROP TABLE IF EXISTS cells                  CASCADE;
DROP TABLE IF EXISTS regions                CASCADE;

-- Legacy enums
DROP TYPE IF EXISTS service_type_enum       CASCADE;
DROP TYPE IF EXISTS attendance_status_enum  CASCADE;
DROP TYPE IF EXISTS participation_type_enum CASCADE;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- ── groups ───────────────────────────────────────────────────
-- Ministry groups (CharmCity, LifeSprings, MEGA, etc.)
CREATE TABLE groups (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT  UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── meetings ─────────────────────────────────────────────────
-- Each gathering belongs to exactly one group.
-- meeting_type is free text: "Sunday", "Wednesday", "Cell", etc.
CREATE TABLE meetings (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID  NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  meeting_date  DATE  NOT NULL,
  meeting_type  TEXT  NOT NULL,
  name          TEXT,           -- original event name from import (for reference)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (group_id, meeting_date, name)
);

CREATE INDEX idx_meetings_group_id     ON meetings (group_id);
CREATE INDEX idx_meetings_date         ON meetings (meeting_date);
CREATE INDEX idx_meetings_type         ON meetings (meeting_type);
CREATE INDEX idx_meetings_group_date   ON meetings (group_id, meeting_date);

-- ── attendees ────────────────────────────────────────────────
-- People identified by name only.
-- breeze_id is optional — used only to deduplicate during import,
-- never used as a CRM identifier in analytics queries.
CREATE TABLE attendees (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL,
  breeze_id  BIGINT  UNIQUE,    -- import dedup key only
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attendees_name       ON attendees (name);
CREATE INDEX idx_attendees_breeze_id  ON attendees (breeze_id);

-- ── attendance ───────────────────────────────────────────────
-- Core join: who was at which meeting.
CREATE TABLE attendance (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   UUID  NOT NULL REFERENCES meetings(id)   ON DELETE CASCADE,
  attendee_id  UUID  NOT NULL REFERENCES attendees(id)  ON DELETE CASCADE,
  status       TEXT  NOT NULL DEFAULT 'present',  -- present | absent | late
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (meeting_id, attendee_id)
);

CREATE INDEX idx_attendance_meeting_id   ON attendance (meeting_id);
CREATE INDEX idx_attendance_attendee_id  ON attendance (attendee_id);
CREATE INDEX idx_attendance_status       ON attendance (status);

-- ── chat (persistence for AI chatbot) ────────────────────────
CREATE TABLE chat_sessions (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT  NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID  NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT  NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT  NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session  ON chat_messages (session_id, created_at);
CREATE INDEX idx_chat_sessions_updated  ON chat_sessions (updated_at DESC);

-- ── sync_log ──────────────────────────────────────────────────
CREATE TABLE sync_log (
  id                UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT  NOT NULL,   -- filename or 'breeze_sync'
  group_name        TEXT,
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  meetings_created  INT  DEFAULT 0,
  attendees_created INT  DEFAULT 0,
  attendance_created INT DEFAULT 0,
  status            TEXT DEFAULT 'running',
  error_message     TEXT
);

-- ============================================================
-- ROW LEVEL SECURITY (open for now — service role enforced server-side)
-- ============================================================

ALTER TABLE groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_all" ON groups        FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON meetings      FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON attendees     FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON attendance    FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON chat_sessions FOR ALL USING (TRUE);
CREATE POLICY "open_all" ON chat_messages FOR ALL USING (TRUE);
CREATE POLICY "open_all" ON sync_log      FOR ALL USING (TRUE);

-- ============================================================
-- ANALYTICS FUNCTIONS
-- ============================================================

-- ── attendance_summary ───────────────────────────────────────
-- Per-attendee counts for a group + meeting type + date range.
-- Drives "who attends consistently" and "who stopped attending".
CREATE OR REPLACE FUNCTION attendance_summary(
  p_group_name   TEXT,
  p_meeting_type TEXT,    -- NULL = all types
  p_from_date    DATE,
  p_to_date      DATE
)
RETURNS TABLE (
  attendee_id    UUID,
  name           TEXT,
  times_attended BIGINT,
  first_seen     DATE,
  last_seen      DATE
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    a.id            AS attendee_id,
    a.name,
    COUNT(att.id)   AS times_attended,
    MIN(m.meeting_date) AS first_seen,
    MAX(m.meeting_date) AS last_seen
  FROM attendees a
  JOIN attendance att ON att.attendee_id = a.id
  JOIN meetings   m   ON m.id = att.meeting_id
  JOIN groups     g   ON g.id = m.group_id
  WHERE
    att.status = 'present'
    AND m.meeting_date BETWEEN p_from_date AND p_to_date
    AND (p_group_name   IS NULL OR g.name ILIKE '%' || p_group_name || '%')
    AND (p_meeting_type IS NULL OR m.meeting_type ILIKE '%' || p_meeting_type || '%')
  GROUP BY a.id, a.name
  ORDER BY times_attended DESC;
$$;

-- ── detect_transfers ─────────────────────────────────────────
-- People whose most recent attendance is in a DIFFERENT group than their most frequent group.
-- Returns only people who appear in 2+ groups within the date range.
CREATE OR REPLACE FUNCTION detect_transfers(
  p_from_date DATE,
  p_to_date   DATE
)
RETURNS TABLE (
  attendee_id    UUID,
  name           TEXT,
  primary_group  TEXT,
  recent_group   TEXT,
  primary_count  BIGINT,
  recent_count   BIGINT
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  WITH per_group AS (
    SELECT
      a.id           AS attendee_id,
      a.name,
      g.name         AS group_name,
      COUNT(att.id)  AS cnt,
      MAX(m.meeting_date) AS last_date
    FROM attendees a
    JOIN attendance att ON att.attendee_id = a.id
    JOIN meetings   m   ON m.id = att.meeting_id
    JOIN groups     g   ON g.id = m.group_id
    WHERE att.status = 'present'
      AND m.meeting_date BETWEEN p_from_date AND p_to_date
    GROUP BY a.id, a.name, g.name
  ),
  multi_group AS (
    SELECT attendee_id
    FROM per_group
    GROUP BY attendee_id
    HAVING COUNT(DISTINCT group_name) > 1
  ),
  ranked AS (
    SELECT
      pg.*,
      ROW_NUMBER() OVER (PARTITION BY attendee_id ORDER BY cnt DESC)         AS rank_by_count,
      ROW_NUMBER() OVER (PARTITION BY attendee_id ORDER BY last_date DESC)   AS rank_by_recency
    FROM per_group pg
    WHERE pg.attendee_id IN (SELECT attendee_id FROM multi_group)
  )
  SELECT
    freq.attendee_id,
    freq.name,
    freq.group_name   AS primary_group,
    recent.group_name AS recent_group,
    freq.cnt          AS primary_count,
    recent.cnt        AS recent_count
  FROM ranked freq
  JOIN ranked recent ON recent.attendee_id = freq.attendee_id
    AND recent.rank_by_recency = 1
  WHERE freq.rank_by_count = 1
    AND freq.group_name != recent.group_name
  ORDER BY freq.name;
$$;

-- ── meeting_headcounts ───────────────────────────────────────
-- Headcount per meeting for a group + date range.
CREATE OR REPLACE FUNCTION meeting_headcounts(
  p_group_name   TEXT,
  p_meeting_type TEXT,
  p_from_date    DATE,
  p_to_date      DATE
)
RETURNS TABLE (
  meeting_id    UUID,
  meeting_date  DATE,
  meeting_type  TEXT,
  group_name    TEXT,
  headcount     BIGINT
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    m.id           AS meeting_id,
    m.meeting_date,
    m.meeting_type,
    g.name         AS group_name,
    COUNT(att.id)  AS headcount
  FROM meetings m
  JOIN groups   g   ON g.id = m.group_id
  LEFT JOIN attendance att ON att.meeting_id = m.id AND att.status = 'present'
  WHERE
    m.meeting_date BETWEEN p_from_date AND p_to_date
    AND (p_group_name   IS NULL OR g.name ILIKE '%' || p_group_name || '%')
    AND (p_meeting_type IS NULL OR m.meeting_type ILIKE '%' || p_meeting_type || '%')
  GROUP BY m.id, m.meeting_date, m.meeting_type, g.name
  ORDER BY m.meeting_date DESC;
$$;
