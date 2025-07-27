# Claude Tasks - Helper Scripts

This directory contains helper scripts and documentation for working with the Town Planner RAG System using Claude Code.

## Available Scripts

### 🔧 Integration Check
**File**: `integration-check.js`
**Purpose**: Verify that all local services are running and properly configured.

```bash
node claude-tasks/integration-check.js
```

**Checks**:
- Environment variables configuration
- Service connectivity (Supabase, n8n, Ollama)
- Database schema v2.0 
- Edge functions deployment
- n8n workflows status

### 📝 API Functions Helper
**File**: `add-api-functions.js`
**Purpose**: Add missing compatibility functions to `src/lib/api.ts`.

```bash
node claude-tasks/add-api-functions.js
```

**Functions Added**:
- `sendChat()` - For ChatStream component
- `genTemplate()` - For PermitDrawer component  
- `uploadFile()` - For SourcesSidebar component

## Directory Structure

```
claude-tasks/
├── README.md                    # This file
├── integration-check.md         # Integration check documentation
├── integration-check.js         # Integration verification script
├── api-functions-helper.md      # API functions documentation
└── add-api-functions.js         # Add missing API functions script
```

## Usage Workflow

1. **Check Integration Status**
   ```bash
   node claude-tasks/integration-check.js
   ```

2. **Fix API Import Errors**
   ```bash
   node claude-tasks/add-api-functions.js
   ```

3. **Start Development**
   ```bash
   pnpm dev
   ```

## Prerequisites

- Node.js 18+ with ESM support
- All project dependencies installed (`pnpm install`)
- `.env.local` file configured
- Supabase CLI installed and configured

## Troubleshooting

If scripts fail to run:

1. **Check Node.js version**: `node --version` (should be 18+)
2. **Install dependencies**: `pnpm install`
3. **Check file permissions**: Ensure scripts are executable
4. **Verify paths**: All scripts assume they're run from project root

## Adding New Scripts

When adding new helper scripts:

1. Create the script in this directory
2. Add documentation markdown file
3. Update this README.md
4. Follow the existing naming convention
5. Include proper error handling and colored output