# 🏙️ Town Planner RAG System

A **multi‑LLM, retrieval‑augmented generation (RAG)** platform for town‑planning professionals. Upload planning documents (PDF/DOCX), extract structured data & metadata, ask contextual questions, and auto‑generate professional reports with enhanced UI/UX powered by **shadcn/ui**.

---

## ✨ Key Features

| Area                     | Highlights                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Document Ingestion**   | • LlamaCloud OCR + markdown parsing  • AI metadata discovery  • Semantic chunking with table preservation |
| **Vector Search**        | Postgres **`vector`** extension + `chunk_embeddings` table for fast cosine similarity via `ivfflat` index |
| **Multi‑LLM**            | Ollama (local), OpenAI, Gemini, LlamaCloud – switch per request; unified config via `LLM_DEFAULTS`        |
| **Report Engine**        | Edge functions generate section queries, batch vector search, and draft content into **Markdown / DOCX**  |
| **Enhanced UI/UX**       | Modern **shadcn/ui** components with responsive design, real-time feedback, and professional report viewing |
| **Realtime Workflows**   | n8n webhooks orchestrate chat, embedding jobs, and status updates with enhanced user feedback             |
| **Secure, Multi‑Tenant** | Supabase Auth + RLS on every table; per‑user storage buckets                                              |

---

## 🏗️ High‑Level Architecture

```text
┌──────────────┐          ┌───────────────┐        ┌────────────────┐
│  Frontend    │──files──▶│  Supabase      │──trig──▶ trigger-n8n    │
│  (React/TS)  │  REST    │  (DB + Storage)│        │  Edge Function │
│  + shadcn/ui │          │                │        │                │
└──────────────┘          └──────┬─────────┘        └──────┬─────────┘
       ▲ WebSocket/HTTP               │ REST (RLS)                │ Webhooks  
       │                              ▼                          ▼
┌──────────────┐             ┌──────────────┐          ┌────────────────┐
│    n8n        │◀──chat/───▶│    OpenAI    │  embed   │     n8n       │
│  Workflows    │   ingest   │    Gemini    │───────▶ │   Webhooks    │
│               │   reports  │    Ollama    │          │               │
└──────────────┘             └──────────────┘          └────────────────┘
```

---

## 📂 Repository Structure

```
├─ supabase/
│  ├─ migrations/              # SQL schema (see v2.0)
│  ├─ functions/
│  │   ├─ process-pdf-with-metadata/
│  │   ├─ generate-embeddings/
│  │   ├─ batch-vector-search/
│  │   ├─ generate-report/
│  │   ├─ process-report-sections/
│  │   └─ trigger-n8n/         # Main webhook router
├─ src/
│  ├─ components/
│  │   ├─ ui/                  # shadcn/ui components
│  │   │   ├─ enhanced-report-viewer.tsx  # Advanced report rendering
│  │   │   ├─ markdown-renderer.tsx       # Enhanced markdown parsing
│  │   │   ├─ report-display.tsx          # JSON report detection
│  │   │   └─ error-display.tsx           # Improved error handling
│  │   ├─ ChatStream.tsx       # Real-time chat with enhanced feedback
│  │   ├─ ReportsPanel.tsx     # Report management interface
│  │   └─ ErrorBoundary.tsx    # Comprehensive error boundaries
│  ├─ lib/
│  │   ├─ api.ts               # Supabase client + helper SDK
│  │   ├─ error-handling.ts    # Enhanced error management
│  │   └─ session-management.ts # User session handling
│  ├─ hooks/
│  │   ├─ useErrorHandler.ts   # Global error handling
│  │   └─ useNetworkStatus.ts  # Connection monitoring
├─ claude-tasks/               # Claude AI integration scripts
├─ cypress/                    # E2E testing suite
└─ doc/                        # Comprehensive documentation
```

---

## 🔧 Database Overview (Supabase Postgres v2.0)

<table>
<tr><th>Category</th><th>Tables</th><th>Purpose</th></tr>
<tr><td>Auth / Profiles</td><td><code>user_profiles</code></td><td>Extends <code>auth.users</code> with preferences</td></tr>
<tr><td>Projects</td><td><code>notebooks</code> · <code>sources</code></td><td>Group documents + upload tracking</td></tr>
<tr><td>Metadata</td><td><code>metadata_schema</code> · <code>pdf_metadata</code> · <code>pdf_metadata_values</code></td><td>AI field discovery & validation</td></tr>
<tr><td>RAG</td><td><code>document_chunks</code> · <code>chunk_embeddings</code> · <code>chunk_metadata_associations</code></td><td>Semantic search corpus</td></tr>
<tr><td>Chat</td><td><code>chat_sessions</code> · <code>chat_messages</code></td><td>Conversation history & token usage</td></tr>
<tr><td>Reports</td><td><code>report_templates</code> · <code>report_generations</code> · <code>report_sections</code></td><td>Templated report pipeline</td></tr>
<tr><td>Jobs</td><td><code>processing_jobs</code></td><td>Background workflow status</td></tr>
</table>

**Key indexes & helpers**

