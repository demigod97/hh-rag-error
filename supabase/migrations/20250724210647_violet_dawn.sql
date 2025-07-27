/*
  # Fix RLS Policies for Town Planner Application

  1. Security Updates
    - Enable RLS on all tables that need it
    - Fix chat_sessions and chat_messages policies
    - Ensure proper user isolation
    - Add storage bucket policies

  2. Real-time Subscriptions
    - Configure proper policies for real-time updates
    - Ensure users can only subscribe to their own data

  3. Performance Optimizations
    - Add missing indexes for real-time queries
    - Optimize RLS policy performance
*/

-- Enable RLS on tables that don't have it yet
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Fix chat_sessions policies
DROP POLICY IF EXISTS "Users can view own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON chat_sessions;

CREATE POLICY "Users can view own chat sessions"
  ON chat_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create chat sessions"
  ON chat_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chat sessions"
  ON chat_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own chat sessions"
  ON chat_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Fix chat_messages policies
DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can create chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can update own chat messages" ON chat_messages;

CREATE POLICY "Users can view own chat messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create chat messages"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- Add missing user_id column to chat_messages if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add missing user_id column to chat_sessions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_sessions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE chat_sessions ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for real-time performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_user 
  ON chat_messages(session_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated 
  ON chat_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sources_notebook_user 
  ON sources(notebook_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_generations_notebook_user 
  ON report_generations(notebook_id, user_id, created_at DESC);

-- Storage bucket policies for reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  52428800, -- 50MB
  ARRAY['text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for reports bucket
CREATE POLICY "Users can upload their own reports"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own reports"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own reports"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own reports"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage bucket policies for sources
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sources',
  'sources',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for sources bucket
CREATE POLICY "Users can upload their own sources"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sources' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own sources"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sources' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own sources"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sources' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Function to update chat session stats
CREATE OR REPLACE FUNCTION update_chat_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_messages count and last_message_at
  UPDATE chat_sessions 
  SET 
    total_messages = (
      SELECT COUNT(*) 
      FROM chat_messages 
      WHERE session_id = NEW.session_id
    ),
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update session stats when messages are added
DROP TRIGGER IF EXISTS trigger_update_chat_session_stats ON chat_messages;
CREATE TRIGGER trigger_update_chat_session_stats
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_stats();

-- Add total_messages column to chat_sessions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_sessions' AND column_name = 'total_messages'
  ) THEN
    ALTER TABLE chat_sessions ADD COLUMN total_messages integer DEFAULT 0;
  END IF;
END $$;

-- Add last_message_at column to chat_sessions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_sessions' AND column_name = 'last_message_at'
  ) THEN
    ALTER TABLE chat_sessions ADD COLUMN last_message_at timestamptz;
  END IF;
END $$;

-- Update existing sessions with message counts
UPDATE chat_sessions 
SET total_messages = (
  SELECT COUNT(*) 
  FROM chat_messages 
  WHERE chat_messages.session_id = chat_sessions.id
),
last_message_at = (
  SELECT MAX(created_at)
  FROM chat_messages 
  WHERE chat_messages.session_id = chat_sessions.id
)
WHERE total_messages IS NULL OR total_messages = 0;