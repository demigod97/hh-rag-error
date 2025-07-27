# Current Architecture Debug Guide

## Your Current Flow (n8n-based)
1. **File Upload**: Frontend → Supabase Storage → `trigger-n8n` Edge Function
2. **Document Processing**: n8n workflows handle:
   - PDF parsing and text extraction
   - Semantic chunking
   - Metadata field discovery
   - Vector embedding generation
   - Storage in Supabase tables

## Missing Pieces for Reports
The `ReportsPanel.tsx` expects data in these tables:
- `report_templates` (for available templates)
- `report_generations` (for generated reports)
- `report_sections` (for report content)

## Debug Steps

### 1. Check if report_templates table has data
```sql
SELECT * FROM report_templates WHERE is_active = true;
```

### 2. Check if report_generations table has any data
```sql
SELECT * FROM report_generations ORDER BY created_at DESC LIMIT 10;
```

### 3. Check your n8n workflows
- Do you have a workflow for report generation?
- Does it populate the `report_generations` table?
- Does it create and save report files to Supabase Storage?

### 4. Check trigger-n8n function logs
```bash
supabase functions logs trigger-n8n --follow
```

## Likely Solutions

### Option A: Add Report Generation to n8n
Create a new n8n workflow that:
1. Receives report generation requests
2. Queries document chunks for context
3. Uses LLM to generate report sections
4. Saves final report to Supabase Storage
5. Updates `report_generations` table with `file_path`

### Option B: Use Existing Edge Functions
Deploy and use the existing Edge Functions:
- `generate-report`
- `process-report-sections`
- `batch-vector-search`

### Option C: Hybrid Approach
- Keep n8n for document processing
- Use Edge Functions for report generation
- Update frontend to trigger Edge Functions for reports