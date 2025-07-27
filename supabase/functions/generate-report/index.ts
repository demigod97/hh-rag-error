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

