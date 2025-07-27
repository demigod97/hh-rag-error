// =====================================================
// Edge Function 2: batch-vector-search
// File: supabase/functions/batch-vector-search/index.ts
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate embeddings based on provider
async function generateEmbedding(text: string, provider: string = 'ollama') {
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
      queries, 
      notebook_id, 
      source_ids = null,
      top_k = 10,
      similarity_threshold = 0.7,
      embedding_provider = 'ollama'
    } = await req.json()

    if (!queries || !Array.isArray(queries)) {
      throw new Error('Queries array is required')
    }

    console.log(`Performing batch search with ${queries.length} queries using ${embedding_provider}`)

    // Generate embeddings for all queries
    const embeddingPromises = queries.map(async (query: string) => {
      try {
        const embedding = await generateEmbedding(query, embedding_provider)
        return { query, embedding, error: null }
      } catch (error) {
        console.error(`Embedding generation failed for query "${query}":`, error)
        return { query, embedding: null, error: error.message }
      }
    })

    const queryEmbeddings = await Promise.all(embeddingPromises)

    // Perform vector searches
    const searchResults = []
    
    for (const { query, embedding, error } of queryEmbeddings) {
      if (error || !embedding) {
        searchResults.push({ query, results: [], error })
        continue
      }

      // Convert embedding to PostgreSQL vector format
      const embeddingStr = `[${embedding.join(',')}]`
      
      // Call the match_embeddings function
      const { data, error: searchError } = await supabase.rpc('match_embeddings', {
        query_embedding: embeddingStr,
        match_count: top_k,
        filter_notebook_id: notebook_id,
        filter_source_ids: source_ids,
        similarity_threshold: similarity_threshold
      })

      if (searchError) {
        console.error(`Search error for query "${query}":`, searchError)
        searchResults.push({ query, results: [], error: searchError.message })
      } else {
        // Enhance results with metadata
        const enhancedResults = await enhanceSearchResults(data || [], supabase)
        searchResults.push({ query, results: enhancedResults, error: null })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: searchResults,
        total_queries: queries.length,
        embedding_provider: embedding_provider
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in batch vector search:', error)
    
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

// Enhance search results with additional metadata
async function enhanceSearchResults(results: any[], supabase: any) {
  if (!results.length) return results

  const chunkIds = results.map(r => r.chunk_id)
  
  // Get chunk metadata associations
  const { data: associations } = await supabase
    .from('chunk_metadata_associations')
    .select(`
      chunk_id,
      schema_field_id,
      metadata_schema (
        field_name,
        display_name
      )
    `)
    .in('chunk_id', chunkIds)

  // Group associations by chunk
  const associationsByChunk = associations?.reduce((acc: any, assoc: any) => {
    if (!acc[assoc.chunk_id]) acc[assoc.chunk_id] = []
    acc[assoc.chunk_id].push({
      field_name: assoc.metadata_schema.field_name,
      display_name: assoc.metadata_schema.display_name
    })
    return acc
  }, {}) || {}

  // Enhance results
  return results.map(result => ({
    ...result,
    metadata_fields: associationsByChunk[result.chunk_id] || []
  }))
}

