# 🤖 AGENTS.MD – AI Agent Development Guide (v2.0)

> **TL;DR** — This file is the canonical playbook for building, deploying, and extending the multi‑LLM RAG agents that power the **Town Planner RAG System**. Everything below reflects the **July 2025** architecture refactor: new Supabase schema **v2.0**, Deno edge functions, pgvector search, and n8n‑orchestrated workflows.

## AI Agent Roles & Responsibilities

### 1. 📋 Document Processing Agent
**Role**: Intelligent PDF ingestion and metadata extraction
- **Primary Function**: Process uploaded PDFs through LlamaCloud OCR
- **AI Capabilities**: 
  - Extract structured metadata (client, address, lot details, planning controls)
  - Classify document types (heritage reports, planning proposals, etc.)
  - Identify key entities and relationships
- **Integration**: `process-pdf-with-metadata` edge function
- **LLM Provider**: Gemini or OpenAI for metadata extraction

### 2. 🔍 Embedding Generation Agent  
**Role**: Convert document chunks to vector embeddings
- **Primary Function**: Generate semantic embeddings for search and retrieval
- **AI Capabilities**:
  - Multi-provider embedding generation (OpenAI, nomic-embed)
  - Batch processing of document chunks
  - Quality assessment of embedding generation
- **Integration**: `generate-embeddings` edge function + n8n workflow
- **Models**: text-embedding-3-large, nomic-embed-text

### 3. 💬 Conversational RAG Agent
**Role**: Interactive chat with document context
- **Primary Function**: Answer questions using retrieved document context
- **AI Capabilities**:
  - Semantic search across document corpus
  - Context-aware conversation with memory
  - Citation and source attribution
  - Multi-turn dialogue management
- **Integration**: n8n chat workflow + `batch-vector-search`
- **LLM Providers**: Ollama (qwen3:8b), OpenAI GPT-4, Gemini Pro

### 4. 📄 Report Generation Agent
**Role**: Automated report creation from templates
- **Primary Function**: Generate comprehensive planning reports
- **AI Capabilities**:
  - Template-driven content generation
  - Section-by-section report building
  - Context synthesis from multiple sources
  - Compliance checking against planning requirements
- **Integration**: `generate-report` + `process-report-sections` edge functions
- **Templates**: Heritage Impact Statements, Planning Proposals

### 5. 🎯 Metadata Schema Agent
**Role**: Dynamic field discovery and extraction rules
- **Primary Function**: Evolve metadata extraction capabilities
- **AI Capabilities**:
  - Discover new metadata fields from documents
  - Generate extraction patterns and rules
  - Validate field consistency and quality
  - Update extraction confidence scores
- **Integration**: `metadata_schema` table + extraction functions
- **Approach**: Few-shot learning with validation feedback

### 6. 🔄 Workflow Orchestration Agent
**Role**: Coordinate complex multi-step processes
- **Primary Function**: Manage document processing pipelines
- **AI Capabilities**:
  - Job queue management and prioritization
  - Error handling and retry logic
  - Progress tracking and status updates
  - Performance monitoring and optimization
- **Integration**: n8n workflows + `processing_jobs` table
- **Decision Making**: Rule-based with ML-driven optimization

---

## 1. 📋 Project Snapshot

| Item               | Details                                                     |
| ------------------ | ----------------------------------------------------------- |
| **Codename**       | HHLM (🏙️ Town‑Planning Assistant)                          |
| **Phase**          | *Pilot* — 500 PDFs / 10 users                               |
| **Latency Target** | ≤ 4 s end‑to‑end (95‑th)                                    |
| **Front‑end**      | **SvelteKit + TypeScript** (Vite)                           |
| **Back‑end**       | **Supabase v2.0** (Postgres + pgvector)                     |
| **LLM Mesh**       | Ollama (local), OpenAI API, Gemini API (select per request) |
| **Orchestration**  | **n8n** webhooks & queues                                   |
| **Edge Runtime**   | Supabase Edge Functions (Deno 1.43)                         |

