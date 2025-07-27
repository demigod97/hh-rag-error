// src/lib/api.ts
// Complete API integration with multi-LLM support

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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

export async function uploadAndProcessFile(
  file: File,
  notebookId: string,
  llmProvider: string = 'llamacloud'
): Promise<{ uploadId: string; jobId: string }> {
  try {
    // 1. Upload file to Supabase storage
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('Not authenticated')

    const fileName = `${userId}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('sources')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // 2. Create source record
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .insert({
        notebook_id: notebookId,
        user_id: userId,
        file_url: uploadData.path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        display_name: file.name.replace(/\.[^/.]+$/, ''),
        processing_status: 'pending'
      })
      .select()
      .single()

    if (sourceError) throw sourceError

    // 3. Trigger processing via edge function
    const { data: processingResult, error: processingError } = await supabase.functions
      .invoke('process-pdf-with-metadata', {
        body: {
          source_id: source.id,
          file_path: uploadData.path,
          notebook_id: notebookId,
          llm_provider: llmProvider,
          llm_config: await getUserSettings()
        }
      })

    if (processingError) throw processingError

    // 4. Create processing job record
    const { data: job } = await supabase
      .from('processing_jobs')
      .insert({
        job_type: 'pdf_processing',
        source_id: source.id,
        notebook_id: notebookId,
        user_id: userId,
        status: 'processing',
        config: { llm_provider: llmProvider }
      })
      .select()
      .single()

    return {
      uploadId: source.id,
      jobId: job?.id || source.id
    }
  } catch (error) {
    console.error('Upload error:', error)
    throw error
  }
}

// Monitor processing job status
export async function getProcessingJobStatus(jobId: string): Promise<ProcessingJob | null> {
  const { data, error } = await supabase
    .from('processing_jobs')
    .select('id, status, progress, error_message')
    .eq('id', jobId)
    .single()

  if (error) {
    console.error('Error fetching job status:', error)
    return null
  }

  return data
}

// =====================================================
// Chat Functionality
// =====================================================

export async function createChatSession(
  notebookId: string,
  sourceIds: string[] = [],
  llmSettings?: LLMSettings
): Promise<string> {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Not authenticated')

  const settings = llmSettings || await getUserSettings()

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      notebook_id: notebookId,
      title: `Chat - ${new Date().toLocaleString()}`,
      source_ids: sourceIds,
      llm_provider: settings.provider,
      llm_model: settings.model,
      llm_config: settings
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  onStream?: (chunk: string) => void
): Promise<ChatMessage> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('Not authenticated')

    // Get session details
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!session) throw new Error('Session not found')

    // Store user message
    await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: 'user',
        content: message
      })

    // Get conversation history
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    // Perform vector search for context
    const { data: searchResults } = await supabase.functions
      .invoke('batch-vector-search', {
        body: {
          queries: [message],
          notebook_id: session.notebook_id,
          source_ids: session.source_ids,
          top_k: 5,
          embedding_provider: session.llm_config.embeddingProvider || session.llm_provider
        }
      })

    const context = searchResults?.results?.[0]?.results || []

    // Send to n8n for processing
    const response = await fetch(`${import.meta.env.VITE_N8N_WEBHOOK_BASE_URL}/webhook/hhlm-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        message,
        context: context.map((c: any) => c.content),
        history: messages?.map(m => ({ role: m.role, content: m.content })) || [],
        llm_provider: session.llm_provider,
        llm_config: session.llm_config
      })
    })

    if (!response.ok) throw new Error('Chat request failed')

    const assistantResponse = await response.json()

    // Store assistant response
    const { data: assistantMessage } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        content: assistantResponse.content,
        chunks_retrieved: context.map((c: any) => c.chunk_id),
        retrieval_metadata: { context_count: context.length },
        llm_provider: session.llm_provider,
        llm_model: session.llm_model
      })
      .select()
      .single()

    return {
      role: 'assistant',
      content: assistantResponse.content,
      metadata: assistantMessage
    }
  } catch (error) {
    console.error('Chat error:', error)
    throw error
  }
}

