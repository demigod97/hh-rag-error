// =====================================================
// Edge Function 5: generate-embeddings
// File: supabase/functions/generate-embeddings/index.ts
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      chunk_ids,
      notebook_id,
      source_id,
      embedding_provider = 'ollama'
    } = await req.json()

    if (!chunk_ids || !Array.isArray(chunk_ids)) {
      throw new Error('chunk_ids array is required')
    }

    console.log(`Generating embeddings for ${chunk_ids.length} chunks using ${embedding_provider}`)

    // Get chunks
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('*')
      .in('id', chunk_ids)

    if (chunksError) throw chunksError

    let successCount = 0
    let errorCount = 0

    // Process each chunk
    for (const chunk of chunks) {
      try {
        // Generate embedding
        const embedding = await generateEmbedding(chunk.content, embedding_provider)
        
        // Store embedding
        const { error: embedError } = await supabase
          .from('chunk_embeddings')
          .upsert({
            chunk_id: chunk.id,
            notebook_id: chunk.notebook_id,
            embedding: `[${embedding.join(',')}]`,
            embedding_model: `${embedding_provider}-${getModelName(embedding_provider)}`,
            embedding_dimension: embedding.length,
            metadata: {
              section_title: chunk.section_title,
              chunk_type: chunk.chunk_type
            }
          })

        if (embedError) throw embedError

        // Update chunk status
        await supabase
          .from('document_chunks')
          .update({
            embedding_generated: true,
            embedding_model: `${embedding_provider}-${getModelName(embedding_provider)}`,
            embedding_generated_at: new Date().toISOString()
          })
          .eq('id', chunk.id)

        successCount++
      } catch (error) {
        console.error(`Failed to generate embedding for chunk ${chunk.id}:`, error)
        errorCount++
      }
    }

    // Update source embedding count
    if (source_id) {
      await supabase
        .from('sources')
        .update({
          embedding_count: successCount
        })
        .eq('id', source_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        chunks_processed: chunks.length,
        embeddings_generated: successCount,
        errors: errorCount,
        embedding_provider
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error generating embeddings:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

function getModelName(provider: string): string {
  switch (provider) {
    case 'ollama': return 'nomic-embed-text'
    case 'openai': return 'text-embedding-3-small'
    case 'gemini': return 'embedding-001'
    default: return 'unknown'
  }
}

// Reuse the generateEmbedding function from batch-vector-search
async function generateEmbedding(text: string, provider: string = 'ollama') {
  // Implementation same as in batch-vector-search
  switch (provider) {
    case 'ollama':
      const ollamaUrl = `${Deno.env.get('OLLAMA_BASE_URL') || 'http://localhost:11434'}/api/embeddings`
      const ollamaResponse = await fetch(ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text:latest',
          prompt: text
        })
      })
      if (!ollamaResponse.ok) throw new Error('Ollama embedding failed')
      const ollamaData = await ollamaResponse.json()
      return ollamaData.embedding

    case 'openai':
      const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text
        })
      })
      if (!openaiResponse.ok) throw new Error('OpenAI embedding failed')
      const openaiData = await openaiResponse.json()
      return openaiData.data[0].embedding

    case 'gemini':
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/embedding-001',
            content: { parts: [{ text }] }
          })
        }
      )
      if (!geminiResponse.ok) throw new Error('Gemini embedding failed')
      const geminiData = await geminiResponse.json()
      return geminiData.embedding.values

    default:
      throw new Error(`Unsupported embedding provider: ${provider}`)
  }
}