* `idx_embeddings_vector` — vector cosine IVFFLAT
* `match_embeddings(query_embedding)` — server‑side similarity SQL function
* `v_document_stats`, `v_active_jobs` — monitoring views

Row‑level security (RLS) enabled on every table; policies mirror `user_id` ownership.

---

## 🚀 Complete Setup & Workflow Guide

### 1. **Initial Setup**

```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd hh-rag-error
npm install
npm install -g supabase

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

### 2. **Database Setup**

```bash
# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Apply database migrations
supabase db push

# Generate TypeScript types
npm run supabase:types
```

### 3. **Edge Functions Deployment**

```bash
# Deploy all edge functions
npm run functions:deploy

# Or deploy individually
npm run functions:deploy:trigger
supabase functions deploy generate-report
supabase functions deploy process-report-sections
```

### 4. **n8n Workflows Setup**

```bash
# Start n8n (if using Docker)
npm run docker:up

# Or install locally
npm install -g n8n
n8n start

# Import workflows from n8n-workflows.json
# Configure webhooks at https://n8n.coralshades.ai/
```

### 5. **LLM Providers Setup**

```bash
# Option A: Local Ollama (recommended for development)
ollama serve
ollama pull qwen3:8b-q4_K_M
ollama pull nomic-embed-text:latest

# Option B: Configure API keys in .env.local
# OPENAI_API_KEY=sk-...
# GEMINI_API_KEY=AIza...
```

### 6. **Frontend Development**

```bash
# Start development server
npm run dev

# Open http://localhost:5173
```

---

## 📋 Step-by-Step User Workflow

### **Document Upload & Processing**

1. **Upload Document**
   - Navigate to main interface
   - Click "Upload Document" or drag & drop PDF/DOCX
   - Enhanced UI shows upload progress with shadcn Progress component
   - Files automatically stored in Supabase Storage with user-specific buckets

2. **Processing Feedback**
   - Real-time processing status with animated indicators
   - Lottie animations for "thinking" states
   - Toast notifications for status updates using shadcn Sonner
   - Network status indicator shows connection health

3. **Document Analysis**
   - LlamaCloud OCR extracts text and preserves formatting
   - AI automatically discovers metadata fields
   - Semantic chunking maintains table structure
   - Vector embeddings generated using configured provider

### **Interactive Chat Experience**

1. **Enhanced Chat Interface**
   - Modern shadcn/ui Card-based message layout
   - Real-time typing indicators with animated dots
   - Network status monitoring with automatic reconnection
   - Error boundaries prevent chat crashes

2. **Message Feedback**
   - Immediate send confirmation with CheckCircle icon
   - Processing status: "Workflow was started" with animation
   - Streaming responses with markdown rendering
   - Citation popovers for document references

3. **Error Handling**
   - Graceful error displays with retry options
   - Network disconnection alerts
   - Fallback content for failed operations
   - Comprehensive error logging

### **Advanced Report Generation**

1. **Report Creation**
   - Access Reports Panel from main navigation
   - Select from available templates
   - Enhanced form with validation and real-time feedback
   - Progress tracking with status badges

2. **Report Viewing Experience**
   - **Enhanced Report Viewer** with professional layout
   - **Table of Contents** with section navigation
   - **Figure References** as interactive popovers
   - **Responsive Design** for mobile and desktop

3. **Report Features**
   - **Search functionality** within report sections
   - **Collapsible sections** for better organization
   - **Download/Print/Share** actions with proper styling
   - **Active section highlighting** during scroll

### **Advanced UI/UX Features**

1. **Component Library (shadcn/ui)**
   - Consistent design system across all interfaces
   - Accessible components with proper ARIA labels
   - Dark/light theme support
   - Responsive breakpoints for all screen sizes

2. **Enhanced Error Handling**
   - Global error boundary with recovery options
   - Specific error displays for different failure types
   - User-friendly error messages with actionable advice
   - Automatic retry mechanisms with exponential backoff

3. **Performance Optimizations**
   - Component lazy loading for faster initial render
   - Virtual scrolling for large document lists
   - Optimized re-renders with React.memo
   - Efficient state management with React Query

---

## 🔌 Edge Functions & API Architecture

| Function                    | Description                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------ |
| **trigger-n8n**            | Main router for all AI operations with enhanced error handling                      |
| **generate-report**         | Creates structured reports with template support                                     |
| **process-report-sections** | Handles individual report sections with batch processing                            |
| **batch-vector-search**     | Optimized similarity search with result ranking                                     |
| **process-pdf-with-metadata** | Enhanced document processing with metadata extraction                              |

All functions include:
- JWT authentication and rate limiting
- Comprehensive error handling and logging
- Type-safe request/response interfaces
- Integration with n8n webhook system

---

## 🤖 AI Agent Integration

See **[AGENTS.md](./AGENTS.md)** for detailed AI agent documentation including:
- Document Processing Agent workflows
- Chat/Report Generation Agent capabilities
- Integration patterns with Edge Functions
- Error handling and monitoring strategies

---

## ⚙️ Configuration & Environment

### Environment Variables (.env.local)

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# LLM Provider Keys
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
LLAMACLOUD_API_KEY=llx-...

# n8n Integration
N8N_WEBHOOK_BASE_URL=https://n8n.coralshades.ai
N8N_API_KEY=...

# Development Settings
VITE_APP_ENV=development
VITE_ENABLE_DEBUG=true
```