// =====================================================
// Report Generation
// =====================================================

export interface ReportRequest {
  notebookId: string
  templateId: string
  topic: string
  address?: string
  additionalContext?: string
  llmSettings?: LLMSettings
}

export async function generateReport(request: ReportRequest): Promise<string> {
  try {
    const settings = request.llmSettings || await getUserSettings()

    const { data, error } = await supabase.functions
      .invoke('generate-report', {
        body: {
          notebook_id: request.notebookId,
          template_id: request.templateId,
          topic: request.topic,
          address: request.address,
          additional_context: request.additionalContext,
          llm_provider: settings.provider,
          llm_config: settings,
          embedding_provider: settings.embeddingProvider || settings.provider
        }
      })

    if (error) throw error
    return data.report_generation_id
  } catch (error) {
    console.error('Report generation error:', error)
    throw error
  }
}

export async function getReportStatus(reportId: string) {
  const { data, error } = await supabase
    .from('report_generations')
    .select(`
      *,
      report_sections (
        id,
        section_name,
        subsection_name,
        status,
        word_count
      )
    `)
    .eq('id', reportId)
    .single()

  if (error) throw error
  return data
}

export async function downloadReport(reportId: string): Promise<string> {
  const { data: report } = await supabase
    .from('report_generations')
    .select('file_path')
    .eq('id', reportId)
    .single()

  if (!report?.file_path) throw new Error('Report file not found')

  const { data } = supabase.storage
    .from('reports')
    .getPublicUrl(report.file_path)

  return data.publicUrl
}

// =====================================================
// Notebook Management
// =====================================================

export async function createNotebook(
  name: string,
  projectType: string,
  clientDetails?: any
): Promise<string> {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notebooks')
    .insert({
      user_id: userId,
      name,
      project_type: projectType,
      client_name: clientDetails?.clientName,
      address: clientDetails?.address,
      lot_details: clientDetails?.lotDetails,
      council_area: clientDetails?.councilArea,
      contact_email: clientDetails?.contactEmail,
      contact_phone: clientDetails?.contactPhone,
      metadata: clientDetails?.metadata || {}
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

export async function getNotebooks() {
  const { data, error } = await supabase
    .from('notebooks')
    .select(`
      *,
      _count:sources(count)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// =====================================================
// Metadata Management
// =====================================================

export async function getMetadataSchema() {
  const { data, error } = await supabase
    .from('metadata_schema')
    .select('*')
    .order('occurrence_count', { ascending: false })

  if (error) throw error
  return data
}

export async function getDocumentMetadata(sourceId: string) {
  const { data, error } = await supabase
    .from('pdf_metadata')
    .select(`
      *,
      pdf_metadata_values (
        *,
        metadata_schema (
          field_name,
          display_name,
          field_type
        )
      )
    `)
    .eq('source_id', sourceId)
    .single()

  if (error) throw error
  return data
}

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
        table: 'processing_jobs',
        filter: `id=eq.${jobId}`
      },
      (payload) => {
        onUpdate(payload.new as ProcessingJob)
      }
    )
    .subscribe()
}

export function subscribeToReportGeneration(
  reportId: string,
  onUpdate: (report: any) => void
) {
  return supabase
    .channel(`report-${reportId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'report_generations',
        filter: `id=eq.${reportId}`
      },
      (payload) => {
        onUpdate(payload.new)
      }
    )
    .subscribe()
}

// =====================================================
// Settings Management
// =====================================================

export async function updateUserSettings(settings: Partial<LLMSettings>) {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('user_profiles')
    .update({
      preferences: settings,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) throw error
}

export async function testLLMConnection(provider: string, config: any = {}) {
  try {
    // Test the connection by generating a simple embedding
    const { data, error } = await supabase.functions
      .invoke('batch-vector-search', {
        body: {
          queries: ['test'],
          embedding_provider: provider,
          top_k: 1
        }
      })

    return { success: !error, error: error?.message }
  } catch (error) {
    return { success: false, error: error.message }
  }
}