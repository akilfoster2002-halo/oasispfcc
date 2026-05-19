-- ============================================================
-- Church-Link — Full Schema (Breeze-structured, multi-tenant)
-- Run in Supabase SQL Editor to wipe and rebuild everything.
-- ============================================================

-- ── Drop everything ───────────────────────────────────────────
DROP TABLE IF EXISTS chat_messages          CASCADE;
DROP TABLE IF EXISTS chat_sessions          CASCADE;
DROP TABLE IF EXISTS sms_messages           CASCADE;
DROP TABLE IF EXISTS campaign_recipients    CASCADE;
DROP TABLE IF EXISTS campaigns              CASCADE;
DROP TABLE IF EXISTS conversations          CASCADE;
DROP TABLE IF EXISTS sync_log               CASCADE;
DROP TABLE IF EXISTS attendance             CASCADE;
DROP TABLE IF EXISTS events                 CASCADE;
DROP TABLE IF EXISTS people                 CASCADE;
DROP TABLE IF EXISTS cells                  CASCADE;
DROP TABLE IF EXISTS groups                 CASCADE;
DROP TABLE IF EXISTS dataplug               CASCADE;
DROP TABLE IF EXISTS meetings               CASCADE;
DROP TABLE IF EXISTS attendees              CASCADE;
DROP TABLE IF EXISTS church_invites         CASCADE;
DROP TABLE IF EXISTS church_memberships     CASCADE;
DROP TABLE IF EXISTS user_profiles          CASCADE;
DROP TABLE IF EXISTS churches               CASCADE;

DROP TYPE IF EXISTS service_type_enum       CASCADE;
DROP TYPE IF EXISTS attendance_status_enum  CASCADE;
DROP TYPE IF EXISTS participation_type_enum CASCADE;

-- ============================================================
-- MULTI-TENANT CORE
-- ============================================================

CREATE TABLE churches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Links auth.users to legacy app roles
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'group',
  group_id   UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE church_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id  UUID NOT NULL REFERENCES churches(id)   ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  status     TEXT NOT NULL DEFAULT 'pending',
  joined_via TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, church_id)
);

CREATE TABLE church_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  token       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status      TEXT NOT NULL DEFAULT 'pending',
  created_by  UUID REFERENCES auth.users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BREEZE DATA MODEL
-- ============================================================

-- Ministry groups (CharmCity, LifeSprings, MEGA, etc.)
CREATE TABLE groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id  UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, name)
);

-- Small groups / home cells
CREATE TABLE cells (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id  UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, name)
);

-- All Breeze person fields
CREATE TABLE people (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id                    UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  breeze_id                    BIGINT,
  first_name                   TEXT NOT NULL DEFAULT '',
  last_name                    TEXT NOT NULL DEFAULT '',
  email                        TEXT,
  phone                        TEXT,
  address                      TEXT,
  gender                       TEXT,
  birthdate                    DATE,
  group_name                   TEXT,
  pastor                       TEXT,
  designation                  TEXT,
  cell_name                    TEXT,
  fellowship                   TEXT,
  who_invited                  TEXT,
  joined_oasis                 TEXT,
  baptized                     TEXT,
  foundation_school            TEXT,
  foundation_school_grad_year  TEXT,
  school                       TEXT,
  major                        TEXT,
  profession                   TEXT,
  marital_status               TEXT,
  state                        TEXT,
  unique_id                    TEXT,
  breeze_synced_at             TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, breeze_id)
);

CREATE INDEX idx_people_church      ON people (church_id);
CREATE INDEX idx_people_breeze_id   ON people (breeze_id);
CREATE INDEX idx_people_name        ON people (first_name, last_name);
CREATE INDEX idx_people_designation ON people (designation);
CREATE INDEX idx_people_group_name  ON people (group_name);
CREATE INDEX idx_people_pastor      ON people (pastor);
CREATE INDEX idx_people_baptized    ON people (baptized);
CREATE INDEX idx_people_cell_name   ON people (cell_name);
CREATE INDEX idx_people_fellowship  ON people (fellowship);

-- Breeze events (one row per occurrence / instance)
CREATE TABLE events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id          UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  breeze_instance_id TEXT UNIQUE,
  breeze_event_id    TEXT,
  name               TEXT NOT NULL,
  service_type       TEXT NOT NULL DEFAULT 'other',
  event_date         DATE NOT NULL,
  event_datetime     TIMESTAMPTZ,
  group_id           UUID REFERENCES groups(id) ON DELETE SET NULL,
  cell_id            UUID REFERENCES cells(id)  ON DELETE SET NULL,
  hybrid_status      TEXT DEFAULT 'inperson',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_church ON events (church_id);
