#!/bin/bash

# Claude Code Aliases for town-planner project

alias claude-check="npm run claude:check"
alias claude-dev="npm run claude:dev"
alias claude-sync="npm run claude:sync"

# Docker shortcuts
alias tp-up="npm run docker:up"
alias tp-down="npm run docker:down"
alias tp-logs="docker compose -p localai logs -f"

# Development shortcuts
alias tp-dev="npm run dev"
alias tp-build="npm run build"
alias tp-lint="npm run lint"

# Service logs
alias n8n-logs="npm run logs:n8n"
alias sb-logs="npm run logs:supabase"

echo "🔧 Town Planner aliases loaded!"
echo "Available commands:"
echo "  claude-check     - Run integration check"
echo "  claude-dev       - Full development check"
echo "  claude-sync      - Sync with Claude"
echo "  tp-up            - Start all services"
echo "  tp-down          - Stop all services"
echo "  tp-dev           - Start development server"
echo "  n8n-logs         - View n8n logs"