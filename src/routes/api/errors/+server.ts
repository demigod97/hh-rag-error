// Error logging API endpoint
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/api';

export async function POST({ request }) {
  try {
    const errorData = await request.json();
    
    // Store error in database for analysis
    const { error } = await supabase
      .from('error_logs')
      .insert({
        error_type: errorData.type,
        severity: errorData.severity,
        message: errorData.message,
        user_message: errorData.userMessage,
        error_code: errorData.code,
        details: errorData.details,
        context: errorData.context,
        user_id: errorData.userId,
        session_id: errorData.sessionId,
        user_agent: errorData.userAgent,
        url: errorData.url,
        timestamp: errorData.timestamp
      });

    if (error) {
      console.error('Failed to log error:', error);
      return json({ success: false }, { status: 500 });
    }

    // For critical errors, could trigger alerts to development team
    if (errorData.severity === 'CRITICAL') {
      // Send to monitoring service, Slack, etc.
      console.error('CRITICAL ERROR LOGGED:', errorData);
    }

    return json({ success: true });
  } catch (e) {
    console.error('Error logging endpoint failed:', e);
    return json({ success: false }, { status: 500 });
  }
}