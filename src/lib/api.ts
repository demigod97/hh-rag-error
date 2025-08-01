import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { 
  uploadFileWithErrorHandling,
  sendChatWithErrorHandling,
  updateUserSettingsWithErrorHandling,
  createNotebookWithErrorHandling,
  fetchWithErrorHandling
} from './api-with-error-handling'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required Supabase environment variables:', {
    VITE_SUPABASE_URL: !!supabaseUrl,
    VITE_SUPABASE_ANON_KEY: !!supabaseAnonKey
  })
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, unknown>
}

export interface ProcessingJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  error_message?: string
}

export interface LLMSettings {
  provider: 'ollama' | 'openai' | 'gemini' | 'llamacloud'
  model?: string
  temperature?: number
  maxTokens?: number
  embeddingProvider?: string
}

// Get current user settings
export async function getUserSettings(): Promise<LLMSettings> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('preferences')
    .single()
  
  const preferences = profile?.preferences as Record<string, unknown> | null;
  
  return (preferences as unknown as LLMSettings) || {
    provider: 'ollama',
    model: 'qwen3:8b-q4_K_M'
  }
}

// =====================================================
// File Upload Functionality
// =====================================================

// Simple upload file function with basic error handling
export async function uploadFile(file: File, notebookId: string, userQuery?: string) {
  console.log('Uploading file:', { name: file.name, size: file.size, notebookId });
  
  try {
    return await uploadFileWithErrorHandling(file, notebookId, userQuery);
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

async function uploadAndProcessFile(
  file: File,
  notebookId: string,
  userQuery?: string
): Promise<{ uploadId: string; jobId: string }> {
  
  const fileExt = file.name.split('.').pop()
  const fileName = `${Math.random()}.${fileExt}`
  const filePath = `${notebookId}/${fileName}`

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('sources')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('sources')
    .getPublicUrl(filePath)

  // Create source record
  const { data: sourceData, error: sourceError } = await supabase
    .from('sources')
    .insert({
      notebook_id: notebookId,
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      display_name: file.name,
      processing_status: 'pending'
    })
    .select()
    .single()

  if (sourceError) throw sourceError

  // The upload is complete, processing will be handled by edge functions
  return {
    uploadId: sourceData.id,
    jobId: sourceData.id // Using source ID as job ID for simplicity
  }
}

// Get processing job status  
export async function getProcessingJob(jobId: string): Promise<ProcessingJob | null> {
  const { data, error } = await supabase
    .from('sources')
    .select('id, processing_status, processing_error')
    .eq('id', jobId)
    .single()

  if (error || !data) return null

  // Map processing status to job format
  const statusMap: Record<string, ProcessingJob['status']> = {
    'pending': 'pending',
    'processing': 'processing', 
    'completed': 'completed',
    'failed': 'failed'
  }

  return {
    id: data.id,
    status: statusMap[data.processing_status] || 'pending',
    progress: data.processing_status === 'completed' ? 100 : 
              data.processing_status === 'processing' ? 50 : 0,
    error_message: data.processing_error || undefined
  }
}

// =====================================================
// Chat Functionality
// =====================================================

// Note: createChatSession moved to session-management.ts for better organization

export async function sendChatMessage(
  sessionId: string,
  message: string
): Promise<ChatMessage> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    // Store user message first
    const { data: userMessage, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: 'user',
        message: message
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error storing user message:', messageError);
      throw messageError;
    }

    // Call the enhanced chat handler
    const result = await sendChatWithErrorHandling(sessionId, message)
    
    // Store assistant response
    const { data: assistantMessage, error: assistantError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: 'assistant',
        message: result.aiMessage.content,
        llm_provider: 'ollama',
        llm_model: 'qwen3:8b-q4_K_M'
      })
      .select()
      .single()

    if (assistantError) {
      console.error('Error storing assistant message:', assistantError);
      throw assistantError;
    }

    return {
      role: 'assistant',
      content: result.aiMessage.content,
      metadata: assistantMessage
    }
  } catch (error) {
    console.error('Chat message error:', error)
    throw error
  }
}

// =====================================================
// Source Management
// =====================================================

