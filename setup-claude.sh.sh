#!/bin/bash

# Claude Code Integration Setup Script
# Sets up Claude Code for the town-planner project

set -e

echo "🚀 Setting up Claude Code integration for town-planner project..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Are you in the project root?"
    exit 1
fi

# Create claude-tasks directory
log_info "Creating claude-tasks directory..."
mkdir -p claude-tasks

# Create .claude directory for configuration
log_info "Creating .claude configuration directory..."
mkdir -p .claude

# Create Claude project configuration
log_info "Creating Claude project configuration..."
cat > .claude/project.json << EOF
{
  "name": "town-planner-local-ai",
  "description": "React/Vite town planner app integrated with local-ai-packaged",
  "version": "1.0.0",
  "project_type": "web_application",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "claude_code": {
    "enabled": true,
    "auto_sync": true,
    "check_interval": "1h",
    "watch_files": [
      "TASKS.md",
      "AGENTS.md",
      "package.json",
      "docker-compose.yml",
      ".env.example"
    ],
    "ignore_patterns": [
      "node_modules/",
      "dist/",
      "build/",
      ".git/",
      "*.log",
      "claude-context.json",
      "integration-report.json"
    ]
  },
  "development": {
    "primary_tasks": [
      "integration_check",
      "workflow_validation", 
      "code_review",
      "database_check"
    ],
    "automation_scripts": {
      "check": "node claude-tasks/integration-checker.js",
      "dev": "node claude-tasks/dev-tasks.js check",
      "workflows": "node claude-tasks/dev-tasks.js workflows",
      "sync": "node claude-tasks/dev-tasks.js sync"
    }
  }
}
EOF

# Create Claude prompts configuration
log_info "Creating Claude prompts configuration..."
cat > .claude/prompts.json << EOF
{
  "project_context": {
    "prompt": "You are helping with a React/Vite town planning application that is being integrated with local-ai-packaged Docker environment. The app uses Supabase for backend, n8n for workflows, and aims to process PDFs and provide AI-powered chat functionality.",
    "context_files": [
      "TASKS.md",
      "AGENTS.md", 
      "claude-conversation-summary.md",
      "integration-report.json"
    ]
  },
  "integration_check": {
    "prompt": "Check the integration status of the town-planner app with local-ai-packaged. Verify Docker configuration, environment variables, n8n workflows, and Supabase setup. Provide specific actionable recommendations.",
    "files": [
      "docker-compose.yml",
      ".env",
      "town-planner-local-package/",
      "supabase/"
    ]
  },
  "code_review": {
    "prompt": "Review the React components and integration code for best practices, potential issues, and alignment with the project architecture. Focus on API integration, error handling, and user experience.",
    "files": [
      "src/components/",
      "src/hooks/",
      "src/lib/",
      "supabase/functions/"
    ]
  },
  "workflow_debug": {
    "prompt": "Help debug n8n workflow issues. Check workflow configurations, webhook endpoints, authentication, and data flow. Provide step-by-step troubleshooting guidance.",
    "files": [
      "n8n/",
      "supabase/functions/",
      ".env"
    ]
  }
}
EOF

# Create automation aliases
log_info "Creating automation aliases..."
cat > .claude/aliases.sh << EOF
#!/bin/bash

# Claude Code Aliases for town-planner project

alias claude-check="node claude-tasks/integration-checker.js"
alias claude-dev="node claude-tasks/dev-tasks.js check"
alias claude-workflows="node claude-tasks/dev-tasks.js workflows"
alias claude-sync="node claude-tasks/dev-tasks.js sync"
alias claude-test="node claude-tasks/dev-tasks.js test"

# Docker shortcuts
alias tp-up="python start_services.py --profile gpu-nvidia"
alias tp-down="docker compose -p localai -f docker-compose.yml --profile gpu-nvidia down"
alias tp-logs="docker compose -p localai logs -f"

# n8n shortcuts
alias n8n-logs="docker logs n8n -f"
alias n8n-restart="docker restart n8n"

# Supabase shortcuts
alias sb-logs="docker compose -p localai logs supabase_kong -f"
alias sb-db="docker exec -it supabase_db psql -U postgres"

echo "🔧 Claude Code aliases loaded!"
echo "Available commands:"
echo "  claude-check     - Run integration check"
echo "  claude-dev       - Full development check"
echo "  claude-workflows - Check n8n workflows"
echo "  claude-sync      - Sync with Claude"
echo "  tp-up            - Start all services"
echo "  tp-down          - Stop all services"
echo "  n8n-logs         - View n8n logs"
EOF

# Make aliases executable
chmod +x .claude/aliases.sh

# Add npm scripts to package.json
log_info "Adding Claude Code scripts to package.json..."

