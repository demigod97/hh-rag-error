# 📋 TASKS.md – Development Backlog (updated 24 Jul 2025)

> **Review this file every Monday before sprint planning.**
> Categories: **🔴 Critical**, **🟡 High**, **🟢 Medium**, **🔵 Low**.

---

## ✅ Recently Completed

| Area                        | Notes                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Supabase v2.0 Migration** | — schema pushed, pgvector enabled, RLS verified                                                                   |
| **Edge Function Suite**     | process-pdf-with-metadata · generate-embeddings · batch-vector-search · generate-report · process-report-sections |
| **Front-end Port**          | React ➞ **SvelteKit** with streaming ChatStream component                                                         |
| **Langfuse Telemetry**      | hooks wired in n8n for chat + embeddings                                                                          |
| **CI   Pipeline**           | Husky + lint-staged + Vitest + Playwright smoke test                                                              |

---

## 🔴 Critical Issues (Blocking E2E Flow)

### 1 · Chat Send Button **not** triggering workflows

**Status**: 🚫 Broken   **Owner**: @frontend   **ETA**: ASAP

* FE posts to `/functions/v1/batch-vector-search` «works» but **n8n** `hhlm-chat` webhook never receives event.
* Suspect: wrong `N8N_WEBHOOK_BASE_URL` or missing `referer` header.

**Action Items**

1. [ ] Add debug `console.info("webhook url", url)` before fetch in `src/lib/api/chat.ts`.
2. [ ] Inspect Edge logs `supabase functions logs --follow`.
3. [ ] Ensure **n8n** workflow is **active** and tunnel exposed (if dev).
4. [ ] Unit-test proxy with `curl`.

---

### 2 · **File Upload Pipeline** – fails early & no processing

**Status**: 🔥 URGENT   **Owner**: @full-stack

| Symptom                     | Details                                              |
| --------------------------- | ---------------------------------------------------- |
| **Upload 400/500**          | UI toast “Failed to upload”. No record in `sources`. |
| **Template gen form error** | “Fill all fields” even when populated.               |

Expected flow:

```
<Svelte FileDrop> → POST /storage/v1/upload
                   → insert into sources
                   → Edge process-pdf-with-metadata
                   → n8n generate-embeddings
```

**Debug Checklist**

* [ ] Network tab: verify `multipart/form-data` and Supabase auth headers.
* [ ] Edge function `process-pdf-with-metadata` guard clauses—rejecting mime?
* [ ] Confirm storage bucket ACL (`private.documents`).
* [ ] Validate form zod-schema in `/routes/(app)/templates/+page.ts`.
* [ ] Add step-by-step log to n8n ingest webhook.

**Sub-Tasks**

1. [ ] Introduce `processing_jobs` row immediately after successful upload (status=`QUEUED`).
2. [ ] Bubble upload & template errors to UI via `toast.error` with reason.
3. [ ] Write Cypress regression covering upload►template►report path.

---

### 3 · Settings Modal **not** persisting credentials

**Priority**: 🔴 HIGH   **Status**: Open

* Settings write to `localStorage`, but `supabase.from()` still uses fallback env values.

**Fix Plan**

1. [ ] Convert `useSettingsStore` to Svelte-Persisted store.
2. [ ] Inject dynamic headers in `supabase.ts` client factory.
3. [ ] Real-time ping test on save.

---

### 4 · n8n **API test** passes with empty creds

**Priority**: 🔴 HIGH

* Validation function returns `200` regardless of key.

**Tasks**

* [ ] Enforce required fields in `/routes/api/test-n8n/+server.ts`.
* [ ] Check `x-api-key` header in n8n credential test node.

---

## 🟡 High Priority

### 5 · Chat Message Persistence

* Implement CRUD for `chat_messages` (new table name).
* Paginate (∞ scroll) & search.

### 6 · Real-time Processing Status UI

* Derive from `processing_jobs.status` via Supabase Realtime.

### 7 · Vector Search Accuracy Pass 2

* Try `HNSW` (pgvector 0.8) once GA.

### 8 · Permit Template Generation MVP

* Edge `generate-report` + n8n section filler → DOCX export.

---

## 🟢 Medium Priority

* Bulk upload, User profile panel, Advanced chat UX (citations click-to-scroll), Analytics/telemetry dashboard.

---

## 🔵 Low Priority / Ideas

* Mobile gesture delight, API rate limiting, Progressive Web App offline mode.

---

## 🐛 Open Bugs (non-blocking)

1. Settings modal layout breaks <375 px.
2. Upload progress bar stuck at 0 % on >20 MB files.
3. Chat auto-scroll intermittent.

---

## 🔧 Technical Debt

* Add comprehensive **TypeScript** types for Edge payloads.
* Refactor monolithic `ChatStream.svelte` into smaller islands.
* Implement Vitest unit tests for `vectorSearch()` and embedding chunker.

---

## 📊 Metrics To Track (v0.2)

* P95 chat latency, Embedding cost per PDF, Active notebooks, Prompt tokens / day.

---

## 🎯 Sprint Template

1 🔴 critical fix   | 2 🟡 high feats   | Bugs + Debt as buffer.

*DoD*: Tests pass · Docs updated · Edge logs clean · Langfuse event recorded.

---

## 👩‍💻 Dev Notes

* Start containers with `pnpm dev:all`.
* Edge logs: `supabase functions logs --project-ref <ref> --follow`.
* n8n: [http://localhost:5678](http://localhost:5678) (admin / admin).

---

*Last Reviewed: 24 Jul 2025*
