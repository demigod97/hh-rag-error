# AI Agents Architecture

This document describes the AI agents implemented as n8n workflows in the Town Planner RAG system.

## Document Processing Agent

**Webhook**: `https://n8n.coralshades.ai/webhook/ingest`

**Purpose**: Handles document uploads, processing, and embedding generation

**Input Schema**:
```typescript
interface IngestRequest {
  fileUrl: string;          // Supabase Storage URL
  fileName: string;         // Original filename
  mimeType: string;        // PDF/DOCX mime type
  userId: string;          // Supabase user ID
  projectId?: string;      // Optional project association
}
```

**Output Schema**:
```typescript
interface IngestResponse {
  jobId: string;           // Processing job ID
  status: 'pending' | 'processing' | 'complete' | 'error';
  message?: string;        // Status/error message
}
```

## Chat/Report Agent

**Webhook**: `https://n8n.coralshades.ai/webhook/hhlm-chat`

**Purpose**: Handles both chat interactions and report generation/updates

**Input Schema**:
```typescript
interface ChatRequest {
  sessionId: string;       // Chat session ID
  message: string;         // User message
  userId: string;          // Supabase user ID
  context?: {             // Optional context
    reportId?: string;    // For report generation
    templateId?: string;  // Report template
    metadata?: Record<string, any>;
  }
}
```

**Output Schema**:
```typescript
interface ChatResponse {
  messageId: string;      // Response message ID
  content: string;        // AI response content
  reportUpdate?: {       // Optional report update
    reportId: string;
    status: string;
    sections?: any[];
  }
}
```

## Integration with Edge Functions

All agents are invoked through the `trigger-n8n` edge function which:
1. Validates requests
2. Handles authentication
3. Manages rate limiting
4. Provides error handling
5. Routes to appropriate n8n webhook

## Security and Monitoring

- All webhooks require valid n8n API key
- Rate limiting applied at edge function level
- Full logging and error tracking in Supabase