CREATE INDEX idx_events_date   ON events (event_date);
CREATE INDEX idx_events_type   ON events (service_type);
CREATE INDEX idx_events_group  ON events (group_id);

-- Who attended which event
CREATE TABLE attendance (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id            UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id            UUID NOT NULL REFERENCES people(id)   ON DELETE CASCADE,
  event_id             UUID NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  attendance_status    TEXT NOT NULL DEFAULT 'present',
  check_in_time        TIMESTAMPTZ,
  imported_from_breeze BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (person_id, event_id)
);

CREATE INDEX idx_attendance_person ON attendance (person_id);
CREATE INDEX idx_attendance_event  ON attendance (event_id);
CREATE INDEX idx_attendance_church ON attendance (church_id);

-- Sync job tracking
CREATE TABLE sync_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         UUID REFERENCES churches(id) ON DELETE SET NULL,
  sync_type         TEXT NOT NULL DEFAULT 'attendance',
  status            TEXT NOT NULL DEFAULT 'running',
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  records_processed INT DEFAULT 0,
  records_created   INT DEFAULT 0,
  error_message     TEXT
);

-- ============================================================
-- AI CHATBOT
-- ============================================================

CREATE TABLE chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id  UUID REFERENCES churches(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages (session_id, created_at);
CREATE INDEX idx_chat_sessions_updated ON chat_sessions (updated_at DESC);

-- ============================================================
-- MESSAGING
-- ============================================================

CREATE TABLE campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id        UUID REFERENCES churches(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  command          TEXT,
  created_by       TEXT DEFAULT 'admin',
  status           TEXT NOT NULL DEFAULT 'draft',
  total_recipients INT  NOT NULL DEFAULT 0,
  sent_count       INT  NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaign_recipients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  person_id         UUID REFERENCES people(id) ON DELETE SET NULL,
  name              TEXT,
  phone             TEXT NOT NULL,
  generated_message TEXT,
  delivery_status   TEXT NOT NULL DEFAULT 'pending',
  response_status   TEXT NOT NULL DEFAULT 'none',
  clearstream_id    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       UUID REFERENCES churches(id) ON DELETE CASCADE,
  person_id       UUID REFERENCES people(id)   ON DELETE SET NULL,
  phone           TEXT NOT NULL,
  name            TEXT,
  status          TEXT NOT NULL DEFAULT 'new_visitor',
  assigned_leader TEXT,
  ai_summary      TEXT,
  is_sensitive    BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sms_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL,
  body            TEXT NOT NULL,
  ai_generated    BOOLEAN NOT NULL DEFAULT FALSE,
  approved        BOOLEAN NOT NULL DEFAULT FALSE,
  clearstream_id  TEXT,
  tone            TEXT,
  pastoral_note   TEXT,
  is_sensitive    BOOLEAN DEFAULT FALSE,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (open — enforcement at API layer)
-- ============================================================

ALTER TABLE churches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_memberships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_invites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cells               ENABLE ROW LEVEL SECURITY;
ALTER TABLE people              ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_all" ON churches            FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON user_profiles       FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON church_memberships  FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON church_invites      FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON groups              FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON cells               FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON people              FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON events              FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON attendance          FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON sync_log            FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON chat_sessions       FOR ALL USING (TRUE);
CREATE POLICY "open_all" ON chat_messages       FOR ALL USING (TRUE);
CREATE POLICY "open_all" ON campaigns           FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON campaign_recipients FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON conversations       FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "open_all" ON sms_messages        FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- AI CHATBOT — safe read-only SQL execution
-- ============================================================

CREATE OR REPLACE FUNCTION run_query(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  IF sql !~* '^\s*(SELECT|WITH\b)' THEN
    RAISE EXCEPTION 'Only SELECT statements are allowed';
  END IF;
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- ============================================================
-- SEED: PFCC church + ministry groups
-- ============================================================

INSERT INTO churches (name, slug) VALUES ('Oasis PFCC', 'pfcc')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO groups (church_id, name)
SELECT c.id, g.name
FROM churches c, (VALUES
  ('MEGA'),
  ('CharmCity'),
  ('Zone B'),
  ('LifeSprings'),
  ('Vanguards'),
  ('Trailblazers'),
  ('Missions'),
  ('Capital City')
) AS g(name)
WHERE c.slug = 'pfcc'
ON CONFLICT (church_id, name) DO NOTHING;
