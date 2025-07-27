# Town Planner RAG System - Complete Setup Guide

## 🏗️ System Overview

The Town Planner RAG system is a comprehensive document processing and AI-powered planning assistant that features:

- **Multi-LLM Support**: Switch between Ollama (local), OpenAI, Gemini, and LlamaCloud
- **AI-Driven Metadata Extraction**: Automatically discovers and standardizes metadata fields
- **Semantic Chunking**: Intelligent document splitting for optimal RAG performance
- **Report Generation**: Automated planning report creation with customizable templates
- **Real-time Processing**: Live updates on document processing and report generation

## 📋 Prerequisites

1. **Supabase Account** with a project created
2. **n8n Instance** running locally or hosted
3. **Ollama** installed locally (optional, for local LLM)
4. **API Keys** for:
   - LlamaCloud (for PDF parsing)
   - OpenAI (optional)
   - Gemini (optional)
5. **Node.js 18+** and npm installed

## 🚀 Step-by-Step Setup

### Step 1: Clone and Configure Project

```bash
# Clone the repository
git clone [your-repo-url]
cd town-planner

# Install dependencies
npm install

# Install Supabase CLI globally
npm install -g supabase
```

### Step 2: Environment Configuration

1. Create `.env.local` file:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://ttbcziwdfkorkopgouar.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LLM Provider API Keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
LLAMACLOUD_API_KEY=llx-...

# Ollama Configuration (Local)
OLLAMA_BASE_URL=http://localhost:11434

# n8n Configuration
N8N_WEBHOOK_BASE_URL=http://localhost:5678
N8N_API_KEY=your_n8n_api_key
```

### Step 3: Database Setup

1. **Link to Supabase project**:
```bash
supabase link --project-ref ttbcziwdfkorkopgouar
```

2. **Create migration file**:
```bash
supabase migration new complete_town_planner_schema
```

3. **Copy the database schema** from the "Complete Database Schema" artifact to:
   `supabase/migrations/[timestamp]_complete_town_planner_schema.sql`

4. **Run migration**:
```bash
supabase db push
```

### Step 4: Deploy Edge Functions

1. **Create function directories**:
```bash
mkdir -p supabase/functions/{process-pdf-with-metadata,batch-vector-search,generate-report,process-report-sections,generate-embeddings}
```

2. **Copy edge function code** from the artifacts to respective `index.ts` files

3. **Deploy all functions**:
```bash
# Using the helper script
chmod +x deploy-functions.sh
./deploy-functions.sh

# Or manually
supabase functions deploy process-pdf-with-metadata --no-verify-jwt
supabase functions deploy batch-vector-search --no-verify-jwt
supabase functions deploy generate-report --no-verify-jwt
supabase functions deploy process-report-sections --no-verify-jwt
supabase functions deploy generate-embeddings --no-verify-jwt
```

4. **Set environment variables in Supabase**:
```bash
# Using the helper script
chmod +x set-secrets.sh
./set-secrets.sh

# Or manually
supabase secrets set OPENAI_API_KEY=your_key
supabase secrets set GEMINI_API_KEY=your_key
supabase secrets set LLAMACLOUD_API_KEY=your_key
supabase secrets set OLLAMA_BASE_URL=http://host.docker.internal:11434
supabase secrets set N8N_WEBHOOK_BASE_URL=http://host.docker.internal:5678
```

**CRITICAL: Verify Edge Function Environment Variables**

After deploying, verify that the environment variables are properly set:

```bash
# Check that secrets are set
supabase secrets list

# Test edge function with a simple request
curl -X POST "https://your-project.supabase.co/functions/v1/process-pdf-with-metadata" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

If you get environment variable errors:
1. Ensure all required secrets are set using `supabase secrets set`
2. Re-deploy the functions after setting secrets
3. Check the function logs: `supabase functions logs process-pdf-with-metadata --follow`
### Step 5: n8n Workflow Setup

1. **Start n8n**:
```bash
# Using Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Or using npm
npx n8n
```

2. **Import workflows**:
   - Open n8n UI at http://localhost:5678
   - Go to Workflows → Import
   - Import the workflows from the "n8n Workflow Configurations" artifact
   - Update the credentials and variables in each workflow

3. **Activate workflows**:
   - Enable each imported workflow
   - Test webhooks are accessible

### Step 6: Frontend Configuration

1. **Update API configuration**:
   - Copy the code from "Frontend API Integration" artifact to `src/lib/api.ts`

