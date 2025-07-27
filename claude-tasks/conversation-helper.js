#!/usr/bin/env node

/**
 * Claude Conversation Integration Helper
 * Helps integrate with Claude conversations and projects
 * Save as: claude-tasks/conversation-helper.js
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
        name: 'town-planner',
        type: 'React/Vite Frontend with Supabase & n8n Integration',
        description: 'Town planning application with AI-powered document processing and chat',
        lastUpdated: new Date().toISOString(),
        location: process.cwd()
      },
      tech_stack: this.getTechStack(),
      architecture: this.getArchitecture(),
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

  getTechStack() {
    return {
      frontend: {
        framework: 'React 18',
        language: 'TypeScript',
        buildTool: 'Vite',
        styling: 'Tailwind CSS',
        components: 'shadcn/ui',
        testing: 'Cypress'
      },
      backend: {
        database: 'Supabase PostgreSQL',
        auth: 'Supabase Auth', 
        storage: 'Supabase Storage',
        functions: 'Supabase Edge Functions',
        workflows: 'n8n automation'
      },
      integration: {
        platform: 'local-ai-packaged Docker',
        ai: 'OpenAI/Ollama (configurable)',
        vectorDB: 'Supabase pgvector',
        containerization: 'Docker Compose'
      }
    };
  }

  getArchitecture() {
    return {
      pattern: 'Frontend → Supabase Edge Functions → n8n Workflows → AI Services',
      dataFlow: [
        'User uploads file → Supabase Storage',
        'Edge function triggers → n8n workflow',
        'n8n processes → AI analysis', 
        'Results stored → Supabase DB',
        'Frontend displays → Real-time updates'
      ],
      keyComponents: {
        'src/': 'React frontend application',
        'supabase/': 'Database schema and edge functions',
        'n8n/': 'Workflow automation definitions',
        'claude-tasks/': 'Development automation scripts'
      }
    };
  }

  async getCurrentStatus() {
    const status = {
      development: 'In Progress',
      phase: 'Docker Integration & Workflow Setup',
      lastCheck: new Date().toISOString()
    };

    // Check if integration report exists
    if (fs.existsSync('integration-report.json')) {
      const report = JSON.parse(fs.readFileSync('integration-report.json', 'utf8'));
      status.integrationHealth = `${report.successRate}%`;
      status.lastIntegrationCheck = report.timestamp;
      status.criticalIssues = report.results.failed.length;
    }

    // Check project health
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      status.projectVersion = packageJson.version;
      status.dependencies = Object.keys(packageJson.dependencies || {}).length;
    } catch (error) {
      status.projectHealth = 'Could not read package.json';
    }

    // Check Docker status
    try {
      const dockerPs = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
      const containers = dockerPs.split('\n').filter(name => name.trim());
      status.dockerContainers = containers.length;
      status.dockerServices = {
        n8n: containers.some(name => name.includes('n8n')),
        supabase: containers.some(name => name.includes('supabase')),
        ollama: containers.some(name => name.includes('ollama'))
      };
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

    // Check for missing files
    const criticalFiles = [
      '.env',
      'docker-compose.yml', 
      'town-planner-local-package/',
      'supabase/',
      'n8n/'
    ];

    criticalFiles.forEach(file => {
      if (!fs.existsSync(file)) {
        issues.push(`Missing: ${file}`);
      }
    });

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
      'Create town-planner-local-package with Dockerfile',
      'Set up environment variables (.env configuration)',
      'Update docker-compose.yml with town-planner service',
      'Create Supabase edge functions for n8n integration',
      'Set up n8n workflows for file processing',
      'Implement file upload processing pipeline',
      'Create chat functionality with AI backend',
      'Test end-to-end workflow',
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
          const extracted = priorityTasks.map(task => task.replace('- [ ] ', ''));
          tasks.splice(0, 0, ...extracted); // Add to beginning
        }
      }
    }

    return tasks.slice(0, 10); // Limit to top 10 tasks
  }

  getClaudeInstructions() {
    return {
      contextFiles: [
        'TASKS.md - Current development priorities and blocking issues',
        'AGENTS.md - Architecture guidelines and development patterns', 
        'claude-conversation-summary.md - Latest project summary',
        'integration-report.json - Technical integration status',
        'package.json - Project configuration and dependencies'
      ],
      keyCommands: {
        'node claude-tasks/integration-checker.js': 'Run integration validation',
        'node claude-tasks/dev-tasks.js check': 'Full development environment check',
        'node claude-tasks/conversation-helper.js sync': 'Generate updated context',
        'npm run dev': 'Start development server',
        'npm run build': 'Build for production'
      },
      focusAreas: [
        'Docker integration with local-ai-packaged project',
        'n8n workflow automation for file processing',
        'Supabase edge function API connectivity',
        'Frontend-backend communication setup',
        'Environment variable configuration',
        'File upload and processing pipeline'
      ],
      currentPriority: 'Complete Docker integration and workflow setup'
    };
  }

  async generateConversationSummary(context) {
    const summary = `# 🤖 Town Planner Project Context for Claude

## Project Overview
**${context.project.name}** - ${context.project.description}

**Type**: ${context.project.type}  
**Phase**: ${context.currentStatus.phase}  
**Location**: ${context.project.location}  
**Last Updated**: ${context.project.lastUpdated}

## 📊 Current Status
- **Integration Health**: ${context.currentStatus.integrationHealth || 'Checking...'}
- **Critical Issues**: ${context.currentStatus.criticalIssues || 0}
- **Warnings**: ${context.currentStatus.warnings || 0}
- **Last Check**: ${context.currentStatus.lastIntegrationCheck || 'Not run yet'}

## 🏗️ Architecture
### Frontend
- **Framework**: ${context.tech_stack.frontend.framework} + ${context.tech_stack.frontend.language}
- **Build Tool**: ${context.tech_stack.frontend.buildTool}
- **Styling**: ${context.tech_stack.frontend.styling} + ${context.tech_stack.frontend.components}

### Backend & Integration
- **Database**: ${context.tech_stack.backend.database}
- **Workflows**: ${context.tech_stack.backend.workflows}
- **Platform**: ${context.tech_stack.integration.platform}
- **AI Provider**: ${context.tech_stack.integration.ai}

## 🔴 Active Issues
${context.activeIssues.slice(0, 5).map(issue => `- ${issue}`).join('\n')}

## 📋 Next Tasks (Priority Order)
${context.nextTasks.slice(0, 5).map((task, i) => `${i + 1}. ${task}`).join('\n')}

## 🏛️ Architecture Pattern
**Data Flow**: ${context.architecture.pattern}

**Key Components**:
${Object.entries(context.architecture.keyComponents).map(([dir, desc]) => `- **${dir}** - ${desc}`).join('\n')}

## 🔧 For Claude Development Assistance

### Key Files to Reference
${context.claudeInstructions.contextFiles.map(file => `- **${file}**`).join('\n')}

### Useful Commands
${Object.entries(context.claudeInstructions.keyCommands).map(([cmd, desc]) => `- \`${cmd}\` - ${desc}`).join('\n')}

### Current Focus Areas
${context.claudeInstructions.focusAreas.map(area => `- ${area}`).join('\n')}

## 🚀 Quick Development Commands
\`\`\`bash
# Check integration status
node claude-tasks/integration-checker.js

# Full development environment check  
node claude-tasks/dev-tasks.js check

# Update this context
node claude-tasks/conversation-helper.js sync

# Start development server
npm run dev
\`\`\`

## 📋 Recent Changes
${context.recentChanges.slice(0, 3).map(change => `- ${change}`).join('\n')}

---

**💡 Claude Instructions**: 
This project needs help with Docker integration, n8n workflow setup, and frontend-backend connectivity. Always check the latest integration status first, then help with the current blocking issues listed above.

**🎯 Current Priority**: ${context.claudeInstructions.currentPriority}

**🔍 To help effectively**:
1. Run integration check to see current status
2. Review TASKS.md for specific issues
3. Focus on Docker setup and workflow automation
4. Provide specific, actionable solutions
`;

    fs.writeFileSync(this.summaryFile, summary);
    this.log(`✅ Conversation summary saved to ${this.summaryFile}`, 'success');
    
    return summary;
  }

  async exportForClaudeProjects() {
    this.log('Exporting project data for Claude Projects...', 'info');

    const exportData = {
      project: {
        name: 'town-planner',
        description: 'React/Vite town planning AI assistant with Supabase and n8n integration',
        technology: 'React, TypeScript, Vite, Supabase, n8n, Docker',
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
      'vite.config.ts',
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
    await this.exportForClaudeProjects();
    
    this.log('✅ Full synchronization completed!', 'success');
    console.log('\n📋 Generated files:');
    console.log('  - claude-context.json (detailed project context)');
    console.log('  - claude-conversation-summary.md (for conversations)');
    console.log('  - claude-projects-export.json (for Claude Projects)');
    console.log('\n💬 Copy claude-conversation-summary.md content to provide context in Claude conversations');
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
  export    - Export for Claude Projects

Examples:
  node claude-tasks/conversation-helper.js sync
  node claude-tasks/conversation-helper.js summary
      `);
  }
}

module.exports = ClaudeConversationHelper;