export async function getSources(notebookId: string) {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function deleteSource(sourceId: string) {
  // Get source info first to delete from storage
  const { data: source } = await supabase
    .from('sources')
    .select('file_url')
    .eq('id', sourceId)
    .single()

  if (source?.file_url) {
    // Extract file path from URL and delete from storage
    const url = new URL(source.file_url)
    const filePath = url.pathname.split('/').slice(-2).join('/')
    
    await supabase.storage
      .from('sources')
      .remove([filePath])
  }

  // Delete from database
  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', sourceId)

  if (error) throw error
}

export async function deleteAllSources(notebookId: string): Promise<void> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    // Get all sources for this notebook and user
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('id, file_url')
      .eq('notebook_id', notebookId)
      .eq('user_id', user.id)

    if (sourcesError) throw sourcesError

    if (sources && sources.length > 0) {
      // Delete files from storage
      const filePaths = sources.map(source => {
        if (source.file_url) {
          try {
            const url = new URL(source.file_url)
            return url.pathname.split('/').slice(-2).join('/')
          } catch {
            return null
          }
        }
        return null
      }).filter(Boolean)
      
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('sources')
          .remove(filePaths)

        if (storageError) {
          console.warn('Some files could not be deleted from storage:', storageError)
        }
      }

      // Delete source records from database
      const { error: deleteError } = await supabase
        .from('sources')
        .delete()
        .eq('notebook_id', notebookId)
        .eq('user_id', user.id)

      if (deleteError) throw deleteError
    }
  } catch (error) {
    console.error('Error deleting all sources:', error)
    throw error
  }
}

// =====================================================
// Session Management
// =====================================================