2. **Generate TypeScript types**:
```bash
supabase gen types typescript --linked > src/lib/database.types.ts
```

3. **Update components** to use the new API functions

### Step 7: Ollama Setup (Optional)

If using Ollama for local LLM:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull qwen3:8b-q4_K_M       # For chat/generation
ollama pull nomic-embed-text      # For embeddings

# Start Ollama server
ollama serve
```

## 🧪 Testing the Setup

### 1. Test Database Connection

```sql
-- Run in Supabase SQL editor
SELECT * FROM metadata_schema;
SELECT * FROM report_templates;
```

### 2. Test Edge Functions

```bash
# Test PDF processing
curl -X POST https://ttbcziwdfkorkopgouar.supabase.co/functions/v1/process-pdf-with-metadata \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "test",
    "file_path": "test.pdf",
    "notebook_id": "test",
    "llm_provider": "ollama"
  }'
```

### 3. Test n8n Webhooks

```bash
# Test chat webhook
curl -X POST http://localhost:5678/webhook/hhlm-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test",
    "message": "Hello",
    "context": [],
    "history": [],
    "llm_provider": "ollama"
  }'
```

### 4. Run Frontend

```bash
npm run dev
```

Visit http://localhost:5173 and test:
- Creating a new notebook
- Uploading a PDF
- Starting a chat session
- Generating a report

## 🎯 Usage Guide

### Document Upload Flow

1. **Create a Notebook** for your project
2. **Upload PDFs** - they will be processed automatically:
   - LlamaCloud extracts text and structure
   - AI discovers metadata fields
   - Document is chunked semantically
   - Embeddings are generated

### Chat Interface

1. **Select sources** for context
2. **Choose LLM provider** in settings
3. **Ask questions** - the system will:
   - Search relevant chunks
   - Provide context to LLM
   - Generate accurate responses

### Report Generation

1. **Select a template** (Heritage, Planning, etc.)
2. **Enter project details**:
   - Topic/Project name
   - Address (optional)
   - Additional context
3. **Generate report** - the system will:
   - Create section queries
   - Search for relevant content
   - Generate each section
   - Compile final report

## 🔧 Troubleshooting

### Common Issues

1. **PDF Processing Stuck**
   - Check LlamaCloud API key
   - Verify edge function logs: `supabase functions logs process-pdf-with-metadata`
   - Check processing_jobs table for errors

2. **Chat Not Working**
   - Verify n8n workflows are active
   - Check webhook URLs in environment
   - Test n8n connectivity

3. **Embeddings Not Generated**
   - Ensure Ollama is running
   - Check model is downloaded: `ollama list`
   - Verify edge function has correct Ollama URL

4. **Report Generation Fails**
   - Check LLM provider settings
   - Verify sufficient context in database
   - Check report_generations table for errors

### Debug Commands

```bash
# View edge function logs
supabase functions logs --tail

# Check specific function
supabase functions logs process-pdf-with-metadata --tail

# Test Supabase connection
supabase status

# Check n8n logs
docker logs n8n
```

## 📊 Monitoring

### Database Queries

```sql
-- Check processing status
SELECT * FROM processing_jobs 
WHERE status IN ('pending', 'processing') 
ORDER BY created_at DESC;

-- View document statistics
SELECT * FROM v_document_stats;

-- Check metadata discovery
SELECT * FROM get_metadata_field_stats();
```

### Performance Optimization

1. **Batch Processing**: Process multiple documents in parallel
2. **Caching**: Implement Redis for embedding cache
3. **Index Optimization**: Ensure vector indexes are optimized
4. **Chunking Strategy**: Adjust chunk size based on use case

## 🚢 Production Deployment

### Supabase

1. Enable RLS policies on all tables
2. Set up proper authentication
3. Configure rate limiting
4. Enable point-in-time recovery

### n8n

1. Use environment variables for credentials
2. Set up error workflows
3. Configure webhook authentication
4. Enable execution history

### Security Checklist

- [ ] All API keys in environment variables
- [ ] RLS policies active
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Backup strategy in place
- [ ] Monitoring alerts configured

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [n8n Documentation](https://docs.n8n.io)
- [Ollama Documentation](https://github.com/ollama/ollama)
- [LlamaCloud API Docs](https://docs.llamaindex.ai/en/stable/api_reference/llama_cloud/)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review edge function logs
3. Verify all services are running
4. Check environment variables

Remember to never commit sensitive API keys to version control!