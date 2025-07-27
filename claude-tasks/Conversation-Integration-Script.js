#!/usr/bin/env node

/**
 * Claude Conversation Integration Helper
 * Helps integrate with Claude conversations and projects
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ClaudeConversationHelper {
  constructor() {
    this.contextFile = 'claude-context.json';
    this.summaryFile = 'claude-conversation-summary.md';
    this.projectFile = '.claude/project.json';
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m', 
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}[${type.toUpperCase()}] ${message}${colors.reset}`);
  }

  async generateProjectContext() {
    this.log('Generating project context for Claude...', 'info');
    
    const context = {
      project: {
        name: 'town-planner-local-ai',
        type: 'React/Vite + Docker Integration',
        description: 'Town planning application with AI-powered document processing',
        lastUpdated: new Date().toISOString()
      },
      architecture: await this.getArchitecture(),
      currentStatus: await this.getCurrentStatus(),
      activeIssues: await this.getActiveIssues(),
      recentChanges: await this.getRecentChanges(),
      nextTasks: await this.getNextTasks(),
      claudeInstructions: this.getClaudeInstructions()
    };

    fs.writeFileSync(this.contextFile, JSON.stringify(context, null, 2));
    this.log(`✅ Context saved to ${this.contextFile}`, 'success');
    
    return context;
  }

  async getArchitecture() {
    return {
      frontend: {
        framework: 'React 18 + TypeScript',
        buildTool: 'Vite',
        styling: 'Tailwind CSS + shadcn/ui',
        structure: 'src/ with components, hooks, lib, pages'
      },
      backend: {
        database: 'Supabase PostgreSQL + vector extensions',
        auth: 'Supabase Auth',
        storage: 'Supabase Storage',
        edgeFunctions: 'Supabase Edge Functions (Deno)',
        workflows: 'n8n automation'
      },
      integration: {
        containerization: 'Docker + local-ai-packaged',
        aiProvider: 'OpenAI API / Ollama (configurable)',
        vectorDB: 'Supabase pgvector',
        workflow: 'n8n webhooks + edge functions'
      }
    };
  }

  async getCurrentStatus() {
    const status = {
      development: 'In Progress',
      phase: 'Local AI Integration',
      lastCheck: new Date().toISOString()
    };

    // Check if integration report exists
    if (fs.existsSync('integration-report.json')) {
      const report = JSON.parse(fs.readFileSync('integration-report.json', 'utf8'));
      status.integrationHealth = `${report.successRate}%`;
      status.lastIntegrationCheck = report.timestamp;
      status.criticalIssues = report.results.failed.length;
    }

    // Check Docker status
    try {
      const dockerPs = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
      status.dockerContainers = dockerPs.split('\n').filter(name => name.trim()).length;
      status.dockerRunning = dockerPs.includes('n8n') && dockerPs.includes('supabase');
    } catch (error) {
      status.dockerStatus = 'Not accessible';
    }

    return status;
  }

  async getActiveIssues() {
    const issues = [];

    // Check TASKS.md for current issues
    if (fs.existsSync('TASKS.md')) {
      const tasksContent = fs.readFileSync('TASKS.md', 'utf8');
      
      // Extract critical issues
      const criticalSection = tasksContent.match(/## 🔴 Critical Issues[\s\S]*?(?=## |$)/);
      if (criticalSection) {
        const criticalIssues = criticalSection[0].match(/### \d+\. (.+)/g);
        if (criticalIssues) {
          issues.push(...criticalIssues.map(issue => issue.replace(/### \d+\. /, '')));
        }
      }
    }

    // Check integration report
    if (fs.existsSync('integration-report.json')) {
      const report = JSON.parse(fs.readFileSync('integration-report.json', 'utf8'));
      issues.push(...report.results.failed.map(fail => fail.replace('❌ ', '')));
    }

    return issues.length > 0 ? issues : ['No critical issues detected'];
  }

  async getRecentChanges() {
    const changes = [];

    try {
      // Get recent git commits
      const gitLog = execSync('git log --oneline -5', { encoding: 'utf8' });
      changes.push(...gitLog.split('\n').filter(line => line.trim()));
    } catch (error) {
      changes.push('Git history not available');
    }

    return changes;
  }

  async getNextTasks() {
    const tasks = [
      'Complete local-ai-packaged integration',
      'Set up n8n workflow automation',
      'Implement file upload processing',
      'Test chat functionality end-to-end',
      'Add error handling and monitoring',
      'Deploy and validate production setup'
    ];

    // Check TASKS.md for specific next tasks
    if (fs.existsSync('TASKS.md')) {
      const tasksContent = fs.readFileSync('TASKS.md', 'utf8');
      const highPrioritySection = tasksContent.match(/## 🟡 High Priority[\s\S]*?(?=## |$)/);
      if (highPrioritySection) {
        const priorityTasks = highPrioritySection[0].match(/- \[ \] (.+)/g);
        if (priorityTasks) {
          tasks.unshift(...priorityTasks.map(task => task.replace('- [ ] ', '')));
        }
      }
    }

    return tasks.slice(0, 10); // Limit to top 10 tasks
  }

  getClaudeInstructions() {
    return {
      contextFiles: [
        'TASKS.md - Current development priorities and issues',
        'AGENTS.md - Architecture guidelines and best practices', 
        'claude-conversation-summary.md - Latest project summary',
        'integration-report.json - Technical integration status'
      ],
      keyCommands: {
        'npm run claude:check': 'Run full integration validation',
        'npm run claude:dev': 'Check development environment',
        'npm run claude:workflows': 'Validate n8n workflows',
        'npm run claude:sync': 'Generate updated context'
      },
      focusAreas: [
        'Docker container integration with local-ai-packaged',
        'n8n workflow automation for file processing',
        'Supabase edge function API connectivity',
        'Frontend-backend communication troubleshooting',
        'Environment variable configuration validation'
      ],
      codebaseStructure: {
        'src/': 'React frontend application',
        'supabase/': 'Database schema and edge functions',
        'town-planner-local-package/': 'Docker integration files',
        'n8n/': 'Workflow automation definitions',
        'claude-tasks/': 'Development automation scripts'
      }
    };
  }

  async generateConversationSummary(context) {
    const summary = `# 🤖 Claude Conversation Context

## Project Overview
**${context.project.name}** - ${context.project.description}

**Type**: ${context.project.type}  
**Phase**: ${context.currentStatus.phase}  
**Status**: ${context.currentStatus.development}  
**Last Updated**: ${context.project.lastUpdated}

## 🏗️ Architecture
- **Frontend**: ${context.architecture.frontend.framework} with ${context.architecture.frontend.styling}
- **Backend**: ${context.architecture.backend.database} + ${context.architecture.backend.workflows}  
- **Integration**: ${context.architecture.integration.containerization}
- **AI**: ${context.architecture.integration.aiProvider}

## 📊 Current Status
- **Integration Health**: ${context.currentStatus.integrationHealth || 'Unknown'}
- **Docker Status**: ${context.currentStatus.dockerRunning ? '✅ Running' : '❌ Issues'}
- **Active Containers**: ${context.currentStatus.dockerContainers || 0}

## 🔴 Active Issues
${context.activeIssues.map(issue => `- ${issue}`).join('\n')}

## 📝 Next Tasks
${context.nextTasks.slice(0, 5).map(task => `- [ ] ${task}`).join('\n')}

## 🔧 For Claude Code Assistance

### Key Files to Reference:
${context.claudeInstructions.contextFiles.map(file => `- **${file}**`).join('\n')}

### Useful Commands:
${Object.entries(context.claudeInstructions.keyCommands).map(([cmd, desc]) => `- \`${cmd}\` - ${desc}`).join('\n')}

### Current Focus Areas:
${context.claudeInstructions.focusAreas.map(area => `- ${area}`).join('\n')}

### Codebase Structure:
${Object.entries(context.claudeInstructions.codebaseStructure).map(([dir, desc]) => `- **${dir}** - ${desc}`).join('\n')}

## 🚀 Quick Commands
\`\`\`bash
# Check integration status
npm run claude:check

# Full development environment check  
npm run claude:dev

# Validate n8n workflows
npm run claude:workflows

# Update this context
npm run claude:sync
\`\`\`

## 📋 Recent Changes
${context.recentChanges.slice(0, 3).map(change => `- ${change}`).join('\n')}

---

**💡 Claude Instructions**: 
When helping with this project, always check the latest integration status first using \`npm run claude:check\`. Reference TASKS.md for current priorities and AGENTS.md for architecture guidelines. Focus on Docker integration, n8n workflow connectivity, and frontend-backend communication issues.

**🎯 Current Priority**: ${context.nextTasks[0] || 'Complete setup and integration testing'}
`;

    fs.writeFileSync(this.summaryFile, summary);
    this.log(`✅ Conversation summary saved to ${this.summaryFile}`, 'success');
    
    return summary;
  }

  async createProjectSnapshot() {
    this.log('Creating project snapshot for Claude...', 'info');

    const snapshot = {
      timestamp: new Date().toISOString(),
      files: {},
      structure: {},
      status: {}
    };

    // Capture key file contents
    const keyFiles = [
      'package.json',
      'TASKS.md',
      'AGENTS.md',
      '.env.example'
    ];

    for (const file of keyFiles) {
      if (fs.existsSync(file)) {
        snapshot.files[file] = fs.readFileSync(file, 'utf8');
      }
    }

    // Capture directory structure
    const scanDir = (dir, prefix = '') => {
      if (!fs.existsSync(dir)) return {};
      
      const items = {};
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries.slice(0, 20)) { // Limit to avoid huge snapshots
        if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
        if (entry.name === 'node_modules') continue;
        
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          items[entry.name] = { type: 'directory', children: scanDir(fullPath, prefix + '  ') };
        } else {
          items[entry.name] = { type: 'file', size: fs.statSync(fullPath).size };
        }
      }
      
      return items;
    };

    snapshot.structure = scanDir('.');

    // Save snapshot
    fs.writeFileSync('claude-project-snapshot.json', JSON.stringify(snapshot, null, 2));
    this.log('✅ Project snapshot created', 'success');

    return snapshot;
  }

  async exportForClaudeProjects() {
    this.log('Exporting project data for Claude Projects...', 'info');

    const exportData = {
      project: {
        name: 'town-planner-local-ai',
        description: 'React/Vite town planning AI assistant with Docker integration',
        technology: 'React, TypeScript, Supabase, n8n, Docker',
        status: 'Development - Integration Phase'
      },
      files: [],
      context: await this.generateProjectContext()
    };

    // Add important files for Claude Projects
    const importantFiles = [
      'TASKS.md',
      'AGENTS.md', 
      'package.json',
      'src/main.tsx',
      'src/lib/api.ts',
      'claude-conversation-summary.md'
    ];

    for (const file of importantFiles) {
      if (fs.existsSync(file)) {
        exportData.files.push({
          path: file,
          content: fs.readFileSync(file, 'utf8'),
          type: path.extname(file) || 'text'
        });
      }
    }

    fs.writeFileSync('claude-projects-export.json', JSON.stringify(exportData, null, 2));
    this.log('✅ Export ready for Claude Projects', 'success');
    
    console.log('\n📤 To use with Claude Projects:');
    console.log('1. Copy the contents of claude-projects-export.json');
    console.log('2. Create a new project in Claude');
    console.log('3. Add the key files from the export');
    console.log('4. Use claude-conversation-summary.md as context');

    return exportData;
  }

  async runFullSync() {
    this.log('Running full Claude synchronization...', 'info');
    
    const context = await this.generateProjectContext();
    await this.generateConversationSummary(context);
    await this.createProjectSnapshot();
    await this.exportForClaudeProjects();
    
    this.log('✅ Full synchronization completed!', 'success');
    console.log('\n📋 Generated files:');
    console.log('  - claude-context.json (project context)');
    console.log('  - claude-conversation-summary.md (for conversations)');
    console.log('  - claude-project-snapshot.json (detailed snapshot)');
    console.log('  - claude-projects-export.json (for Claude Projects)');
    console.log('\n💬 Copy claude-conversation-summary.md to provide context in Claude conversations');
  }
}

// CLI interface
if (require.main === module) {
  const helper = new ClaudeConversationHelper();
  const command = process.argv[2];
  
  switch (command) {
    case 'sync':
      helper.runFullSync();
      break;
    case 'context':
      helper.generateProjectContext();
      break;
    case 'summary':
      helper.generateProjectContext().then(context => 
        helper.generateConversationSummary(context)
      );
      break;
    case 'snapshot':
      helper.createProjectSnapshot();
      break;
    case 'export':
      helper.exportForClaudeProjects();
      break;
    default:
      console.log(`
Claude Conversation Integration Helper

Usage: node claude-tasks/conversation-helper.js <command>

Commands:
  sync      - Run full synchronization (recommended)
  context   - Generate project context only
  summary   - Create conversation summary
  snapshot  - Create project snapshot
  export    - Export for Claude Projects

Examples:
  node claude-tasks/conversation-helper.js sync
  node claude-tasks/conversation-helper.js summary
      `);
  }
}

module.exports = ClaudeConversationHelper;