---

## 2. 🏗️ Updated Architecture

```mermaid
flowchart TD
  FE["SvelteKit + WS"] -->|REST / WS| SB[(Supabase DB + Storage)]
  FE -->|invoke()| EF[(Edge Functions)]
  SB -->|triggers| EF
  EF -->|queue job| N8N[n8n Workflows]
  N8N -->|embedding / chat| LLM[LLM Mesh<br>Ollama · OpenAI · Gemini]
  SB -->|pgvector| LLM
  FE <-->|streams| N8N
```

**Key changes vs v1:**

* Front‑end migrated from React to **SvelteKit**, enabling native streaming and smaller bundle.
* Supabase **schema v2.0** introduces `notebooks`, metadata tables, and stricter RLS.
* All PDF ingestion & reporting moved to **edge functions** (zero API keys in client).
* **Langfuse** hooks added for LLM telemetry (optional in `.env`).

---

## 3. 🛠️ Tech Stack Details

### 3.1 Front‑end

* **SvelteKit 1.29** (SSR + island hydration)
* **Tailwind CSS** (+ shadcn/ui ported to Svelte)
* **tanstack/query** for server state
* **Lucide‑Svelte** icons
* **vite‑imagetools** for asset optimisation

### 3.2 Back‑end & Infra

* **Postgres 15** with `pgvector 0.7.0` & `postgis`
* **Supabase Auth** (email / OAuth) → profiles in `user_profiles`
* **Supabase Storage** buckets: `private.documents`, `private.reports`
* **Edge Functions** (Deno) — see §5
* **n8n 1.31** (Docker) — persistent SQLite volume
* **LLM Providers** controlled via `src/lib/llm-config.ts`

### 3.3 Dev Tooling

* **ESLint** + **Prettier** (strict)
* **Vitest** unit tests · **Playwright** e2e 🧪
* **Husky** + **lint‑staged** pre‑commit

---

## 4. 📂 Repository Layout (monorepo root)

```
├─ supabase/
│  ├─ migrations/                # SQL – schema v2.0
│  └─ functions/                 # Edge functions (Deno)
├─ src/
│  ├─ routes/                    # SvelteKit pages + endpoints
│  ├─ lib/
│  │   ├─ supabase.ts            # browser & server client
│  │   ├─ llm-config.ts          # provider defaults / switcher
│  │   └─ api-compatibility/     # from api-compatibility-functions.ts
│  ├─ components/                # Svelte components (ChatStream, …)
├─ n8n-workflows.json            # import into n8n
├─ deployment-setup-script.sh    # full local bootstrap
├─ AGENTS.md                     # ← you are here
└─ README.md
```

---

## 5. 🔌 Edge Functions (Deno)

| FN                            | Trigger                                        | Purpose                                                                        |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| **process-pdf-with-metadata** | REST `POST /process`                           | ⬆️ PDF → LlamaCloud OCR → extract metadata → chunk → enq `generate-embeddings` |
| **generate-embeddings**       | n8n webhook or scheduled                       | Batch embed chunks, `INSERT INTO chunk_embeddings`                             |
| **batch-vector-search**       | REST `POST /search`                            | Return top‑*k* chunks w/ scores (`match_embeddings`)                           |
| **generate-report**           | REST `POST /report`                            | Create report scaffold records                                                 |
| **process-report-sections**   | trigger `report_generations.status = 'QUEUED'` | Fill each section using RAG → update status                                    |

All functions **require** Supabase Service Role key and run behind RLS‑safe procedures.

---

## 6. 🗄️ Database Schema (v2.0)

### 6.1 Core Tables (excerpt)

