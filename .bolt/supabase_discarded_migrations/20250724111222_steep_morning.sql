/*
  # Add Error Logging Table

  1. New Tables
    - `error_logs`
      - `id` (uuid, primary key)
      - `error_type` (text)
      - `severity` (text)
      - `message` (text)
      - `user_message` (text)
      - `error_code` (text, nullable)
      - `details` (jsonb, nullable)
      - `context` (jsonb, nullable)
      - `user_id` (uuid, nullable)
      - `session_id` (text, nullable)
      - `user_agent` (text, nullable)
      - `url` (text, nullable)
      - `timestamp` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `error_logs` table
    - Add policy for service role to insert errors
    - Add policy for admins to read error logs

  3. Indexes
    - Index on timestamp for efficient querying
    - Index on error_type and severity for filtering
    - Index on user_id for user-specific error analysis
*/

-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  message text NOT NULL,
  user_message text NOT NULL,
  error_code text,
  details jsonb DEFAULT '{}',
  context jsonb DEFAULT '{}',
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id text,
  user_agent text,
  url text,
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_type_severity ON error_logs(error_type, severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);

-- RLS Policies
CREATE POLICY "Service role can insert error logs"
  ON error_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can read all error logs"
  ON error_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read own error logs"
  ON error_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create view for error analytics
CREATE OR REPLACE VIEW error_analytics AS
SELECT 
  error_type,
  severity,
  COUNT(*) as occurrence_count,
  COUNT(DISTINCT user_id) as affected_users,
  MIN(timestamp) as first_occurrence,
  MAX(timestamp) as last_occurrence,
  AVG(EXTRACT(EPOCH FROM (created_at - timestamp))) as avg_reporting_delay
FROM error_logs 
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY error_type, severity
ORDER BY occurrence_count DESC;

-- Function to clean up old error logs
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Keep only last 30 days of error logs
  DELETE FROM error_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Keep only last 1000 logs per user to prevent unbounded growth
  WITH ranked_logs AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM error_logs
    WHERE user_id IS NOT NULL
  )
  DELETE FROM error_logs 
  WHERE id IN (
    SELECT id FROM ranked_logs WHERE rn > 1000
  );
END;
$$;

-- Schedule cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-error-logs', '0 2 * * *', 'SELECT cleanup_old_error_logs();');