-- Migration: User Isolation and Deletion Policies
-- Description: Ensures users can only access their own data and provides deletion capabilities

-- Enable RLS on all user-related tables if not already enabled
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_generations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON chat_sessions;

DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can create chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can update own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete own chat messages" ON chat_messages;

DROP POLICY IF EXISTS "Users can view own reports" ON report_generations;
DROP POLICY IF EXISTS "Users can create reports" ON report_generations;
DROP POLICY IF EXISTS "Users can update own reports" ON report_generations;
DROP POLICY IF EXISTS "Users can delete own reports" ON report_generations;

-- Chat Sessions Policies
CREATE POLICY "Users can view own chat sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
  ON chat_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions"
  ON chat_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Chat Messages Policies
CREATE POLICY "Users can view own chat messages"
  ON chat_messages FOR SELECT
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own chat messages"
  ON chat_messages FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own chat messages"
  ON chat_messages FOR DELETE
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- Report Generations Policies  
CREATE POLICY "Users can view own reports"
  ON report_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create reports"
  ON report_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON report_generations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON report_generations FOR DELETE
  USING (auth.uid() = user_id);

-- Create function for cascading chat session deletion
CREATE OR REPLACE FUNCTION delete_chat_session_cascade(session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the user owns this session
  IF NOT EXISTS (
    SELECT 1 FROM chat_sessions 
    WHERE id = session_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only delete your own chat sessions';
  END IF;

  -- Delete all messages in the session first
  DELETE FROM chat_messages 
  WHERE chat_messages.session_id = delete_chat_session_cascade.session_id;
  
  -- Delete the session
  DELETE FROM chat_sessions 
  WHERE id = delete_chat_session_cascade.session_id;
END;
$$;

-- Create function for deleting all user chat history
CREATE OR REPLACE FUNCTION delete_all_user_chat_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all messages for this user
  DELETE FROM chat_messages 
  WHERE user_id = auth.uid();
  
  -- Delete all sessions for this user
  DELETE FROM chat_sessions 
  WHERE user_id = auth.uid();
END;
$$;

-- Create function for deleting user's report generations
CREATE OR REPLACE FUNCTION delete_user_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all report generations for this user
  DELETE FROM report_generations 
  WHERE user_id = auth.uid();
END;
$$;

-- Grant execute permissions on the functions to authenticated users
GRANT EXECUTE ON FUNCTION delete_chat_session_cascade TO authenticated;
GRANT EXECUTE ON FUNCTION delete_all_user_chat_history TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_reports TO authenticated; 