# Town Planner RAG System - Project Context

## Project Overview

The Town Planner RAG System is a sophisticated SvelteKit/TypeScript application that leverages AI for town planning document analysis and report generation. The system processes PDF documents, extracts structured metadata, generates embeddings, and provides multi-LLM chat capabilities with comprehensive report generation.

## Architecture Summary

### Core Technology Stack
- **Frontend**: SvelteKit + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Storage + Edge Functions)
- **AI/LLM**: Multi-provider support (Ollama, OpenAI, Gemini, LlamaCloud)
- **Workflow Orchestration**: n8n for automated processing pipelines
- **Vector Database**: pgvector extension for semantic search
- **Development**: Local services without Docker containers

### Key Components

#### 1. Database Schema (v2.0)
- **Core Tables**: `notebooks`, `sources`, `document_chunks`, `chunk_embeddings`
- **Metadata System**: Dynamic `metadata_schema` with `pdf_metadata` extraction
- **Chat System**: `chat_sessions` and `chat_messages` for conversational interface
- **Report Generation**: `report_templates`, `report_generations`, `report_sections`
- **Job Processing**: `processing_jobs` for background task management
- **Security**: Row-level security (RLS) on all tables

#### 2. Edge Functions (Deno Runtime)
- `process-pdf-with-metadata`: PDF ingestion and metadata extraction
- `generate-embeddings`: Batch embedding generation using various providers
- `batch-vector-search`: Semantic search across document chunks
- `generate-report`: Report scaffolding and generation coordination
- `process-report-sections`: Individual section processing with RAG

#### 3. n8n Workflows
- **Chat Workflow**: Handles streaming chat with RAG context
- **Embedding Workflow**: Processes document chunks for vector storage
- **Report Workflow**: Orchestrates complex report generation tasks

#### 4. Frontend Architecture
- **SvelteKit**: Server-side rendering with island hydration
- **Component Library**: shadcn/ui ported to Svelte
- **State Management**: Svelte stores + TanStack Query
- **Real-time Updates**: WebSocket integration for processing status

## Current Development State

### Completed Features
- ✅ Complete database schema v2.0 with RLS policies
- ✅ All edge functions implemented and deployed
- ✅ n8n workflow automation setup
- ✅ Multi-LLM provider integration
- ✅ AI-driven metadata extraction system
- ✅ Vector embedding and search capabilities

### Integration Requirements
The project currently has import errors where components expect functions that need to be added to `src/lib/api.ts`:
- `sendChat()` - Chat message handling
- `genTemplate()` - Report template generation  
- `uploadFile()` - File upload processing

### Development Environment
- **Local Services**: Supabase CLI, n8n, Ollama (no Docker required)
- **Ports**: 
  - SvelteKit dev: 5173
  - Supabase: 54321-54323
  - n8n: 5678
  - Ollama: 11434
- **Configuration**: Environment variables in `.env.local`

## Project Structure

```
town-planner/
├── src/
│   ├── components/          # Svelte components
│   ├── lib/
│   │   ├── api.ts          # API functions (needs compatibility functions)
│   │   ├── supabase.ts     # Supabase client configuration
│   │   └── providers/      # LLM provider integrations
│   ├── routes/             # SvelteKit pages and API endpoints
│   └── stores/             # Svelte state management
├── supabase/
│   ├── functions/          # Edge functions (Deno)
│   └── migrations/         # Database migrations
├── .claude/                # Claude Code configuration
├── DOCUMENTATION AND INSTRUCTIONS/  # Implementation guides
└── n8n-workflows.json      # n8n workflow definitions
```

## Key Configuration Files

### .claude/claude-config.json
Defines the project as a SvelteKit web application with Supabase backend, n8n workflows, and multi-LLM support.

### .claude/prompts.json
Contains specialized prompts for different development scenarios:
- `project_context`: General project assistance
- `integration_check`: Verify local service integration
- `code_review`: SvelteKit/TypeScript code review
- `workflow_debug`: n8n and edge function debugging

## Development Guidelines

### AI Assistant Rules
1. Always consult TASKS.md for current priorities
2. Follow architecture guidelines in AGENTS.md
3. Ensure edge functions and n8n webhooks are connected before merging code
4. Validate environment variable consistency across all configuration files
5. Write code following strict TypeScript and modern SvelteKit patterns

### Quality Standards
- **TypeScript**: Strict mode enabled with comprehensive type definitions
- **Testing**: Vitest for unit tests, Playwright for e2e testing
- **Code Quality**: ESLint + Prettier with pre-commit hooks
- **Security**: All API endpoints protected with RLS policies

## Current Focus Areas

1. **API Compatibility**: Adding missing functions to `src/lib/api.ts`
2. **Frontend Integration**: Ensuring components work with the new backend
3. **Real-time Features**: Streaming chat and processing status updates
4. **Report Generation**: Complex multi-section report creation workflow
5. **Metadata Extraction**: AI-powered document analysis and field extraction

This project represents a production-ready RAG system tailored specifically for town planning and heritage consulting workflows, with sophisticated metadata extraction, multi-LLM support, and automated report generation capabilities.