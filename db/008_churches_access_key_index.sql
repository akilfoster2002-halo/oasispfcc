-- 008_churches_access_key_index.sql
-- Index for the access-key signup lookup (POST /api/auth/signup and /api/auth/join-with-key).
-- Without this, every signup with a key triggers a sequential scan of `churches`.
-- Partial index keeps it tiny: only churches with a key set are indexed.

CREATE INDEX IF NOT EXISTS idx_churches_access_key
  ON churches (access_key)
  WHERE access_key IS NOT NULL;
