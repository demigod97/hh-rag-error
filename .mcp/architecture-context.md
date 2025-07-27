# Town Planner Architecture Context

## DO NOT MODIFY
- Supabase schema and migrations
- Edge function architecture
- n8n workflow configurations
- Authentication flow
- Database RLS policies

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (Postgres + Edge Functions)
- **Workflows**: n8n
- **AI**: Multi-provider (Ollama/OpenAI/Gemini)

## Component Guidelines
- All new UI components should use shadcn/ui patterns
- Maintain existing component structure in src/components/
- Use existing utils from src/lib/utils
- Follow established API patterns in src/lib/api.ts

## Current Issues to Fix
- Missing API functions: sendChat(), genTemplate(), uploadFile()
- React plugin configuration errors