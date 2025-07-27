# 🏙️ Town Planner RAG System

A **multi‑LLM, retrieval‑augmented generation (RAG)** platform for town‑planning professionals. Upload planning documents (PDF/DOCX), extract structured data & metadata, ask contextual questions, and auto‑generate professional reports.

---

## ✨ Key Features

| Area                     | Highlights                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Document Ingestion**   | • LlamaCloud OCR + markdown parsing  • AI metadata discovery  • Semantic chunking with table preservation |
| **Vector Search**        | Postgres **`vector`** extension + `chunk_embeddings` table for fast cosine similarity via `ivfflat` index |
| **Multi‑LLM**            | Ollama (local), OpenAI, Gemini, LlamaCloud – switch per request; unified config via `LLM_DEFAULTS`        |
| **Report Engine**        | Edge functions generate section queries, batch vector search, and draft content into **Markdown / DOCX**  |
| **Realtime Workflows**   | n8n webhooks orchestrate chat, embedding jobs, and status updates                                         |
| **Secure, Multi‑Tenant** | Supabase Auth + RLS on every table; per‑user storage buckets                                              |

---

## 🏗️ High‑Level Architecture

```text
┌──────────────┐          ┌───────────────┐        ┌────────────────┐
│  Frontend    │──files──▶│  Supabase      │──trig──▶ Edge Functions │
│  (Svelte/TS) │  REST    │  (DB + Storage)│        │  (Deno)        │
└──────────────┘          └──────┬─────────┘        └──────┬─────────┘
       ▲ WebSockets/HTTP              │ REST (RLS)                │ Webhooks
       │                              ▼                          ▼
┌──────────────┐             ┌──────────────┐          ┌────────────────┐
│    n8n        │  ←———chat— │   LLMs        │  embed  │  Ollama /      │
│ (Workflow)    │            │ (Ollama/API) │ ───────▶ │  OpenAI/Gemini │
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
│  │   └─ process-report-sections/
├─ src/
│  ├─ lib/
│  │   ├─ api.ts               # Supabase client + helper SDK
│  │   ├─ llm-config.ts        # LLM provider defaults
│  │   └─ compatibility/       # api‑compatibility-functions.ts
│  ├─ components/              # UI components (ChatStream, SourcesSidebar …)
├─ n8n-workflows.json          # Import into n8n
├─ deployment-setup-script.sh  # One‑click local install
└─ README.md
```

---

## 🔧 Database Overview (Supabase Postgres v2.0)

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

## 🔌 Edge Functions (Deno)

| Function                      | Description                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **process-pdf-with-metadata** | Parses PDF via LlamaCloud → discovers metadata → semantic chunking → inserts chunks & kicks **generate‑embeddings** job |
| **generate-embeddings**       | Batch embeds chunks using Ollama/OpenAI/Gemini embedding endpoints                                                      |
| **batch-vector-search**       | Accepts multiple queries, returns top‑k matches with similarity scores                                                  |
| **generate-report**           | Creates `report_generations` record & initial `report_sections` queries                                                 |
| **process-report-sections**   | Iterates sections → searches context → drafts content with selected LLM                                                 |

All functions are JWT‑less and invoked via `supabase.functions.invoke()` from the frontend or by n8n.

---

## 🤖 n8n Workflows

1. **Chat Handler** – `/webhook/hhlm-chat` → prepares context → routes to provider → streams result back
2. **Embedding Generator** – `/webhook/generate-embeddings` → fetches chunk batch → calls embedding API → upserts into `chunk_embeddings`

Import `n8n-workflows.json`, set environment variables, and **activate** each workflow.

---

## ⚙️ Configuration

### Environment (.env.local)

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
LLAMACLOUD_API_KEY=llx-...

N8N_WEBHOOK_BASE_URL=http://localhost:5678
N8N_API_KEY=...
```

### LLM Defaults (override per request)

| Provider | Chat Model        | Embed Model               | Temp |
| -------- | ----------------- | ------------------------- | ---- |
| Ollama   | `qwen3:8b-q4_K_M` | `nomic-embed-text:latest` | 0.3  |
| OpenAI   | `gpt-4`           | `text-embedding-3-small`  | 0.3  |
| Gemini   | `gemini-pro`      | `embedding-001`           | 0.3  |

---

## 🚀 Quick Start

```bash
# 1. Install deps
npm i && npm i -g supabase

# 2. Configure env & link project
cp .env.local.example .env.local
supabase link --project-ref <ref>

# 3. Provision database
supabase db push

# 4. Deploy edge functions
./deploy-functions.sh

# 5. Seed storage buckets & templates (optional)

# 6. Start n8n & Ollama
npx n8n  &  ollama serve &

# 7. Run dev frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) → create notebook → upload PDF → chat & generate report.

---

## 🧪 Testing

* **Supabase**: `supabase status`
* **Edge Log**: `supabase functions logs --tail`
* **Chat Webhook**:

  ```bash
  curl -X POST http://localhost:5678/webhook/hhlm-chat -H 'Content-Type: application/json' -d '{"sessionId":"test","message":"Hello"}'
  ```

---

## 📈 Monitoring & Scaling

| Layer     | Tip                                                                |
| --------- | ------------------------------------------------------------------ |
| DB        | Enable **point‑in‑time recovery** and log **pg\_stat\_statements** |
| Functions | Use Supabase **Edge run‑metrics** + Langfuse for LLM observability |
| n8n       | Persist executions, set retries, and add failure hooks             |
| LLMs      | Cache embeddings (Redis) and stream chat completions               |

---

## 🛡️ Security Checklist

* [x] API keys stored as Supabase **secrets** (service role only)
* [x] RLS policies enforced (see `*.sql`)
* [x] Storage bucket ACL = private per‑user
* [x] CORS `*` only for dev; tighten in prod

---

## 👥 Contributing

1. Fork & create feature branch (`git checkout -b feat/awesome`)
2. Run `npm run lint && npm run test`
3. Submit PR with context & screenshots

---

## 📜 License

MIT © 2025 CoralShades – Built with ❤️ in Melbourne
