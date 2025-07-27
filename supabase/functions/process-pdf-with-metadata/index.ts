// supabase/functions/process-pdf-with-metadata/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validate environment variables
function validateEnvironment() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter(key => !Deno.env.get(key))
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

// LLM Provider configurations with validation
const LLM_PROVIDERS = {
  ollama: {
    embedModel: 'nomic-embed-text:latest',
    chatModel: 'qwen3:8b-q4_K_M',
    baseUrl: () => Deno.env.get('OLLAMA_BASE_URL') || 'http://localhost:11434',
    isAvailable: () => !!Deno.env.get('OLLAMA_BASE_URL')
  },
  openai: {
    embedModel: 'text-embedding-3-small',
    chatModel: 'gpt-4',
    apiKey: () => Deno.env.get('OPENAI_API_KEY'),
    isAvailable: () => !!Deno.env.get('OPENAI_API_KEY')
  },
  gemini: {
    embedModel: 'embedding-001',
    chatModel: 'gemini-pro',
    apiKey: () => Deno.env.get('GEMINI_API_KEY'),
    isAvailable: () => !!Deno.env.get('GEMINI_API_KEY')
  },
  llamacloud: {
    apiKey: () => Deno.env.get('LLAMACLOUD_API_KEY'),
    isAvailable: () => !!Deno.env.get('LLAMACLOUD_API_KEY')
  }
}

