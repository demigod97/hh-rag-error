-- Enable realtime for chat functionality
-- This migration enables realtime subscriptions for chat_messages table

-- Enable realtime for chat_messages table
ALTER publication supabase_realtime ADD TABLE chat_messages;

-- Enable realtime for chat_sessions table (for session updates)  
ALTER publication supabase_realtime ADD TABLE chat_sessions;

-- Create indexes for better realtime performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_realtime 
  ON chat_messages(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_realtime
  ON chat_messages(user_id, created_at DESC);

-- Add trigger to update session timestamp when messages are added
CREATE OR REPLACE FUNCTION update_session_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions 
  SET updated_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session updates
DROP TRIGGER IF EXISTS trigger_update_session_on_message ON chat_messages;
CREATE TRIGGER trigger_update_session_on_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_last_message();

-- Ensure RLS is properly configured for realtime
-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS "Users can view own chat messages realtime" ON chat_messages;
DROP POLICY IF EXISTS "Users can create own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "System can create assistant messages" ON chat_messages;

-- Users can only see messages from their own sessions
CREATE POLICY "Users can view own chat messages realtime"
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

-- Allow users to insert their own messages
CREATE POLICY "Users can create own chat messages"
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

-- Allow system to insert assistant messages (for edge functions)
CREATE POLICY "System can create assistant messages"
  ON chat_messages
  FOR INSERT
  TO service_role
  WITH CHECK (role = 'assistant');

-- Grant realtime access
GRANT SELECT ON chat_messages TO anon;
GRANT SELECT ON chat_messages TO authenticated;
GRANT INSERT ON chat_messages TO authenticated;

-- Comment for tracking
COMMENT ON TABLE chat_messages IS 'Realtime enabled for chat functionality'; 