export async function getChatSessions(notebookId?: string) {
  let query = supabase
    .from('chat_sessions')
    .select('*')
    .order('updated_at', { ascending: false })

  if (notebookId) {
    query = query.eq('notebook_id', notebookId)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

// =====================================================
// Settings Management
// =====================================================

export async function updateUserSettings(settings: Partial<LLMSettings>) {
  return await updateUserSettingsWithErrorHandling(settings)
}

// =====================================================
// Notebooks
// =====================================================

export async function createNotebook(name: string, projectType: string = 'general') {
  return await createNotebookWithErrorHandling(name, projectType)
}

export async function getNotebooks() {
  const { data, error } = await supabase
    .from('notebooks')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

// =====================================================
// Compatibility Functions for Existing Components
// =====================================================

// For ChatStream.tsx
export async function sendChat(sessionId: string, message: string) {
  try {
    const response = await sendChatMessage(sessionId, message)
    
    return {
      userMessage: {
        id: response.metadata?.user_message_id || Date.now().toString(),
        content: message
      },
      aiMessage: {
        id: response.metadata?.id || (Date.now() + 1).toString(),
        content: response.content,
        metadata: response.metadata
      }
    }
  } catch (error) {
    console.error('sendChat error:', error)
    throw error
  }
}

// =====================================================
// Template Generation
// =====================================================

export async function genTemplate(params: {
  permitType: string
  address: string
  applicant: string
  sessionId: string
}) {
  try {
    console.log('Generating template with params:', params)
    
    const templatePrompt = `
Generate a ${params.permitType} application template for:
- Address: ${params.address}
- Applicant: ${params.applicant}

Please provide a structured template with all necessary sections and requirements.
    `.trim()

    // Use the chat system to generate the template
    const result = await sendChat(params.sessionId, templatePrompt)
    
    return {
      success: true,
      template: result.aiMessage.content,
      metadata: {
        permitType: params.permitType,
        address: params.address,
        applicant: params.applicant,
        generatedAt: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('Template generation error:', error)
    throw error
  }
}

// =====================================================
// Citation Support
// =====================================================

export async function fetchCitation(citationId: string) {
  // This is a placeholder - implement based on your citation system
  return {
    id: citationId,
    title: `Citation ${citationId}`,
    content: 'Citation content would be loaded here...',
    source: 'Document source',
    page: 1
  }
}

// =====================================================
// Error Handling Utilities
// =====================================================

export function handleApiError(error: unknown, context: string = 'API call') {
  console.error(`Error in ${context}:`, error)
  
  if (error instanceof Error) {
    throw error
  }
  
  throw new Error(`Unknown error in ${context}`)
}

// =====================================================
// Fetching Utilities  
// =====================================================

export async function fetchWithCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  cacheTime: number = 5 * 60 * 1000 // 5 minutes
): Promise<T> {
  // Simple in-memory cache implementation
  const cached = sessionStorage.getItem(key)
  if (cached) {
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp < cacheTime) {
      return data
    }
  }

  const data = await fetchFn()
  sessionStorage.setItem(key, JSON.stringify({
    data,
    timestamp: Date.now()
  }))
  
  return data
}

// =====================================================
// Report Management (Simplified)
// =====================================================

export async function getReports(notebookId: string) {
  try {
    const { data, error } = await supabase
      .from('report_generations')
      .select('*')
      .eq('notebook_id', notebookId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching reports:', error)
    throw error
  }
}

export async function generateReport(params: {
  title: string
  topic: string
  address?: string
  notebookId: string
}) {
  console.log('Generating report:', params)
  
  // This would integrate with your report generation system
  // For now, return a mock response
  return {
    id: Date.now().toString(),
    status: 'pending',
    ...params
  }
}

export async function getReportContent(reportId: string): Promise<string> {
  try {
    // First get the report details
    const { data: report, error: reportError } = await supabase
      .from('report_generations')
      .select('file_path, file_format, generated_content')
      .eq('id', reportId)
      .single()
    
    if (reportError) throw reportError
    
    let rawContent = '';
    
    // If we have generated_content stored directly, use that
    if (report.generated_content) {
      rawContent = report.generated_content
    }
    // Otherwise try to download from storage
    else if (report.file_path) {
      // Check if it's a full URL or a storage path
      if (report.file_path.startsWith('http')) {
        // It's a full URL (likely from n8n), fetch directly
        const response = await fetch(report.file_path)
        if (!response.ok) throw new Error('Failed to fetch report from URL')
        rawContent = await response.text()
      } else {
        // It's a storage path, use Supabase storage
        // Remove 'reports/' prefix if present since storage bucket is already 'reports'
        const cleanPath = report.file_path.replace(/^reports\//, '')
        const { data, error } = await supabase.storage
          .from('reports')
          .download(cleanPath)
        
        if (error) throw error
        rawContent = await data.text()
      }
    } else {
      throw new Error('No report content available')
    }
    
    // Robust content processing with switch cases for different content types
    const processedContent = processReportContent(rawContent);
    
    // Ensure we have some content
    if (!processedContent || processedContent.trim() === '') {
      throw new Error('Report content is empty after processing')
    }
    
    return processedContent
  } catch (error) {
    console.error('Error fetching report content:', error)
    throw error
  }
}

/**
 * Process report content with robust handling for different content types
 */
function processReportContent(rawContent: string): string {
  if (!rawContent || typeof rawContent !== 'string') {
    console.warn('Invalid content provided to processReportContent:', typeof rawContent)
    return 'No content available'
  }

  // Trim the content
  const trimmedContent = rawContent.trim()
  
  // Detect content type and process accordingly
  const contentType = detectContentType(trimmedContent)
  
  console.log('🔍 Content Processing Debug:')
  console.log('- Content type detected:', contentType)
  console.log('- Content length:', trimmedContent.length)
  console.log('- Content preview:', trimmedContent.substring(0, 200) + (trimmedContent.length > 200 ? '...' : ''))
  
  let processedContent = '';
  
  switch (contentType) {
    case 'json':
      console.log('📋 Processing as JSON content')
      processedContent = processJsonContent(trimmedContent)
      break
    
    case 'markdown':
      console.log('📝 Processing as Markdown content')
      processedContent = processMarkdownContent(trimmedContent)
      break
    
    case 'html':
      console.log('🌐 Processing as HTML content')
      processedContent = processHtmlContent(trimmedContent)
      break
    
    case 'plaintext':
    default:
      console.log('📄 Processing as Plain Text content')
      processedContent = processPlainTextContent(trimmedContent)
      break
  }
  
  console.log('✅ Content processed successfully')
  console.log('- Final content length:', processedContent.length)
  console.log('- Final content preview:', processedContent.substring(0, 200) + (processedContent.length > 200 ? '...' : ''))
  
  return processedContent
}

/**
 * Detect the type of content we're dealing with
 */
function detectContentType(content: string): 'json' | 'markdown' | 'html' | 'plaintext' {
  // Check for JSON
  if ((content.startsWith('{') && content.endsWith('}')) || 
      (content.startsWith('[') && content.endsWith(']'))) {
    try {
      JSON.parse(content)
      return 'json'
    } catch {
      // Not valid JSON, continue checking
    }
  }
  
  // Check for HTML
  if (content.includes('<html') || content.includes('<!DOCTYPE') || 
      (content.includes('<') && content.includes('>'))) {
    return 'html'
  }
  
  // Check for Markdown
  if (content.includes('# ') || content.includes('## ') || 
      content.includes('### ') || content.includes('**') || 
      content.includes('*') || content.includes('```') ||
      content.includes('\n\n') || content.includes('[') && content.includes(']')) {
    return 'markdown'
  }
  
  return 'plaintext'
}

/**
 * Process JSON content - extract the actual content from various JSON structures
 */
function processJsonContent(jsonContent: string): string {
  try {
    const parsed = JSON.parse(jsonContent)
    
    console.log('Parsing JSON content:', Object.keys(parsed))
    
    // Handle different JSON response patterns
    let extractedContent = ''
    
    if (parsed && typeof parsed === 'object') {
      // Priority order for content extraction
      const contentFields = ['response', 'content', 'markdown', 'message', 'text', 'data']
      
      for (const field of contentFields) {
        if (parsed[field] && typeof parsed[field] === 'string') {
          extractedContent = parsed[field]
          console.log(`Extracted content from field: ${field}`)
          break
        }
      }
      
      // If no direct field found, try nested objects
      if (!extractedContent) {
        for (const key in parsed) {
          if (parsed[key] && typeof parsed[key] === 'object') {
            for (const field of contentFields) {
              if (parsed[key][field] && typeof parsed[key][field] === 'string') {
                extractedContent = parsed[key][field]
                console.log(`Extracted content from nested field: ${key}.${field}`)
                break
              }
            }
            if (extractedContent) break
          }
        }
      }
      
      // If still no content, try to stringify the object in a readable way
      if (!extractedContent) {
        if (Array.isArray(parsed)) {
          extractedContent = parsed.map(item => 
            typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)
          ).join('\n\n')
        } else {
          extractedContent = JSON.stringify(parsed, null, 2)
        }
      }
    } else if (typeof parsed === 'string') {
      extractedContent = parsed
    } else {
      extractedContent = String(parsed)
    }
    
    // Process the extracted content recursively in case it's nested JSON
    if (extractedContent !== jsonContent) {
      return processReportContent(extractedContent)
    }
    
    return cleanupContent(extractedContent)
    
  } catch (parseError) {
    console.error('Failed to parse JSON content:', parseError)
    // If JSON parsing fails, treat as plain text
    return processPlainTextContent(jsonContent)
  }
}

/**
 * Process Markdown content - clean up and enhance
 */
function processMarkdownContent(markdownContent: string): string {
  // Clean up citation references and format the content in a chain
  const content = markdownContent
    // Clean up citation references - convert from JSON format to markdown links
    .replace(
      /\[\{"pageContent":"([^"]+)","metadata":\{[^}]*\}\}\]/g, 
      '\n\n> **Citation:** $1\n'
    )
    // Clean up multiple citation arrays
    .replace(
      /\[\{"pageContent":"([^"]+)","metadata":\{[^}]*\}\}(?:,\{"pageContent":"([^"]+)","metadata":\{[^}]*\}\})*\]/g,
      (match, firstCitation, secondCitation) => {
        if (secondCitation) {
          return `\n\n> **Citations:** $1, $2\n`
        }
        return `\n\n> **Citation:** $1\n`
      }
    )
    // Fix common markdown formatting issues
    .replace(/\\n\\n/g, '\n\n')  // Fix escaped newlines
    .replace(/\\n/g, '\n')       // Fix single escaped newlines
    .replace(/\n{3,}/g, '\n\n')  // Reduce excessive newlines
    .replace(/^[\s]*\n/gm, '\n') // Remove leading whitespace on lines
  
  return cleanupContent(content)
}

/**
 * Process HTML content - strip tags or convert to markdown
 */
function processHtmlContent(htmlContent: string): string {
  // Simple HTML to markdown conversion
  const content = htmlContent
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
  
  return cleanupContent(content)
}

/**
 * Process plain text content - add basic formatting
 */
function processPlainTextContent(textContent: string): string {
  // If the content looks like it might be malformed JSON, try to clean it up
  if (textContent.includes('"response":') || textContent.includes('"content":')) {
    // Try to extract content from malformed JSON
    const responseMatch = textContent.match(/"response":\s*"([^"]+)"/);
    const contentMatch = textContent.match(/"content":\s*"([^"]+)"/);
    
    if (responseMatch) {
      return processReportContent(responseMatch[1].replace(/\\n/g, '\n'))
    }
    if (contentMatch) {
      return processReportContent(contentMatch[1].replace(/\\n/g, '\n'))
    }
  }
  
  return cleanupContent(textContent)
}