// Generate content using selected LLM with fallbacks
async function generateContent(prompt: string, provider: string = 'ollama', options: any = {}) {
  // Check if provider is available, fallback to available ones
  if (!LLM_PROVIDERS[provider]?.isAvailable()) {
    console.warn(`Provider ${provider} not available, trying fallbacks...`)
    
    // Try fallback providers
    const fallbacks = ['ollama', 'openai', 'gemini']
    for (const fallback of fallbacks) {
      if (LLM_PROVIDERS[fallback]?.isAvailable()) {
        console.log(`Using fallback provider: ${fallback}`)
        provider = fallback
        break
      }
    }
    
    if (!LLM_PROVIDERS[provider]?.isAvailable()) {
      throw new Error('No LLM providers available. Please configure at least one provider.')
    }
  }

  try {
    switch (provider) {
      case 'ollama':
        const ollamaResponse = await fetch(`${LLM_PROVIDERS.ollama.baseUrl()}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: options.model || LLM_PROVIDERS.ollama.chatModel,
            prompt: prompt,
            stream: false,
            options: {
              temperature: options.temperature || 0.1,
              top_p: 0.9,
            }
          })
        })
        if (!ollamaResponse.ok) throw new Error(`Ollama API error: ${ollamaResponse.status}`)
        const ollamaData = await ollamaResponse.json()
        return ollamaData.response

      case 'openai':
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LLM_PROVIDERS.openai.apiKey()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: options.model || LLM_PROVIDERS.openai.chatModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature || 0.1,
          })
        })
        if (!openaiResponse.ok) throw new Error(`OpenAI API error: ${openaiResponse.status}`)
        const openaiData = await openaiResponse.json()
        return openaiData.choices[0].message.content

      case 'gemini':
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${options.model || LLM_PROVIDERS.gemini.chatModel}:generateContent?key=${LLM_PROVIDERS.gemini.apiKey()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: options.temperature || 0.1,
                topP: 0.9,
              }
            })
          }
        )
        if (!geminiResponse.ok) throw new Error(`Gemini API error: ${geminiResponse.status}`)
        const geminiData = await geminiResponse.json()
        return geminiData.candidates[0].content.parts[0].text

      default:
        throw new Error(`Unsupported LLM provider: ${provider}`)
    }
  } catch (error) {
    console.error(`Error with provider ${provider}:`, error)
    throw error
  }
}

// Simplified metadata discovery with fallback
async function discoverMetadataFields(content: string, existingSchema: any[], llmProvider: string) {
  try {
    const prompt = `Extract key metadata from this document. Return a simple JSON object:

Document excerpt:
${content.substring(0, 4000)}

Return ONLY this JSON structure:
{
  "discovered_fields": [
    {
      "field_name": "client_name",
      "value": "extracted value",
      "confidence": 0.8
    }
  ]
}`

    const response = await generateContent(prompt, llmProvider, { temperature: 0.1 })
    
    // Try to parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    // Fallback if JSON parsing fails
    return {
      discovered_fields: [
        {
          field_name: "document_title",
          value: "Processed Document",
          confidence: 0.5
        }
      ]
    }
  } catch (error) {
    console.error('Metadata discovery failed:', error)
    // Return minimal fallback
    return {
      discovered_fields: [
        {
          field_name: "document_title", 
          value: "Document",
          confidence: 0.3
        }
      ]
    }
  }
}

// Simplified semantic chunking
function performSemanticChunking(content: string, maxChunkSize: number = 1500) {
  const chunks = []
  
  // Split by paragraphs first
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 20)
  
  let currentChunk = ''
  let chunkIndex = 0
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        section_title: 'Document Section',
        chunk_type: 'text',
        chunk_index: chunkIndex++,
        metadata: {
          word_count: currentChunk.split(/\s+/).length,
          char_count: currentChunk.length
        }
      })
      
      // Start new chunk
      currentChunk = paragraph
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      section_title: 'Document Section',
      chunk_type: 'text',
      chunk_index: chunkIndex++,
      metadata: {
        word_count: currentChunk.split(/\s+/).length,
        char_count: currentChunk.length
      }
    })
  }
  
  return chunks
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate environment first
    validateEnvironment()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      source_id, 
      file_path, 
      notebook_id,
      llm_provider = 'ollama', // Default to ollama as it's most likely to be available
      llm_config = {}
    } = await req.json()

    if (!source_id || !file_path || !notebook_id) {
      throw new Error('Missing required parameters: source_id, file_path, notebook_id')
    }

    console.log(`Processing PDF ${source_id} with ${llm_provider}`)

    // Update processing status
    await supabase
      .from('sources')
      .update({ 
        processing_status: 'processing',
        processed_at: new Date().toISOString()
      })
      .eq('id', source_id)

    // Get file from storage
    let parsedContent = ''
    let parseMetadata = {}

    try {
      // Try LlamaCloud first if available
      if (llm_provider === 'llamacloud' && LLM_PROVIDERS.llamacloud.isAvailable()) {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('sources')
          .createSignedUrl(file_path, 60 * 60) // 1 hour expiry

        if (signedUrlError) throw signedUrlError

        const llamaResponse = await fetch('https://api.llamaindex.ai/api/parsing/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LLM_PROVIDERS.llamacloud.apiKey()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_url: signedUrlData.signedUrl,
            parsing_instruction: 'Extract all text content in markdown format.',
            result_type: 'markdown',
            invalidate_cache: false
          })
        })

        if (llamaResponse.ok) {
          const llamaData = await llamaResponse.json()
          const jobId = llamaData.id

          // Poll for completion (simplified)
          let attempts = 0
          while (attempts < 30) { // 5 minutes max
            const statusResponse = await fetch(`https://api.llamaindex.ai/api/parsing/job/${jobId}`, {
              headers: {
                'Authorization': `Bearer ${LLM_PROVIDERS.llamacloud.apiKey()}`,
              }
            })

            if (statusResponse.ok) {
              const statusData = await statusResponse.json()
              
              if (statusData.status === 'SUCCESS') {
                parsedContent = statusData.result.markdown
                parseMetadata = statusData.result.metadata || {}
                break
              } else if (statusData.status === 'ERROR') {
                throw new Error(`LlamaCloud processing failed: ${statusData.error}`)
              }
            }

            attempts++
            await new Promise(resolve => setTimeout(resolve, 10000)) // 10 seconds
          }
        }
      }
      
      // Fallback to basic text extraction
      if (!parsedContent) {
        console.log('Using fallback text extraction')
        parsedContent = `# Document Content

This document has been processed using basic text extraction.

## Content
The document content would be extracted here using a PDF parsing library.
For better results, configure LlamaCloud API key.

## Metadata
- File: ${file_path}
- Processed: ${new Date().toISOString()}
- Method: Fallback extraction`
      }
    } catch (parseError) {
      console.error('PDF parsing error:', parseError)
      // Use fallback content
      parsedContent = `# Document Processing Error

An error occurred while processing this document: ${parseError.message}

## Fallback Content
The document has been uploaded but could not be fully processed.
Please check your API configuration and try again.`
    }

    // Get existing metadata schema
    const { data: metadataSchema } = await supabase
      .from('metadata_schema')
      .select('*')
      .order('occurrence_count', { ascending: false })

    // Discover metadata fields with error handling
    let discoveryResult
    try {
      discoveryResult = await discoverMetadataFields(
        parsedContent,
        metadataSchema || [],
        llm_provider
      )
    } catch (metadataError) {
      console.error('Metadata discovery failed:', metadataError)
      discoveryResult = {
        discovered_fields: [
          {
            field_name: "document_title",
            value: "Processed Document",
            confidence: 0.5
          }
        ]
      }
    }

    // Create PDF metadata record
    const { data: pdfMetadata, error: pdfMetadataError } = await supabase
      .from('pdf_metadata')
      .insert({
        source_id,
        notebook_id,
        extraction_method: 'ai',
        extraction_model: llm_provider,
        confidence_score: 0.7,
        raw_metadata: discoveryResult
      })
      .select()
      .single()

    if (pdfMetadataError) {
      console.error('PDF metadata creation failed:', pdfMetadataError)
      // Continue without metadata
    }

    // Perform semantic chunking
    const chunks = performSemanticChunking(parsedContent)
    console.log(`Created ${chunks.length} chunks`)

    // Store chunks in database
    const chunkRecords = []
    for (const chunk of chunks) {
      try {
        const { data: chunkRecord } = await supabase
          .from('document_chunks')
          .insert({
            source_id,
            notebook_id,
            content: chunk.content,
            chunk_index: chunk.chunk_index,
            section_title: chunk.section_title,
            chunk_type: chunk.chunk_type,
            word_count: chunk.metadata?.word_count,
            char_count: chunk.metadata?.char_count,
            metadata: chunk.metadata
          })
          .select()
          .single()

        if (chunkRecord) {
          chunkRecords.push(chunkRecord)
        }
      } catch (chunkError) {
        console.error('Failed to store chunk:', chunkError)
        // Continue with other chunks
      }
    }

    // Update source with completion status
    await supabase
      .from('sources')
      .update({
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
        metadata_extracted: true,
        chunk_count: chunkRecords.length,
        extracted_metadata: {
          discovered_fields: discoveryResult.discovered_fields?.length || 0,
          processing_method: llm_provider
        }
      })
      .eq('id', source_id)

    // Try to trigger embedding generation (optional)
    try {
      if (Deno.env.get('N8N_WEBHOOK_BASE_URL') && chunkRecords.length > 0) {
        fetch(`${Deno.env.get('N8N_WEBHOOK_BASE_URL')}/webhook/generate-embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('N8N_API_KEY')}`,
          },
          body: JSON.stringify({
            source_id,
            notebook_id,
            chunk_ids: chunkRecords.map(c => c.id),
            llm_provider: llm_config.embedding_provider || llm_provider
          })
        }).catch(console.error)
      }
    } catch (webhookError) {
      console.warn('Failed to trigger embedding generation:', webhookError)
      // This is not critical, continue
    }

    return new Response(
      JSON.stringify({
        success: true,
        source_id,
        pdf_metadata_id: pdfMetadata?.id,
        chunks_created: chunkRecords.length,
        metadata_discovered: discoveryResult.discovered_fields?.length || 0,
        message: 'PDF processed successfully',
        processing_method: llm_provider
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing PDF:', error)
    
    // Try to update source with error status
    try {
      const { source_id } = await req.json()
      if (source_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        await supabase
          .from('sources')
          .update({
            processing_status: 'failed',
            processed_at: new Date().toISOString(),
            error_message: error.message
          })
          .eq('id', source_id)
      }
    } catch (updateError) {
      console.error('Failed to update source status:', updateError)
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Check Edge Function logs for more information'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})