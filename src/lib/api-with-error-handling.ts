// Enhanced API functions with comprehensive error handling
import { supabase } from './api';
import { 
  ErrorHandler, 
  RetryHandler, 
  GracefulDegradation, 
  OfflineQueue,
  NetworkMonitor,
  validateRequired,
  validateFileSize,
  validateFileType,
  validateEmail
} from './error-handling';

// Enhanced file upload with error handling and offline support
export async function uploadFileWithErrorHandling(
  file: File, 
  notebookId: string, 
  userQuery?: string
) {
  try {
    // Validate inputs
    validateRequired(file, 'File');
    validateRequired(notebookId, 'Notebook ID');
    validateFileSize(file, 50); // 50MB limit
    validateFileType(file, ['application/pdf']);

    // Check if offline
    if (!NetworkMonitor.getInstance().isOnlineStatus()) {
      const queueId = OfflineQueue.getInstance().addToQueue(
        'upload_file',
        { file, notebookId, userQuery },
        'high'
      );
      
      return {
        id: queueId,
        display_name: file.name,
        file_size: file.size,
        processing_status: 'queued_offline',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    // Attempt upload with retry logic
    return await RetryHandler.withRetry(
      async () => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Authentication required');

        // Sanitize file name
        const sanitizedFileName = file.name
          .replace(/[\[\]]/g, '_')
          .replace(/[^a-zA-Z0-9._-]/g, '_');
        
        const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;

        // Upload to storage with progress tracking
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('sources')
          .upload(fileName, file);

        if (uploadError) {
          // Enhance error message based on error type
          if (uploadError.message?.includes('size')) {
            throw new Error('File size exceeds the 50MB limit');
          }
          if (uploadError.message?.includes('type')) {
            throw new Error('Invalid file type. Only PDF files are supported');
          }
          throw uploadError;
        }

        // Create source record
        const { data: source, error: sourceError } = await supabase
          .from('sources')
          .insert({
            user_id: user.id,
            notebook_id: notebookId,
            file_url: uploadData.path,
            file_name: sanitizedFileName,
            display_name: file.name.replace(/\.[^/.]+$/, ''),
            file_size: file.size,
            mime_type: file.type,
            processing_status: 'pending',
            metadata_extracted: false,
            extracted_metadata: userQuery ? { user_query: userQuery } : {}
          })
          .select()
          .single();

        if (sourceError) throw sourceError;

        // Trigger processing with fallback
        try {
          await supabase.functions.invoke('trigger-n8n', {
            body: {
              webhook_type: 'ingest',
              webhook_url: import.meta.env.VITE_N8N_INGEST_URL,
              payload: {
                source_id: source.id,
                file_path: uploadData.path,
                notebook_id: notebookId,
                user_query: userQuery,
                file_name: file.name,
                file_size: file.size,
                user_id: user.id
              }
            }
          });
        } catch (processingError) {
          console.warn('Processing trigger failed, file uploaded but not processed:', processingError);
          // Don't throw here - file is uploaded successfully
        }

        return {
          id: source.id,
          display_name: source.display_name,
          file_size: source.file_size,
          processing_status: source.processing_status,
          created_at: source.created_at,
          updated_at: source.updated_at
        };
      },
      {
        maxRetries: 3,
        operationId: 'file_upload',
        shouldRetry: (error) => {
          // Don't retry validation errors or auth errors
          return !error.message?.includes('Authentication') && 
                 !error.message?.includes('Invalid file') &&
                 !error.message?.includes('size exceeds');
        }
      }
    );

  } catch (error) {
    ErrorHandler.handle(error, {
      operation: 'file_upload',
      fileName: file.name,
      fileSize: file.size,
      notebookId
    });
    throw error;
  }
}

// Enhanced chat with offline support and fallback providers
export async function sendChatWithErrorHandling(
  sessionId: string,
  message: string
) {
  try {
    validateRequired(sessionId, 'Session ID');
    validateRequired(message, 'Message');

    // Check if offline
    if (!NetworkMonitor.getInstance().isOnlineStatus()) {
      const queueId = OfflineQueue.getInstance().addToQueue(
        'send_message',
        { sessionId, message },
        'medium'
      );
      
      return {
        userMessage: { id: Date.now().toString(), content: message },
        aiMessage: { 
          id: (Date.now() + 1).toString(), 
          content: 'Message queued for when you\'re back online.' 
        }
      };
    }

    return await GracefulDegradation.withFallback(
      // Primary operation with full AI processing
      async () => {
        return await RetryHandler.withRetry(
          async () => {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error('Authentication required');

            // Store user message
            const { data: userMessage, error: messageError } = await supabase
              .from('chat_messages')
              .insert({
                session_id: sessionId,
                user_id: user.id,
                role: 'user',
                content: message,
              })
              .select()
              .single();

            if (messageError) throw messageError;

            // Get session context
            const { data: session } = await supabase
              .from('chat_sessions')
              .select('*')
              .eq('id', sessionId)
              .single();

            // Call AI service
            const { data: chatResponse, error: chatError } = await supabase.functions
              .invoke('trigger-n8n', {
                body: {
                  webhook_type: 'chat',
                  webhook_url: import.meta.env.VITE_N8N_CHAT_WEBHOOK,
                  payload: {
                    session_id: sessionId,
                    message: message,
                    user_id: user.id,
                    notebook_id: session?.notebook_id,
                    timestamp: new Date().toISOString()
                  }
                }
              });

            if (chatError) throw chatError;

            return {
              userMessage: { id: userMessage.id, content: message },
              aiMessage: { 
                id: Date.now().toString(), 
                content: chatResponse?.response || 'Processing your message...' 
              }
            };
          },
          {
            maxRetries: 2,
            operationId: 'chat_message',
            shouldRetry: (error) => !error.message?.includes('Authentication')
          }
        );
      },
      // Fallback operation with basic responses
      async () => {
        console.warn('Using fallback chat response due to AI service unavailability');
        
        // Simple keyword-based responses as fallback
        const fallbackResponse = generateFallbackResponse(message);
        
        return {
          userMessage: { id: Date.now().toString(), content: message },
          aiMessage: { 
            id: (Date.now() + 1).toString(), 
            content: fallbackResponse 
          }
        };
      },
      'chat_ai_processing'
    );

  } catch (error) {
    ErrorHandler.handle(error, {
      operation: 'send_chat_message',
      sessionId,
      messageLength: message.length
    });
    throw error;
  }
}

// Fallback response generator for when AI services are unavailable
function generateFallbackResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('setback') || lowerMessage.includes('building')) {
    return 'I\'m currently unable to access the AI service, but typical residential setbacks are usually 15-25 feet from the front property line and 5-10 feet from side boundaries. Please check your local zoning regulations for specific requirements.';
  }
  
  if (lowerMessage.includes('zoning') || lowerMessage.includes('zone')) {
    return 'AI service is temporarily unavailable. For zoning information, I recommend checking your local planning department\'s website or contacting them directly.';
  }
  
  if (lowerMessage.includes('permit') || lowerMessage.includes('application')) {
    return 'The AI assistant is currently offline. For permit applications, you typically need site plans, building plans, and completed application forms. Check with your local building department for specific requirements.';
  }
  
  return 'I\'m currently experiencing technical difficulties and cannot provide a detailed response. Please try again in a few moments, or contact your local planning department for immediate assistance.';
}

