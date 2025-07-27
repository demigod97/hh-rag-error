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

// =====================================================
// Edge Function 3: generate-report
// File: supabase/functions/generate-report/index.ts
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
      notebook_id, 
      template_id, 
      topic, 
      address, 
      additional_context,
      llm_provider = 'ollama',
      llm_config = {},
      embedding_provider = 'ollama'
    } = await req.json()

    if (!notebook_id || !template_id || !topic) {
      throw new Error('Missing required parameters: notebook_id, template_id, topic')
    }

    console.log(`Starting report generation with ${llm_provider}`)

    // Get user ID from auth header
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token!)
    
    if (userError || !user) throw new Error('Unauthorized')

    // Create report generation record
    const { data: reportGeneration, error: reportError } = await supabase
      .from('report_generations')
      .insert({
        user_id: user.id,
        notebook_id,
        template_id,
        title: `${topic} Report`,
        topic,
        address,
        additional_context,
        llm_provider,
        llm_model: llm_config.model,
        llm_config,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (reportError) throw reportError

    // Get report template
    const { data: template, error: templateError } = await supabase
      .from('report_templates')
      .select('*')
      .eq('id', template_id)
      .single()

    if (templateError) throw templateError

    const templateStructure = template.structure.sections

    // Generate queries for each section
    const queries = []
    for (const section of templateStructure) {
      // Main section query
      queries.push({
        section_name: section.name,
        subsection_name: null,
        query: `${section.title} for ${topic}${address ? ` at ${address}` : ''}${additional_context ? `. Context: ${additional_context}` : ''}`,
        section_order: section.order * 10
      })

      // Subsection queries
      if (section.subsections) {
        section.subsections.forEach((subsection: any, index: number) => {
          queries.push({
            section_name: section.name,
            subsection_name: subsection.name,
            query: `${subsection.title} (under ${section.title}) for ${topic}${address ? ` at ${address}` : ''}`,
            section_order: section.order * 10 + index + 1
          })
        })
      }
    }

    // Store report sections
    for (const query of queries) {
      await supabase
        .from('report_sections')
        .insert({
          report_generation_id: reportGeneration.id,
          section_name: query.section_name,
          subsection_name: query.subsection_name,
          query_used: query.query,
          section_order: query.section_order,
          status: 'pending'
        })
    }

    // Trigger report processing
    const processingUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-report-sections`
    
    fetch(processingUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        report_generation_id: reportGeneration.id,
        queries,
        llm_provider,
        llm_config,
        embedding_provider
      })
    }).catch(error => {
      console.error('Failed to trigger report processing:', error)
    })

    return new Response(
      JSON.stringify({
        success: true,
        report_generation_id: reportGeneration.id,
        message: 'Report generation started',
        sections_count: queries.length,
        estimated_time_minutes: Math.ceil(queries.length * 0.5)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error generating report:', error)
    
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

// =====================================================
// Edge Function 4: process-report-sections
// File: supabase/functions/process-report-sections/index.ts
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Multi-LLM content generation
async function generateSectionContent(prompt: string, provider: string, config: any = {}) {
  switch (provider) {
    case 'ollama':
      const ollamaResponse = await fetch(
        `${Deno.env.get('OLLAMA_BASE_URL') || 'http://localhost:11434'}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model || 'qwen3:8b-q4_K_M',
            prompt: prompt,
            stream: false,
            options: {
              temperature: config.temperature || 0.3,
              top_p: 0.9,
              num_predict: config.max_tokens || 2000
            }
          })
        }
      )
      if (!ollamaResponse.ok) throw new Error('Ollama generation failed')
      const ollamaData = await ollamaResponse.json()
      return ollamaData.response

    case 'openai':
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a professional town planning consultant writing detailed, accurate reports.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: config.temperature || 0.3,
          max_tokens: config.max_tokens || 2000
        })
      })
      if (!openaiResponse.ok) throw new Error('OpenAI generation failed')
      const openaiData = await openaiResponse.json()
      return openaiData.choices[0].message.content

    case 'gemini':
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-pro'}:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: config.temperature || 0.3,
              topP: 0.9,
              maxOutputTokens: config.max_tokens || 2000
            }
          })
        }
      )
      if (!geminiResponse.ok) throw new Error('Gemini generation failed')
      const geminiData = await geminiResponse.json()
      return geminiData.candidates[0].content.parts[0].text

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`)
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
      report_generation_id, 
      queries,
      llm_provider = 'ollama',
      llm_config = {},
      embedding_provider = 'ollama'
    } = await req.json()

    if (!report_generation_id || !queries) {
      throw new Error('Missing required parameters')
    }

    console.log(`Processing ${queries.length} report sections with ${llm_provider}`)

    // Get report generation details
    const { data: reportGen, error: reportError } = await supabase
      .from('report_generations')
      .select('*')
      .eq('id', report_generation_id)
      .single()

    if (reportError) throw reportError

    // Perform batch vector search for all queries
    const searchUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/batch-vector-search`
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queries: queries.map((q: any) => q.query),
        notebook_id: reportGen.notebook_id,
        top_k: 5,
        similarity_threshold: 0.7,
        embedding_provider
      })
    })

    if (!searchResponse.ok) throw new Error('Batch vector search failed')
    const searchData = await searchResponse.json()

    // Process each section
    let completedSections = 0
    const totalSections = queries.length
    const generatedSections = []

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i]
      const searchResult = searchData.results[i]

      try {
        // Update section status
        await supabase
          .from('report_sections')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString(),
            chunks_retrieved: searchResult.results?.map((r: any) => r.chunk_id) || []
          })
          .eq('report_generation_id', report_generation_id)
          .eq('section_name', query.section_name)
          .eq('subsection_name', query.subsection_name)

        // Prepare context from search results
        const context = searchResult.results?.map((r: any) => r.content).join('\n\n---\n\n') || ''
        
        // Generate content
        const prompt = `You are a professional town planning consultant writing a section of a planning report.

Context from knowledge base:
${context || 'No specific context available. Use your general knowledge.'}

Report Details:
- Topic: ${reportGen.topic}
${reportGen.address ? `- Address: ${reportGen.address}` : ''}
${reportGen.additional_context ? `- Additional Context: ${reportGen.additional_context}` : ''}

Section: ${query.section_name}${query.subsection_name ? ` - ${query.subsection_name}` : ''}

Write a professional, detailed section for this planning report. The content should be:
- Technically accurate and well-structured
- Based on the provided context where relevant
- Professional in tone and language
- Comprehensive and detailed (aim for 300-500 words)
- Include specific references to planning controls, regulations, or requirements where applicable
- Use proper formatting with paragraphs

Write the section content now:`

        const generatedContent = await generateSectionContent(prompt, llm_provider, llm_config)

        // Store generated content
        const { error: updateError } = await supabase
          .from('report_sections')
          .update({
            status: 'completed',
            generated_content: generatedContent,
            word_count: generatedContent.split(/\s+/).length,
            completed_at: new Date().toISOString()
          })
          .eq('report_generation_id', report_generation_id)
          .eq('section_name', query.section_name)
          .eq('subsection_name', query.subsection_name)

        if (updateError) throw updateError

        generatedSections.push({
          ...query,
          content: generatedContent
        })

        completedSections++

        // Update progress
        const progress = Math.round((completedSections / totalSections) * 100)
        await supabase
          .from('report_generations')
          .update({ progress })
          .eq('id', report_generation_id)

      } catch (sectionError) {
        console.error(`Error processing section ${query.section_name}:`, sectionError)
        
        await supabase
          .from('report_sections')
          .update({
            status: 'failed',
            error_message: sectionError.message,
            completed_at: new Date().toISOString()
          })
          .eq('report_generation_id', report_generation_id)
          .eq('section_name', query.section_name)
          .eq('subsection_name', query.subsection_name)
      }
    }

    // Assemble final report
    const { data: sections, error: sectionsError } = await supabase
      .from('report_sections')
      .select('*')
      .eq('report_generation_id', report_generation_id)
      .order('section_order')

    if (sectionsError) throw sectionsError

    // Create markdown report
    let finalReport = `# ${reportGen.title}\n\n`
    if (reportGen.address) {
      finalReport += `**Property Address:** ${reportGen.address}\n\n`
    }
    finalReport += `**Date:** ${new Date().toLocaleDateString()}\n\n`
    finalReport += `---\n\n`

    // Add table of contents
    finalReport += `## Table of Contents\n\n`
    let tocNumber = 1
    sections?.forEach(section => {
      if (section.generated_content) {
        if (!section.subsection_name) {
          finalReport += `${tocNumber}. ${section.section_name}\n`
          tocNumber++
        } else {
          finalReport += `   - ${section.subsection_name}\n`
        }
      }
    })
    finalReport += `\n---\n\n`

    // Add sections
    sections?.forEach(section => {
      if (section.generated_content) {
        if (!section.subsection_name) {
          finalReport += `## ${section.section_name}\n\n`
        } else {
          finalReport += `### ${section.subsection_name}\n\n`
        }
        finalReport += `${section.generated_content}\n\n`
      }
    })

    // Save report
    const fileName = `reports/${reportGen.user_id}/${report_generation_id}.md`
    const fileBlob = new Blob([finalReport], { type: 'text/markdown' })
    
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(fileName, fileBlob, {
        contentType: 'text/markdown',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
    }

    // Update report generation record
    await supabase
      .from('report_generations')
      .update({
        status: 'completed',
        progress: 100,
        generated_content: finalReport,
        file_path: fileName,
        file_format: 'markdown',
        file_size: fileBlob.size,
        completed_at: new Date().toISOString()
      })
      .eq('id', report_generation_id)

    return new Response(
      JSON.stringify({
        success: true,
        report_generation_id,
        file_path: fileName,
        sections_completed: completedSections,
        total_sections: totalSections,
        download_url: `/storage/v1/object/reports/${fileName}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing report sections:', error)
    
    // Mark report as failed
    if (req.body) {
      const { report_generation_id } = JSON.parse(await req.text())
      if (report_generation_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        await supabase
          .from('report_generations')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', report_generation_id)
      }
    }
    
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