# Check if jq is available for JSON manipulation
if command -v jq &> /dev/null; then
    # Use jq if available
    cat package.json | jq '.scripts += {
        "claude:check": "node claude-tasks/integration-checker.js",
        "claude:dev": "node claude-tasks/dev-tasks.js check", 
        "claude:workflows": "node claude-tasks/dev-tasks.js workflows",
        "claude:sync": "node claude-tasks/dev-tasks.js sync",
        "claude:test": "node claude-tasks/dev-tasks.js test",
        "claude:setup": "./setup-claude.sh"
    }' > package.json.tmp && mv package.json.tmp package.json
    log_success "Added Claude scripts to package.json"
else
    log_warning "jq not found. Please manually add these scripts to package.json:"
    echo '  "claude:check": "node claude-tasks/integration-checker.js",'
    echo '  "claude:dev": "node claude-tasks/dev-tasks.js check",'
    echo '  "claude:workflows": "node claude-tasks/dev-tasks.js workflows",'
    echo '  "claude:sync": "node claude-tasks/dev-tasks.js sync",'
    echo '  "claude:test": "node claude-tasks/dev-tasks.js test"'
fi

# Create GitHub Actions workflow for Claude Code automation
log_info "Creating GitHub Actions workflow..."
mkdir -p .github/workflows

cat > .github/workflows/claude-automation.yml << EOF
name: Claude Code Automation

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    # Run daily at 9 AM UTC
    - cron: '0 9 * * *'

jobs:
  claude-integration-check:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run Claude integration check
      run: npm run claude:check
    
    - name: Upload integration report
      uses: actions/upload-artifact@v4
      with:
        name: integration-report
        path: integration-report.json
        
    - name: Comment PR with results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          if (fs.existsSync('integration-report.json')) {
            const report = JSON.parse(fs.readFileSync('integration-report.json', 'utf8'));
            const comment = \`## 🤖 Claude Integration Check
            
**Success Rate**: \${report.successRate}%
**Timestamp**: \${report.timestamp}

**Status**: \${report.results.failed.length === 0 ? '✅ All checks passed' : '⚠️ Some issues found'}

[View detailed report in artifacts](\${process.env.GITHUB_SERVER_URL}/\${process.env.GITHUB_REPOSITORY}/actions/runs/\${process.env.GITHUB_RUN_ID})\`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
          }
EOF

# Create .gitignore entries
log_info "Updating .gitignore..."
if [ ! -f ".gitignore" ]; then
    touch .gitignore
fi

# Add Claude-specific ignores if not already present
if ! grep -q "claude-context.json" .gitignore; then
    cat >> .gitignore << EOF

# Claude Code files
claude-context.json
integration-report.json
.claude/cache/
.claude/temp/
EOF
fi

# Create initial context
log_info "Creating initial Claude context..."
if [ -f "claude-tasks/dev-tasks.js" ]; then
    node claude-tasks/dev-tasks.js sync
fi

# Create README for Claude integration
log_info "Creating Claude Code README..."
cat > claude-tasks/README.md << EOF
# Claude Code Integration

This directory contains automation scripts and configurations for Claude Code integration with the town-planner project.

## Quick Start

\`\`\`bash
# Load Claude aliases
source .claude/aliases.sh

# Run full integration check
claude-check

# Run development check
claude-dev

# Check n8n workflows
claude-workflows

# Sync with Claude projects
claude-sync
\`\`\`

## Available Scripts

- **integration-checker.js** - Validates the entire integration setup
- **dev-tasks.js** - Automates common development tasks
- **setup-claude.sh** - Sets up Claude Code integration

## NPM Scripts

\`\`\`bash
npm run claude:check      # Integration check
npm run claude:dev        # Development check  
npm run claude:workflows  # n8n workflow validation
npm run claude:sync       # Sync with Claude
npm run claude:test       # Run integration tests
\`\`\`

## Configuration Files

- **.claude/project.json** - Main project configuration
- **.claude/prompts.json** - Claude prompt templates
- **.claude/aliases.sh** - Helpful command aliases

## Integration with Claude Conversations

The \`claude-sync\` command creates:
- **claude-context.json** - Current project status
- **claude-conversation-summary.md** - Summary for Claude conversations

You can copy the contents of \`claude-conversation-summary.md\` to provide context in your Claude conversations.

## Automation

GitHub Actions workflow automatically runs integration checks on:
- Push to main/develop branches
- Pull requests
- Daily at 9 AM UTC

Check the Actions tab for detailed reports.
EOF

log_success "Claude Code integration setup completed!"
echo ""
echo "🎉 Next steps:"
echo "1. Load aliases: source .claude/aliases.sh"
echo "2. Run initial check: claude-check"
echo "3. Review integration report and fix any issues"
echo "4. Use 'claude-sync' to create context for Claude conversations"
echo ""
echo "📁 Files created:"
echo "  .claude/                 - Configuration directory"
echo "  claude-tasks/            - Automation scripts"
echo "  .github/workflows/       - CI automation"
echo ""
echo "🚀 Your Claude Code integration is ready!"