// Enhanced settings update with validation and offline support
export async function updateUserSettingsWithErrorHandling(settings: any) {
  try {
    // Validate settings
    if (settings.provider) {
      validateRequired(settings.provider, 'LLM Provider');
    }
    
    if (settings.temperature !== undefined) {
      if (settings.temperature < 0 || settings.temperature > 1) {
        throw new Error('Temperature must be between 0 and 1');
      }
    }

    // Check if offline
    if (!NetworkMonitor.getInstance().isOnlineStatus()) {
      OfflineQueue.getInstance().addToQueue(
        'update_settings',
        { settings },
        'low'
      );
      
      // Store locally for immediate UI update
      localStorage.setItem('user_settings_pending', JSON.stringify(settings));
      return;
    }

    return await RetryHandler.withRetry(
      async () => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Authentication required');

        const { error } = await supabase
          .from('user_profiles')
          .update({ preferences: settings })
          .eq('id', user.id);

        if (error) throw error;

        // Clear any pending settings
        localStorage.removeItem('user_settings_pending');
      },
      {
        maxRetries: 3,
        operationId: 'update_settings'
      }
    );

  } catch (error) {
    ErrorHandler.handle(error, {
      operation: 'update_user_settings',
      settings
    });
    throw error;
  }
}

// Enhanced notebook creation with validation
export async function createNotebookWithErrorHandling(
  name: string,
  projectType: string = 'general'
) {
  try {
    validateRequired(name, 'Notebook name');
    
    if (name.length > 100) {
      throw new Error('Notebook name must be less than 100 characters');
    }

    return await RetryHandler.withRetry(
      async () => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Authentication required');

        const { data, error } = await supabase
          .from('notebooks')
          .insert({
            user_id: user.id,
            name: name.trim(),
            project_type: projectType
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error('A notebook with this name already exists');
          }
          throw error;
        }

        return data.id;
      },
      {
        maxRetries: 2,
        operationId: 'create_notebook'
      }
    );

  } catch (error) {
    ErrorHandler.handle(error, {
      operation: 'create_notebook',
      notebookName: name,
      projectType
    });
    throw error;
  }
}