### LLM Provider Defaults

| Provider | Chat Model        | Embed Model               | Use Case               |
| -------- | ----------------- | ------------------------- | ---------------------- |
| Ollama   | `qwen3:8b-q4_K_M` | `nomic-embed-text:latest` | Local development      |
| OpenAI   | `gpt-4o`          | `text-embedding-3-small`  | Production quality     |
| Gemini   | `gemini-pro`      | `embedding-001`           | Google ecosystem       |
| LlamaCloud | `llama-3.1-70b` | `llama-embed-large`       | Document processing    |

---

## 🧪 Testing & Development Scripts

```bash
# Development helpers
npm run claude:check          # Integration health check
npm run claude:dev            # Development tasks
npm run claude:health         # Service health monitoring

# Supabase operations
npm run supabase:types        # Regenerate TypeScript types
npm run supabase:reset        # Reset local database
npm run supabase:migrate      # Apply migrations

# Function management
npm run functions:deploy      # Deploy all functions
npm run functions:logs        # Monitor function logs

# Service management
npm run docker:up             # Start all services
npm run docker:down           # Stop all services
npm run logs:n8n              # n8n container logs
npm run logs:supabase         # Supabase logs

# Testing
npm run test:supabase         # Test database connection
npm run lint                  # Code quality checks
```

---

## 📈 Monitoring & Troubleshooting

### Health Checks

```bash
# Check all services
npm run claude:health

# Individual service checks
supabase status
curl http://localhost:11434/api/tags  # Ollama
curl http://localhost:5678/healthz   # n8n
```

### Log Monitoring

```bash
# Real-time function logs
npm run functions:logs:trigger

# Database queries (enable log_statement = 'all')
supabase logs --type postgres

# n8n workflow executions
npm run logs:n8n
```

### Common Issues & Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Upload failures** | Files not processing | Check n8n webhook connectivity |
| **Chat not responding** | Messages stuck "processing" | Verify LLM provider connection |
| **Reports not generating** | Empty report panel | Check report templates in database |
| **UI components broken** | Missing styles/functionality | Reinstall shadcn components |

---

## 🛡️ Security & Production Checklist

### Development
- [x] Environment variables in `.env.local`
- [x] Local Supabase with development keys
- [x] CORS enabled for localhost
- [x] Debug logging enabled

### Production
- [ ] Environment variables in hosting platform
- [ ] Production Supabase project
- [ ] CORS restricted to your domain
- [ ] API keys stored as Supabase secrets
- [ ] Rate limiting configured
- [ ] Error monitoring (Sentry/similar)
- [ ] Performance monitoring
- [ ] Database backups enabled

---

## 🚀 Deployment Options

### **Option A: Vercel + Supabase (Recommended)**
```bash
# Frontend deployment
vercel deploy

# Edge Functions auto-deploy with Supabase CLI
supabase functions deploy --project-ref <prod-ref>
```

### **Option B: Docker Compose**
```bash
# Build production image
docker build -t town-planner-rag .

# Deploy with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

### **Option C: Self-hosted**
```bash
# Build static files
npm run build

# Serve with your preferred web server
# Configure reverse proxy for API routes
```

---

## 👥 Contributing & Development

### Getting Started
1. Fork repository and create feature branch
2. Install dependencies: `npm install`
3. Run development environment: `npm run dev`
4. Make changes with proper TypeScript types
5. Test with: `npm run lint && npm run test:supabase`
6. Submit PR with clear description and screenshots

### Code Standards
- **TypeScript**: Strict mode enabled, proper types required
- **ESLint**: Follow configured rules, fix all warnings
- **shadcn/ui**: Use existing components, follow design system
- **Error Handling**: Use error boundaries and proper try-catch
- **Testing**: Add tests for new functionality

### Component Development
- Use shadcn/ui components as base
- Follow accessibility guidelines (ARIA labels)
- Implement proper loading and error states
- Ensure mobile responsiveness
- Add proper TypeScript interfaces

---

## 📜 License & Credits

**MIT License** © 2025 CoralShades  
Built with ❤️ in Melbourne

### Key Technologies
- **Frontend**: React, TypeScript, Vite, shadcn/ui, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **AI/ML**: Ollama, OpenAI, Google Gemini, LlamaCloud
- **Automation**: n8n workflows
- **Deployment**: Vercel, Docker

### Special Thanks
- shadcn for the amazing UI component library
- Supabase team for the comprehensive backend platform
- n8n community for workflow automation tools
- Open source contributors and the developer community

---

*For detailed AI agent documentation, see [AGENTS.md](./AGENTS.md)*  
*For troubleshooting guides, see [doc/debugging-realtime-chat.md](./doc/debugging-realtime-chat.md)*
