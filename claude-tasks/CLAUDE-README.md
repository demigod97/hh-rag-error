# Claude Code Integration

This directory contains Claude Code integration scripts for the town-planner project.

## Quick Start

```bash
# Load helpful aliases
source .claude/aliases.sh

# Check integration status
claude-check

# Run full development check
claude-dev

# Generate context for Claude conversations
claude-sync
```

## Available Scripts

- **integration-checker.js** - Validates the entire integration setup
- **dev-tasks.js** - Automates common development tasks
- **conversation-helper.js** - Generates context for Claude conversations

## NPM Scripts

```bash
npm run claude:check      # Integration check
npm run claude:dev        # Development check  
npm run claude:sync       # Generate Claude context
npm run docker:up         # Start Docker services
npm run docker:down       # Stop Docker services
```

## Custom Claude Commands

- `/debug` - Troubleshoot integration issues
- Use these in Claude Code by typing `/` followed by the command name

## Integration with Claude Conversations

1. Run: `npm run claude:sync`
2. Copy content from `claude-conversation-summary.md`
3. Paste in Claude conversation with your question
4. Claude will have full project context

## Files Generated

- **claude-context.json** - Detailed project context
- **claude-conversation-summary.md** - Ready-to-use summary for Claude
- **integration-report.json** - Technical integration status