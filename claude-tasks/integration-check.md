# Integration Check Helper

## Purpose
Verify that all local services are running and properly integrated for the Town Planner RAG System.

## Usage
```bash
# Run this check before starting development
node claude-tasks/integration-check.js
```

## What It Checks

### 1. Environment Variables
- [ ] `VITE_SUPABASE_URL` - Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Public anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Server-side key for edge functions
- [ ] `N8N_WEBHOOK_BASE_URL` - n8n webhook endpoint
- [ ] `N8N_API_KEY` - n8n authentication
- [ ] `OLLAMA_BASE_URL` or `OPENAI_API_KEY` - LLM provider credentials

### 2. Service Connectivity
- [ ] Supabase (ports 54321-54323) - Database, API, Edge Functions
- [ ] n8n (port 5678) - Workflow orchestration
- [ ] Ollama (port 11434) - Local LLM service
- [ ] SvelteKit dev server (port 5173)

### 3. Database Schema
- [ ] All v2.0 tables exist with proper structure
- [ ] RLS policies are enabled and configured
- [ ] Default templates and metadata schema seeded

### 4. Edge Functions
- [ ] All 5 edge functions deployed and responding
- [ ] Service role authentication working
- [ ] Function logs accessible

### 5. n8n Workflows
- [ ] Required workflows imported and active
- [ ] Webhook endpoints responding
- [ ] Connection to Supabase established

## Quick Fixes

### Service Not Running
```bash
# Supabase
supabase start

# n8n  
npx n8n start

# Ollama
ollama serve
```

### Edge Function Issues
```bash
# Redeploy all functions
supabase functions deploy --project-ref YOUR_REF

# Check function logs
supabase functions logs --follow
```

### Database Issues
```bash
# Reset and migrate (DEV ONLY)
supabase db reset
supabase db push
```

## Expected Output
✅ All checks pass - Ready for development
❌ Issues found - See specific error messages above