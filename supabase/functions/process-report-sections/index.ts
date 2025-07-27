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

