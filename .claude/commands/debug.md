# 🐞 DEBUG.md – Troubleshooting Guide (Local, No‑Docker)

Use this guide when the Town‑Planner RAG System misbehaves: uploads fail, chat has no response, or edge functions don’t fire.

---

## 🔧 Quick‑Fix Command Palette

| Scenario                         | Command                                               |
| -------------------------------- | ----------------------------------------------------- |
| **Supabase services down**       | `supabase start`                                      |
| **Edge functions not deploying** | `supabase functions deploy --project-ref <ref> --all` |
| **Edge function logs (tail)**    | `supabase functions logs --follow`                    |
| **Database migration issues**    | `supabase db reset` *(dev only)*                      |
| **n8n not reachable**            | `npx n8n stop && npx n8n start`                       |
| **LLM server (Ollama) stopped**  | `ollama serve`                                        |

---

## 🛠️ Step‑by‑Step Debug Flow

### 1. Check Integration Status Script

```bash
node scripts/integration-checker.js   # validates env vars, ports, webhooks
```

### 2. Verify Environment Variables

* Ensure **`.env.local`** exists at repo root.
* Required keys:

  * `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  * `SUPABASE_SERVICE_ROLE_KEY` (edge functions)
  * `N8N_WEBHOOK_BASE_URL`, `N8N_API_KEY`
  * `OLLAMA_BASE_URL` *or* `OPENAI_API_KEY`
* Run `supabase secrets list` to verify server‑side keys.

### 3. Check Local Services

```bash
supabase status        # Postgres · API · Storage · Edge runtime
lsof -i :54321         # Postgres default port
ps -ef | grep n8n      # n8n running?
```

### 4. Inspect Logs

```bash
# Front‑end dev server
pnpm dev

# Supabase edge
supabase functions logs --follow

# n8n internal
npx n8n start --tunnel   # then view UI → Settings → Diagnostics
```

### 5. Test Connectivity

* **n8n**: [http://localhost:5678](http://localhost:5678)
* **Supabase PostgREST**: [http://localhost:54322/rest/v1/](http://localhost:54322/rest/v1/)
* **Edge Functions (local)**: [http://localhost:54323/functions/v1/batch-vector-search](http://localhost:54323/functions/v1/batch-vector-search)
* **SvelteKit dev**: [http://localhost:5173](http://localhost:5173)

### 6. Common Remedies

1. **Restart everything**

   ```bash
   supabase stop && supabase start
   npx n8n stop && npx n8n start
   pkill -f ollama && ollama serve &
   ```
2. **Re‑deploy Edge Functions**

   ```bash
   supabase functions deploy process-pdf-with-metadata generate-embeddings batch-vector-search generate-report process-report-sections
   ```
3. **Clear Supabase caches** (rare)

   ```bash
   supabase db reset
   ```
4. **Re‑link project**

   ```bash
   supabase link --project-ref <ref>
   ```

---

## ✅ Troubleshooting Checklist

* [ ] **Supabase CLI** running (ports 54321‑54323 open)
* [ ] .env.local values match Supabase project keys
* [ ] `supabase functions ls` shows all five edge functions
* [ ] n8n UI shows **green** check on `hhlm-chat`, `generate-embeddings`, `generate-report`
* [ ] No `401` errors in network tab during upload/chat
* [ ] `processing_jobs` row created after upload (Supabase Table view)

---

## 💡 Tips

* Use **Langfuse** dashboard for LLM errors.
* Add `console.log` in Svelte endpoints and watch terminal hot‑reload.
* For CORS headaches, confirm `supabase.config.json` → `allowedOrigins` during dev.

---

*Last updated: 24 Jul 2025*
