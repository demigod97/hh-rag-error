import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookRequest {
  webhook_type: 'ingest' | 'chat' | 'template'
  webhook_url?: string
  payload: any
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body with better error handling
    let requestBody: WebhookRequest
    try {
      const bodyText = await req.text()
      console.log('Raw request body:', bodyText)
      requestBody = JSON.parse(bodyText)
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      throw new Error('Invalid JSON in request body')
    }

    const { webhook_type, webhook_url, payload } = requestBody

    console.log('Received request:', { 
      webhook_type, 
      webhook_url: webhook_url ? 'provided' : 'not provided', 
      payload: payload ? 'provided' : 'missing' 
    })

    // Validate required parameters
    if (!webhook_type || !payload) {
      throw new Error('Missing required parameters: webhook_type and payload are required')
    }

    // Get webhook URL from environment or use provided one
    let finalWebhookUrl = webhook_url || ''
    
    if (!finalWebhookUrl) {
      const baseUrl = Deno.env.get('N8N_WEBHOOK_BASE_URL') || 'https://n8n.coralshades.ai'
      
      switch (webhook_type) {
        case 'chat':
          finalWebhookUrl = Deno.env.get('VITE_N8N_CHAT_WEBHOOK') || 
                           `${baseUrl}/webhook-test/hhlm-chat`
          break
        case 'ingest':
          finalWebhookUrl = `${baseUrl}/webhook-test/ingest`
          break
        case 'template':
          finalWebhookUrl = `${baseUrl}/webhook-test/template`
          break
        default:
          throw new Error(`Unknown webhook_type: ${webhook_type}`)
      }
    }

    if (!finalWebhookUrl) {
      throw new Error(`No webhook URL available for ${webhook_type} webhook`)
    }

    console.log(`Triggering ${webhook_type} webhook: ${finalWebhookUrl}`)

    // Add webhook type to payload for n8n routing
    const enhancedPayload = {
      ...payload,
      webhook_type,
      timestamp: new Date().toISOString()
    }

    // Get n8n API key from Supabase secrets
    const n8nApiKey = Deno.env.get('N8N_API_KEY')
    console.log('N8N API Key available:', n8nApiKey ? 'yes' : 'no')
    
    // Prepare headers with authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Supabase-Edge-Function/1.0'
    }
    
    // Add API key header if available
    if (n8nApiKey) {
      headers['X-Api-Key'] = n8nApiKey
      console.log('Added X-Api-Key header to request')
    } else {
      console.warn('N8N_API_KEY not found in environment variables')
    }

    console.log('Making request to n8n with payload:', JSON.stringify(enhancedPayload, null, 2))

    // Call the n8n webhook
    const response = await fetch(finalWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedPayload)
    })

    console.log('n8n response status:', response.status)
    console.log('n8n response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('n8n webhook error response:', errorText)
      throw new Error(`n8n webhook failed: ${response.status} ${errorText}`)
    }

    let responseData = {}
    try {
      responseData = await response.json()
    } catch (jsonError) {
      console.log('n8n response is not JSON, treating as success')
      responseData = { message: 'Success' }
    }
    
    console.log('n8n response data:', responseData)
    console.log(`${webhook_type} webhook completed successfully`)

    return new Response(
      JSON.stringify({
        success: true,
        webhook_type,
        response: responseData,
        message: `${webhook_type} webhook triggered successfully`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error triggering n8n webhook:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to trigger n8n webhook'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})