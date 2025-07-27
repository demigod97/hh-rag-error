import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
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
  metadata?: any
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
  
  return profile?.preferences || {
    provider: 'ollama',
    model: 'qwen3:8b-q4_K_M'
  }
}

// =====================================================
// File Upload and Processing
// =====================================================

export async function uploadFile(file: File, notebookId: string, userQuery?: string) {
  return await uploadFileWithErrorHandling(file, notebookId, userQuery)
}

async function uploadAndProcessFile(
  file: File,
  notebookId: string,
  userQuery?: string
): Promise<{ uploadId: string; jobId: string }> {
  try {
    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    // 2. Sanitize file name to remove special characters
    const sanitizedFileName = file.name.replace(/[\[\]]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('sources')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // 3. Create source record in database
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
        metadata_extracted: false
      })
      .select()
      .single()

    if (sourceError) throw sourceError

    // 4. Store user query if provided
    if (userQuery) {
      // Store user query in source metadata for now
      await supabase
        .from('sources')
        .update({
          extracted_metadata: { user_query: userQuery }
        })
        .eq('id', source.id)
    }

    // 5. Call edge function to trigger n8n ingest webhook with explicit URL
    const { data: processingResult, error: processingError } = await supabase.functions
      .invoke('trigger-n8n', {
        body: {
          webhook_type: 'ingest',
          webhook_url: (import.meta.env.VITE_N8N_INGEST_URL || '') || 'https://n8n.coralshades.ai/webhook-test/ingest',
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
      })

    if (processingError) {
      console.error('Edge function error:', processingError)
      // Don't throw here - file is uploaded, just processing failed
    }

    return {
      uploadId: source.id,
      jobId: source.id // Using source ID as job ID for simplicity
    }
  } catch (error) {
    console.error('Upload error:', error)
    throw error
  }
}

// Monitor processing job status
export async function getProcessingJobStatus(jobId: string): Promise<ProcessingJob | null> {
  const { data, error } = await supabase
    .from('sources')
    .select('id, processing_status, error_message')
    .eq('id', jobId)
    .single()

  if (error) {
    console.error('Error fetching job status:', error)
    return null
  }

  return {
    id: data.id,
    status: data.processing_status as any,
    progress: data.processing_status === 'completed' ? 100 : 
              data.processing_status === 'processing' ? 50 : 0,
    error_message: data.error_message
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
        content: message
      })
      .select()
      .single()

    if (messageError) throw messageError

    // Call the enhanced chat handler
    const result = await sendChatWithErrorHandling(sessionId, message)
    
    // Store assistant response
    const { data: assistantMessage, error: assistantError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: 'assistant',
        content: result.aiMessage.content,
        llm_provider: 'ollama', // Default provider
        llm_model: 'qwen3:8b-q4_K_M'
      })
      .select()
      .single()

    if (assistantError) throw assistantError

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
      const filePaths = sources.map(source => source.file_url).filter(Boolean)
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
// Citation Management
// =====================================================

export async function fetchCitation(citationId: string): Promise<{ title: string; excerpt: string }> {
  // Mock implementation for now - replace with actual API call when backend is ready
  return {
    title: `Citation ${citationId}`,
    excerpt: `This is a sample excerpt for citation ${citationId}. In a real implementation, this would fetch actual citation data from the backend.`
  }
}

// =====================================================
// Notebook Management
// =====================================================

// Enhanced notebook creation with better error handling
export async function createNotebook(
  name: string,
  projectType: string = 'general'
): Promise<string> {
  return await createNotebookWithErrorHandling(name, projectType)
}