// Enhanced data fetching with caching and error recovery
export async function fetchWithErrorHandling<T>(
  fetchFunction: () => Promise<T>,
  cacheKey?: string,
  fallbackData?: T
): Promise<T> {
  try {
    // Try to get from cache first if offline
    if (!NetworkMonitor.getInstance().isOnlineStatus() && cacheKey) {
      const cached = localStorage.getItem(`cache_${cacheKey}`);
      if (cached) {
        return JSON.parse(cached);
      }
      
      if (fallbackData) {
        return fallbackData;
      }
    }

    const result = await RetryHandler.withRetry(
      fetchFunction,
      {
        maxRetries: 3,
        operationId: `fetch_${cacheKey || 'data'}`
      }
    );

    // Cache successful results
    if (cacheKey) {
      try {
        localStorage.setItem(`cache_${cacheKey}`, JSON.stringify(result));
      } catch (e) {
        console.warn('Failed to cache data:', e);
      }
    }

    return result;

  } catch (error) {
    // Try fallback data if available
    if (fallbackData) {
      console.warn('Using fallback data due to fetch error:', error);
      return fallbackData;
    }

    ErrorHandler.handle(error, {
      operation: 'fetch_data',
      cacheKey
    });
    throw error;
  }
}

// Batch operation handler with partial success support
export async function batchOperationWithErrorHandling<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: {
    concurrency?: number;
    continueOnError?: boolean;
    operationName?: string;
  } = {}
): Promise<{ results: R[]; errors: Array<{ item: T; error: any }> }> {
  const { concurrency = 3, continueOnError = true, operationName = 'batch_operation' } = options;
  
  const results: R[] = [];
  const errors: Array<{ item: T; error: any }> = [];
  
  // Process items in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (item) => {
      try {
        const result = await operation(item);
        results.push(result);
        return { success: true, result };
      } catch (error) {
        errors.push({ item, error });
        
        if (!continueOnError) {
          throw error;
        }
        
        ErrorHandler.handle(error, {
          operation: operationName,
          batchIndex: i,
          item
        });
        
        return { success: false, error };
      }
    });

    await Promise.all(batchPromises);
  }

  return { results, errors };
}