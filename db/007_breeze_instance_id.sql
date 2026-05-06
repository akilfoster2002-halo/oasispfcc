-- Add breeze_instance_id to meetings so attendance sync can upsert by event
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS breeze_instance_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_meetings_breeze_instance_id ON meetings(breeze_instance_id);