| Table                                                         | Purpose                     | Notes                       |
| ------------------------------------------------------------- | --------------------------- | --------------------------- |
| `notebooks`                                                   | Logical project / case file | FK → `auth.users`           |
| `sources`                                                     | File uploads (PDF/DOCX)     | Storage path + size + pages |
| `metadata_schema`                                             | Dynamic field definitions   | e.g. `zone`, `lot_size`     |
| `pdf_metadata` & `pdf_metadata_values`                        | AI‑extracted field sets     | Many‑to‑many via values     |
| `document_chunks`                                             | Clean text chunks           | 400‑token window            |
| `chunk_embeddings` (**vector**)                               | Embeddings (`768D`)         | `ivfflat, 100`              |
| `chat_sessions` / `chat_messages`                             | Conversation data           | usage ≈ token\_count        |
| `report_templates` / `report_generations` / `report_sections` | Branded report pipeline     | status enum                 |
| `processing_jobs`                                             | Job queue mirror (n8n)      | retry / error columns       |

All tables have `owner_id` and enforce **row‑level security**; see `supabase/migrations/2025‑07‑24_rls.sql`.

### 6.2 Helper Views & Functions

* `v_document_stats` — per‑notebook pages, chunks, cost
* `match_embeddings(query_embedding VECTOR, k INT)` — SQL wrapper over `pgvector` cosine

---

## 7. 💻 Local Environment

```bash
# clone & install
pnpm i

# initialise Supabase (requires CLI v1.162+)
supabase start
supabase db push

# seed test data (optional)
pnpm run seed

# run all services (Ollama + n8n + dev server)
ollama serve &
docker compose up -d n8n
pnpm dev
```

`.env` variables mirror those in **README.md**, plus optional **LANGFUSE\_**\* keys for telemetry.

---

## 8. 🤝 Agent Coding Standards

### 8.1 File Naming

* **Components / Stores**: `PascalCase.svelte`
* **Server endpoints**: `+server.ts` (SvelteKit convention)
* **Utility modules**: `camelCase.ts`

### 8.2 Chat Agent Pattern

```ts
// src/routes/api/chat/+server.ts
import { openAIChat } from '$lib/providers';
import { vectorSearch } from '$lib/rag';
import { json } from '@sveltejs/kit';

export const POST = async ({ request, locals }) => {
  const { sessionId, message } = await request.json();
  const contextChunks = await vectorSearch(message, 12);
  const response = await openAIChat({
    system: makeSystemPrompt(contextChunks),
    user: message,
    stream: true
  });
  return json(response);
};
```

### 8.3 Error Handling Contract

All API endpoints return:

```ts
interface ErrorPayload { ok: false; code: string; message: string; }
interface Success<T>   { ok: true;  data: T;  }
```

Use SvelteKit `error(code, message)` helper in endpoints and `<ErrorBoundary>` component in UI.

---

## 9. 🔧 n8n Workflows

| Workflow      | URL                            | Steps                                                                                |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| **Chat**      | `/webhook/hhlm-chat`           | ① receive msg → ② fetch context (`batch-vector-search`) → ③ LLM chat → ④ stream back |
| **Embedding** | `/webhook/generate-embeddings` | cron / trigger → map chunks → embed API → upsert                                     |
| **Report**    | `/webhook/generate-report`     | ① receive gen‑id → ② foreach section → ③ LLM fill                                    |

Set `N8N_WEBHOOK_TUNNEL_URL` if exposing externally.

---

## 10. 🚦 Roadmap Snapshot (Aug 2025)

* **✅** Streaming chat (SSE) via SvelteKit
* **✅** Multi‑provider embeddings (nomic‑embed, text‑embedding‑3)
* **🔧** Citation inline highlights (frontend)
* **🔧** Usage‑based billing (metering on `processing_jobs`)
* **📝** Council‑specific report templates (v3)
* **🚀** Public beta – Q4 2025

---

## 11. 📚 Reference Links

* **Supabase Docs** – [https://supabase.com/docs](https://supabase.com/docs)
* **pgvector** – [https://github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)
* **LLM Provider SDKs** – see `/src/lib/providers`
* **n8n** – [https://docs.n8n.io/](https://docs.n8n.io/)

---

*Update this file on every major architectural change. The README is for general contributors; **AGENTS.MD** is for internal agent engineers.*