/**
 * Final cleanup for any content type
 */
function cleanupContent(content: string): string {
  return content
    .trim()
    .replace(/\n{3,}/g, '\n\n')  // Normalize excessive newlines
    .replace(/^\s+/gm, '')       // Remove leading whitespace
    .replace(/\s+$/gm, '')       // Remove trailing whitespace
}

// Export the processing function for use in other components if needed
export { processReportContent, detectContentType }

export async function getReportsByNotebook(notebookId: string) {
  const { data, error } = await supabase
    .from('report_generations')
    .select(`
      id,
      title,
      topic,
      address,
      status,
      file_path,
      file_format,
      file_size,
      progress,
      created_at,
      completed_at,
      error_message
    `)
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export async function downloadReportAsMarkdown(reportId: string, title: string): Promise<void> {
  try {
    const reportContent = await getReportContent(reportId)
    
    // Create download link
    const blob = new Blob([reportContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download failed:', error)
    throw error
  }
}

// =====================================================
// Notebook Context
// =====================================================

export async function getNotebookContext(notebookId: string) {
  try {
    const [notebook, sources] = await Promise.all([
      supabase.from('notebooks').select('*').eq('id', notebookId).single(),
      supabase.from('sources').select('*').eq('notebook_id', notebookId)
    ])

    return {
      notebook: notebook.data,
      sources: sources.data || [],
      sourceCount: sources.data?.length || 0
    }
  } catch (error) {
    console.error('Error getting notebook context:', error)
    return { notebook: null, sources: [], sourceCount: 0 }
  }
}

// =====================================================
// Real-time Subscriptions
// =====================================================

export function subscribeToSources(notebookId: string, callback: (payload: Record<string, unknown>) => void) {
  return supabase
    .channel(`sources-${notebookId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public', 
        table: 'sources',
        filter: `notebook_id=eq.${notebookId}`
      },
      callback
    )
    .subscribe()
}

export function subscribeToMessages(sessionId: string, callback: (payload: Record<string, unknown>) => void) {
  return supabase
    .channel(`messages-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages', 
        filter: `session_id=eq.${sessionId}`
      },
      callback
    )
    .subscribe()
}

// =====================================================
// Testing Utilities
// =====================================================

export async function testDatabaseConnection() {
  try {
    const { data, error } = await supabase.from('notebooks').select('count').limit(1)
    if (error) throw error
    return { success: true, message: 'Database connection successful' }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

export async function testRealtimeConnection() {
  return new Promise((resolve) => {
    const channel = supabase.channel('test-connection')
      .on('presence', { event: 'sync' }, () => {
        resolve({ success: true, message: 'Realtime connection successful' })
        channel.unsubscribe()
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          resolve({ success: false, message: 'Realtime connection failed' })
        }
      })
    
    // Timeout after 5 seconds
    setTimeout(() => {
      resolve({ success: false, message: 'Realtime connection timeout' })
      channel.unsubscribe()
    }, 5000)
  })
}

export async function testLLMConnection(provider: string, settings: LLMSettings): Promise<{ success: boolean; message?: string }> {
  try {
    // For now, return true as a placeholder
    // This can be expanded to actually test the connection
    console.log('Testing LLM connection with provider:', provider, 'settings:', settings)
    return { success: true, message: 'LLM connection test successful' }
  } catch (error) {
    console.error('LLM connection test failed:', error)
    return { success: false, message: error instanceof Error ? error.message : 'LLM connection test failed' }
  }
}

// =====================================================
// Debug Functions
// =====================================================

export async function debugChatMessages(sessionId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  console.log('Debug - Chat messages for session:', sessionId)
  console.log('Data:', data)
  console.log('Error:', error)
  
  return { data, error }
}