export async function getNotebooks() {
  return await fetchWithErrorHandling(
    async () => {
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    'notebooks',
    [] // fallback to empty array
  )
}

// Note: getDefaultNotebook moved to session-management.ts as part of session creation

// =====================================================
// Real-time Subscriptions
// =====================================================

export function subscribeToProcessingJob(
  jobId: string,
  onUpdate: (job: ProcessingJob) => void
) {
  return supabase
    .channel(`job-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'sources',
        filter: `id=eq.${jobId}`
      },
      (payload) => {
        const source = payload.new as any
        onUpdate({
          id: source.id,
          status: source.processing_status,
          progress: source.processing_status === 'completed' ? 100 : 
                   source.processing_status === 'processing' ? 50 : 0,
          error_message: source.error_message
        })
      }
    )
    .subscribe()
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
        id: Date.now().toString(),
        content: message
      },
      aiMessage: {
        id: (Date.now() + 1).toString(),
        content: response.content
      }
    }
  } catch (error) {
    console.error('sendChat error:', error)
    throw error
  }
}

// For PermitDrawer.tsx
export async function template() {
  const { data, error } = await supabase
    .from('report_templates')
    .select('*')
    .eq('is_active', true)
  
  if (error) throw error
  return data
}

export async function genTemplate(params: {
  permitType: string
  address: string
  applicant: string
  sessionId: string
}) {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    // Get notebook_id from the session
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('notebook_id')
      .eq('id', params.sessionId)
      .single()

    if (sessionError || !session?.notebook_id) {
      throw new Error('Session not found or missing notebook')
    }

    // Get template_id based on permitType
    const { data: template, error: templateError } = await supabase
      .from('report_templates')
      .select('id, name')
      .ilike('name', `%${params.permitType}%`)
      .eq('is_active', true)
      .limit(1)
      .single()

    // If no specific template found, use a default one or create a generic entry
    const templateId = template?.id || null
    const reportTitle = `${params.permitType} - ${params.address}`

    // Create initial report generation entry
    const { data: reportGeneration, error: reportError } = await supabase
      .from('report_generations')
      .insert({
        user_id: user.id,
        notebook_id: session.notebook_id,
        template_id: templateId,
        title: reportTitle,
        topic: params.permitType,
        address: params.address,
        additional_context: `Applicant: ${params.applicant}`,
        llm_provider: 'ollama', // Default provider
        llm_model: 'qwen3:8b-q4_K_M',
        llm_config: { model: 'qwen3:8b-q4_K_M' },
        status: 'pending',
        progress: 0,
        file_format: 'markdown'
      })
      .select()
      .single()

    if (reportError) throw reportError

    // Update status to processing before calling n8n
    await supabase
      .from('report_generations')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', reportGeneration.id)
    // Call edge function to trigger template generation
    const { data, error } = await supabase.functions
      .invoke('trigger-n8n', {
        body: {
          webhook_type: 'template',
          webhook_url: (import.meta.env.VITE_N8N_TEMPLATE_URL || '') || 'https://n8n.coralshades.ai/webhook-test/template',
          payload: {
            report_generation_id: reportGeneration.id,
            permit_type: params.permitType,
            address: params.address,
            applicant: params.applicant,
            session_id: params.sessionId,
            notebook_id: session.notebook_id,
            user_id: user.id,
            timestamp: new Date().toISOString()
          }
        }
      })

    if (error) {
      // Update report generation status to failed
      await supabase
        .from('report_generations')
        .update({
          status: 'failed',
          error_message: error.message || 'n8n webhook invocation failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', reportGeneration.id)
      
      throw error
    }

    // Poll for completion with timeout
    let attempts = 0
    const maxAttempts = 60 // 5 minutes timeout (5 second intervals)
    let finalReport = null
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
      
      const { data: updatedReport, error: pollError } = await supabase
        .from('report_generations')
        .select('*')
        .eq('id', reportGeneration.id)
        .single()
      
      if (pollError) {
        console.error('Error polling report status:', pollError)
        break
      }
      
      if (updatedReport.status === 'completed') {
        finalReport = updatedReport
        break
      } else if (updatedReport.status === 'failed') {
        throw new Error(updatedReport.error_message || 'Report generation failed')
      }
      
      attempts++
    }
    
    if (!finalReport) {
      // Mark as failed due to timeout
      await supabase
        .from('report_generations')
        .update({
          status: 'failed',
          error_message: 'Report generation timed out after 5 minutes',
          completed_at: new Date().toISOString()
        })
        .eq('id', reportGeneration.id)
      
      throw new Error('Report generation timed out')
    }

    return {
      docx_url: finalReport.file_path ? 
        `${supabaseUrl}/storage/v1/object/public/reports/${finalReport.file_path}` : '#',
      preview_url: finalReport.file_path ? 
        `${supabaseUrl}/storage/v1/object/public/reports/${finalReport.file_path}` : '#',
      report_generation_id: reportGeneration.id
    }
  } catch (error) {
    console.error('genTemplate error:', error)
    throw error
  }
}

// =====================================================
// Report Management Functions
// =====================================================

export async function getReports(notebookId: string) {
  return await fetchWithErrorHandling(
    async () => {
      const { data, error } = await supabase
        .from('report_generations')
        .select('*')
        .eq('notebook_id', notebookId)
        .eq('file_format', 'markdown')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    `reports_${notebookId}`,
    [] // fallback to empty array
  )
}

export async function getReportContent(filePath: string): Promise<string> {
  return await fetchWithErrorHandling(
    async () => {
      const { data, error } = await supabase.storage
        .from('reports')
        .download(filePath)
      
      if (error) throw error
      
      const text = await data.text()
      return text
    },
    `report_content_${filePath}`,
    'Report content not available' // fallback content
  )
}

export async function downloadReportFile(filePath: string, fileName: string): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from('reports')
      .download(filePath)
    
    if (error) throw error

    // Create download link
    const blob = new Blob([data], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download failed:', error)
    throw error
  }
}

// Enhanced report management with better error handling
export async function getReportsByNotebook(notebookId: string) {
  return await fetchWithErrorHandling(
    async () => {
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
    },
    `reports_detailed_${notebookId}`,
    []
  )
}

// Enhanced function to handle both edge function and n8n generated reports
export async function getReportContent(reportId: string): Promise<string> {
  return await fetchWithErrorHandling(
    async () => {
      // First get the report details
      const { data: report, error: reportError } = await supabase
        .from('report_generations')
        .select('file_path, file_format, generated_content')
        .eq('id', reportId)
        .single()
      
      if (reportError) throw reportError
      
      // If we have generated_content stored directly, use that
      if (report.generated_content) {
        return report.generated_content
      }
      
      // Otherwise try to download from storage
      if (report.file_path) {
        // Check if it's a full URL or a storage path
        if (report.file_path.startsWith('http')) {
          // It's a full URL (likely from n8n), fetch directly
          const response = await fetch(report.file_path)
          if (!response.ok) throw new Error('Failed to fetch report from URL')
          return await response.text()
        } else {
          // It's a storage path, use Supabase storage
          // Remove 'reports/' prefix if present since storage bucket is already 'reports'
          const cleanPath = report.file_path.replace(/^reports\//, '')
          const { data, error } = await supabase.storage
            .from('reports')
            .download(cleanPath)
          
          if (error) throw error
          return await data.text()
        }
      }
      
      throw new Error('No report content available')
    },
    `report_content_${reportId}`,
    'Report content not available'
  )
}
export async function downloadReportAsMarkdown(reportId: string, title: string): Promise<void> {
  try {
    const { data: report, error: reportError } = await supabase
      .from('report_generations')
      .select('file_path, file_format, generated_content')
      .eq('id', reportId)
      .single()

    if (reportError) throw reportError

    
    let reportContent: string
    let mimeType = 'text/markdown'
    
    // Get content using the enhanced getReportContent function
    reportContent = await getReportContent(reportId)
    
    // Determine file extension based on format
    const fileExtension = report.file_format === 'docx' ? 'docx' : 
                         report.file_format === 'pdf' ? 'pdf' : 'md'
    
    if (report.file_format === 'docx') {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    } else if (report.file_format === 'pdf') {
      mimeType = 'application/pdf'
    }

    // Create download link
    const blob = new Blob([reportContent], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`
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
// LLM Connection Testing
// =====================================================

export async function testLLMConnection(provider: string, settings: LLMSettings): Promise<{ success: boolean }> {
  try {
    // For now, return true as a placeholder
    // This can be expanded to actually test the connection
    console.log('Testing LLM connection with provider:', provider, 'settings:', settings)
    return { success: true }
  } catch (error) {
    console.error('LLM connection test failed:', error)
    return { success: false }
  }
}

// Update user settings
export async function updateUserSettings(settings: LLMSettings): Promise<void> {
  return await updateUserSettingsWithErrorHandling(settings)
}