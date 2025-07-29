/*
  # Fix User Isolation and Report Security Issues
  
  This migration addresses:
  1. Strengthen RLS policies for report_generations table
  2. Add missing UPDATE and DELETE policies for reports
  3. Ensure proper user isolation across all tables
  4. Add performance indexes for user-filtered queries
*/

-- Fix report_generations RLS policies to be more explicit
DROP POLICY IF EXISTS "Users can view own reports" ON report_generations;
DROP POLICY IF EXISTS "Users can create reports" ON report_generations;

-- More explicit and secure policies for report_generations
CREATE POLICY "Users can view only their own reports"
  ON report_generations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create reports for themselves"
  ON report_generations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update only their own reports"
  ON report_generations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete only their own reports"
  ON report_generations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Strengthen chat_sessions RLS to prevent cross-user access
DROP POLICY IF EXISTS "Users can view own chat sessions" ON chat_sessions;
CREATE POLICY "Users can view only their own chat sessions"
  ON chat_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Strengthen chat_messages RLS to prevent cross-user access
DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
CREATE POLICY "Users can view only their own chat messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- Add report_sections policies for user isolation
DROP POLICY IF EXISTS "Users can view report sections" ON report_sections;
CREATE POLICY "Users can view only their own report sections"
  ON report_sections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM report_generations 
      WHERE report_generations.id = report_sections.report_generation_id 
      AND report_generations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create report sections for their reports"
  ON report_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM report_generations 
      WHERE report_generations.id = report_sections.report_generation_id 
      AND report_generations.user_id = auth.uid()
    )
  );

-- Add performance indexes for user-filtered queries
CREATE INDEX IF NOT EXISTS idx_report_generations_user_created 
  ON report_generations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_generations_user_status 
  ON report_generations(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_active 
  ON chat_sessions(user_id, is_active, updated_at DESC);

-- Function to ensure user can only access their own reports
CREATE OR REPLACE FUNCTION check_report_access(report_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM report_generations 
    WHERE id = report_uuid AND user_id = auth.uid()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_report_access(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION check_report_access(UUID) IS 'Checks if the current authenticated user owns the specified report';

-- Ensure all tables have proper RLS enabled
ALTER TABLE report_generations FORCE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE report_sections FORCE ROW LEVEL SECURITY; 