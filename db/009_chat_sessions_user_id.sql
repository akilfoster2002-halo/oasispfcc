-- Scope chat sessions to the owning user so history persists across sign-out/sign-in.
-- Run in Supabase SQL Editor.

-- 1. Add user_id column
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Drop orphaned sessions that have no user (can't be recovered anyway)
DELETE FROM chat_sessions WHERE user_id IS NULL;

-- 3. Make user_id required going forward
ALTER TABLE chat_sessions ALTER COLUMN user_id SET NOT NULL;

-- 4. Enable RLS on both tables
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. chat_sessions policies
CREATE POLICY "own_sessions_select" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own_sessions_insert" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_sessions_update" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "own_sessions_delete" ON chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- 6. chat_messages policies (piggyback on session ownership)
CREATE POLICY "own_messages_select" ON chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );

CREATE POLICY "own_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );

CREATE POLICY "own_messages_delete" ON chat_messages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );
