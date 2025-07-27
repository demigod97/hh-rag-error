// Enhanced session management with proper database integration
import { supabase } from './api';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export interface ChatSession {
  id: string;
  title: string;
  notebook_id: string;
  user_id: string;
  total_messages: number;
  last_message_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  source_ids: string[];
}

export class SessionManager {
  private static instance: SessionManager;
  private currentSessionId: string | null = null;
  private sessionCache = new Map<string, ChatSession>();

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Get or create a valid session, with proper error handling and fallbacks
   */
  async getOrCreateSession(
    preferredSessionId?: string,
    notebookId?: string
  ): Promise<string> {
    try {
      // 1. Check if we have a preferred session ID (from URL or localStorage)
      if (preferredSessionId) {
        const session = await this.validateSession(preferredSessionId);
        if (session) {
          this.currentSessionId = preferredSessionId;
          this.sessionCache.set(preferredSessionId, session);
          return preferredSessionId;
        }
      }

      // 2. Check localStorage for backup session
      const backupSessionId = localStorage.getItem('currentSessionId');
      if (backupSessionId && backupSessionId !== preferredSessionId) {
        const session = await this.validateSession(backupSessionId);
        if (session) {
          this.currentSessionId = backupSessionId;
          this.sessionCache.set(backupSessionId, session);
          return backupSessionId;
        }
      }

      // 3. Create new session if none found or all invalid
      const newSessionId = await this.createNewSession(notebookId);
      this.currentSessionId = newSessionId;
      
      // Store in localStorage as backup
      localStorage.setItem('currentSessionId', newSessionId);
      
      return newSessionId;

    } catch (error) {
      console.error('Session management error:', error);
      
      // Ultimate fallback - create session with minimal data
      try {
        const fallbackSessionId = await this.createFallbackSession();
        this.currentSessionId = fallbackSessionId;
        return fallbackSessionId;
      } catch (fallbackError) {
        console.error('Fallback session creation failed:', fallbackError);
        throw new Error('Unable to create or access chat session');
      }
    }
  }

  /**
   * Validate that a session exists and belongs to the current user
   */
  private async validateSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.warn(`Session ${sessionId} validation failed:`, error);
        return null;
      }

      return session as ChatSession;
    } catch (error) {
      console.warn(`Session ${sessionId} validation error:`, error);
      return null;
    }
  }

  /**
   * Create a new chat session with proper error handling
   */
  async createNewSession(notebookId?: string): Promise<string> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User authentication required');
      }

      // Get or create default notebook if none provided
      let targetNotebookId = notebookId;
      if (!targetNotebookId) {
        targetNotebookId = await this.getOrCreateDefaultNotebook(user.id);
      }

      // Use the database function to create session
      const { data: sessionId, error: sessionError } = await supabase
        .rpc('create_chat_session', {
          user_uuid: user.id,
          notebook_uuid: targetNotebookId,
          session_title: `Chat - ${new Date().toLocaleString()}`
        });

      if (sessionError) throw sessionError;

      // Fetch the created session for caching
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (session) {
        this.sessionCache.set(sessionId, session as ChatSession);
      }

      return sessionId;

    } catch (error) {
      console.error('Failed to create new session:', error);
      throw error;
    }
  }

  /**
   * Create fallback session with minimal requirements
   */
  private async createFallbackSession(): Promise<string> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Authentication required for fallback session');
    }

    // Direct insert as last resort
    const { data: session, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        title: `Emergency Session - ${new Date().toLocaleString()}`,
        total_messages: 0,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return session.id;
  }

  /**
   * Get or create default notebook for user
   */
  private async getOrCreateDefaultNotebook(userId: string): Promise<string> {
    try {
      // Use the database function
      const { data: notebookId, error } = await supabase
        .rpc('get_or_create_default_notebook', {
          user_uuid: userId
        });

      if (error) throw error;
      return notebookId;

    } catch (error) {
      console.error('Failed to get/create default notebook:', error);
      
      // Fallback: try direct creation
      const { data: notebook, error: createError } = await supabase
        .from('notebooks')
        .insert({
          user_id: userId,
          name: 'Default Notebook',
          project_type: 'general',
          project_status: 'active'
        })
        .select()
        .single();

      if (createError) throw createError;
      return notebook.id;
    }
  }

  /**
   * Get all chat sessions for current user
   */
  async getChatSessions(): Promise<ChatSession[]> {
    try {
      const { data: sessions, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Update cache
      sessions?.forEach(session => {
        this.sessionCache.set(session.id, session as ChatSession);
      });

      return (sessions || []) as ChatSession[];

    } catch (error) {
      console.error('Failed to fetch chat sessions:', error);
      return [];
    }
  }

  /**
   * Switch to a different session
   */
  async switchToSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.validateSession(sessionId);
      if (!session) {
        throw new Error('Session not found or not accessible');
      }

      this.currentSessionId = sessionId;
      localStorage.setItem('currentSessionId', sessionId);
      
      // Update URL without page reload
      const url = new URL(window.location.href);
      url.searchParams.set('sessionId', sessionId);
      window.history.pushState({}, '', url.toString());

      return true;

    } catch (error) {
      console.error('Failed to switch session:', error);
      return false;
    }
  }

  /**
   * Create a new session and switch to it
   */
  async createAndSwitchToNewSession(notebookId?: string): Promise<string> {
    try {
      const newSessionId = await this.createNewSession(notebookId);
      await this.switchToSession(newSessionId);
      return newSessionId;
    } catch (error) {
      console.error('Failed to create and switch to new session:', error);
      throw error;
    }
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Clear session cache and reset
   */
  clearCache(): void {
    this.sessionCache.clear();
    this.currentSessionId = null;
    localStorage.removeItem('currentSessionId');
  }

  /**
   * Get session from cache or database
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    // Check cache first
    if (this.sessionCache.has(sessionId)) {
      return this.sessionCache.get(sessionId)!;
    }

    // Fetch from database
    return await this.validateSession(sessionId);
  }
}

// Hook for using session management in React components
export function useSessionManager() {
  const sessionManager = SessionManager.getInstance();
  const { handleAsyncError } = useErrorHandler();

  const getOrCreateSession = async (preferredSessionId?: string, notebookId?: string) => {
    return await handleAsyncError(
      () => sessionManager.getOrCreateSession(preferredSessionId, notebookId),
      { operation: 'get_or_create_session', preferredSessionId, notebookId }
    );
  };

  const createNewSession = async (notebookId?: string) => {
    return await handleAsyncError(
      () => sessionManager.createAndSwitchToNewSession(notebookId),
      { operation: 'create_new_session', notebookId }
    );
  };

  const switchSession = async (sessionId: string) => {
    return await handleAsyncError(
      () => sessionManager.switchToSession(sessionId),
      { operation: 'switch_session', sessionId }
    );
  };

  const getChatSessions = async () => {
    return await handleAsyncError(
      () => sessionManager.getChatSessions(),
      { operation: 'get_chat_sessions' }
    );
  };

  return {
    getOrCreateSession,
    createNewSession,
    switchSession,
    getChatSessions,
    getCurrentSessionId: () => sessionManager.getCurrentSessionId(),
    clearCache: () => sessionManager.clearCache()
  };
}