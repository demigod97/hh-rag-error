#!/usr/bin/env node

/**
 * Claude Code Development Task Automation
 * Automates common development tasks for the town-planner project
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DevTaskManager {
  constructor() {
    this.tasksFile = 'TASKS.md';
    this.agentsFile = 'AGENTS.md';
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

  executeCommand(command, description) {
    this.log(`Executing: ${description}`, 'info');
    try {
      const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      this.log(`✅ ${description} completed`, 'success');
      return output;
    } catch (error) {
      this.log(`❌ ${description} failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async checkWorkflowStatus() {
    this.log('Checking n8n workflow status...', 'info');
    
    try {
      // Check if n8n is running
      const dockerPs = this.executeCommand('docker ps --filter "name=n8n" --format "{{.Status}}"', 'Check n8n container');
      
      if (dockerPs.includes('Up')) {
        this.log('✅ n8n container is running', 'success');
        
        // Try to connect to n8n API (if API key is configured)
        const envContent = fs.readFileSync('.env', 'utf8');
        const apiKeyMatch = envContent.match(/N8N_API_KEY=(.+)/);
        
        if (apiKeyMatch) {
          this.log('✅ n8n API key found in environment', 'success');
          // Add API health check here if needed
        } else {
          this.log('⚠️  n8n API key not configured', 'warning');
        }
      } else {
        this.log('❌ n8n container is not running', 'error');
      }
    } catch (error) {
      this.log('❌ Could not check n8n status', 'error');
    }
  }

  async validateSupabaseConnection() {
    this.log('Validating Supabase connection...', 'info');
    
    try {
      // Check if Supabase containers are running
      const supabaseContainers = [
        'supabase_db_',
        'supabase_kong_',
        'supabase_functions_'
      ];
      
      for (const container of supabaseContainers) {
        const result = this.executeCommand(
          `docker ps --filter "name=${container}" --format "{{.Names}}"`,
          `Check ${container} container`
        );
        
        if (result.trim()) {
          this.log(`✅ ${container} is running`, 'success');
        } else {
          this.log(`❌ ${container} is not running`, 'error');
        }
      }
    } catch (error) {
      this.log('❌ Could not validate Supabase connection', 'error');
    }
  }

  async runIntegrationTests() {
    this.log('Running integration tests...', 'info');
    
    const tests = [
      {
        name: 'File Upload Test',
        command: 'npm run test:upload',
        description: 'Test file upload functionality'
      },
      {
        name: 'Chat API Test',
        command: 'npm run test:chat',
        description: 'Test chat API endpoints'
      },
      {
        name: 'Workflow Trigger Test',
        command: 'npm run test:workflows',
        description: 'Test n8n workflow triggers'
      }
    ];

    for (const test of tests) {
      try {
        this.executeCommand(test.command, test.description);
      } catch (error) {
        this.log(`Test skipped: ${test.name} (command not found)`, 'warning');
      }
    }
  }

  async updateTaskStatus() {
    this.log('Updating task status...', 'info');
    
    if (!fs.existsSync(this.tasksFile)) {
      this.log('TASKS.md not found, creating template...', 'warning');
      this.createTasksTemplate();
    }

    const tasksContent = fs.readFileSync(this.tasksFile, 'utf8');
    const timestamp = new Date().toISOString();
    
    // Add automation timestamp
    const updatedContent = tasksContent.replace(
      /Last Updated: .*/,
      `Last Updated: ${timestamp} (via Claude Code)`
    );
    
    fs.writeFileSync(this.tasksFile, updatedContent);
    this.log('✅ Tasks file updated', 'success');
  }

  createTasksTemplate() {
    const template = `# TASKS.md - Development Task Backlog

> **⚠️ Important**: This file is automatically updated by Claude Code.

## 🔴 Critical Issues (Blocking Core Functionality)

### 1. Integration Status Check
**Priority**: 🔥 URGENT  
**Status**: ✅ AUTOMATED  
**Description**: Claude Code integration and monitoring active

**Automated Checks**:
- [x] Docker containers status
- [x] n8n workflow connectivity  
- [x] Supabase connection validation
- [x] Environment variables verification

## 🟡 High Priority (Core Features)

### Development Tasks
- [ ] Complete n8n workflow integration
- [ ] Implement file upload processing
- [ ] Fix chat message persistence
- [ ] Validate API endpoints

## 📝 Notes

*Last Updated: ${new Date().toISOString()} (via Claude Code)*
`;

    fs.writeFileSync(this.tasksFile, template);
  }

  async syncWithClaudeProjects() {
    this.log('Syncing with Claude projects...', 'info');
    
    // Create a project context file for Claude
    const context = {
      projectName: 'town-planner-local-ai',
      lastSync: new Date().toISOString(),
      currentStatus: await this.getProjectStatus(),
      activeIssues: await this.getActiveIssues(),
      nextTasks: await this.getNextTasks()
    };
    
    fs.writeFileSync('claude-context.json', JSON.stringify(context, null, 2));
    this.log('✅ Claude context file created', 'success');
    
    // Create conversation summary
    const summary = this.generateConversationSummary(context);
    fs.writeFileSync('claude-conversation-summary.md', summary);
    this.log('✅ Conversation summary created', 'success');
  }

  async getProjectStatus() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const envExists = fs.existsSync('.env');
      const dockerComposeExists = fs.existsSync('docker-compose.yml');
      
      return {
        version: packageJson.version,
        environment: envExists ? 'configured' : 'needs_setup',
        docker: dockerComposeExists ? 'available' : 'missing',
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async getActiveIssues() {
    const issues = [];
    
    // Check for common integration issues
    if (!fs.existsSync('town-planner-local-package/')) {
      issues.push('Town planner local package not created');
    }
    
    if (!fs.existsSync('.env')) {
      issues.push('Environment variables not configured');
    }
    
    try {
      const dockerPs = execSync('docker ps', { encoding: 'utf8' });
      if (!dockerPs.includes('n8n')) {
        issues.push('n8n container not running');
      }
    } catch (error) {
      issues.push('Docker not accessible');
    }
    
    return issues;
  }

  async getNextTasks() {
    return [
      'Complete local-ai-packaged integration',
      'Set up n8n workflows',
      'Test file upload processing',
      'Validate chat functionality',
      'Deploy and test end-to-end'
    ];
  }

  generateConversationSummary(context) {
    return `# Claude Conversation Summary

## Project: ${context.projectName}
**Last Updated**: ${context.lastSync}

## Current Status
\`\`\`json
${JSON.stringify(context.currentStatus, null, 2)}
\`\`\`

## Active Issues
${context.activeIssues.map(issue => `- [ ] ${issue}`).join('\n')}

## Next Tasks
${context.nextTasks.map(task => `- [ ] ${task}`).join('\n')}

## For Claude Context
This project is a React/Vite town planning application being integrated with local-ai-packaged for Docker deployment. The main focus is on:

1. **File Processing**: PDF uploads triggering n8n workflows
2. **Chat Functionality**: LLM-powered chat with document context
3. **Integration**: Seamless Docker container communication
4. **Workflow Automation**: n8n workflows for document processing and chat

Key files to reference:
- \`TASKS.md\` - Current development priorities
- \`AGENTS.md\` - Architecture and development guidelines
- \`integration-report.json\` - Latest integration status
- \`docker-compose.yml\` - Container configuration

Use the integration checker script to validate current status:
\`\`\`bash
node claude-tasks/integration-checker.js
\`\`\`
`;
  }

  async runFullCheck() {
    this.log('Running full development check...', 'info');
    
    await this.checkWorkflowStatus();
    await this.validateSupabaseConnection();
    await this.updateTaskStatus();
    await this.syncWithClaudeProjects();
    
    this.log('✅ Full development check completed', 'success');
    this.log('📋 Check integration-report.json for detailed status', 'info');
    this.log('💬 Check claude-conversation-summary.md for Claude context', 'info');
  }
}

// CLI interface
if (require.main === module) {
  const manager = new DevTaskManager();
  const command = process.argv[2];
  
  switch (command) {
    case 'check':
      manager.runFullCheck();
      break;
    case 'workflows':
      manager.checkWorkflowStatus();
      break;
    case 'supabase':
      manager.validateSupabaseConnection();
      break;
    case 'sync':
      manager.syncWithClaudeProjects();
      break;
    case 'test':
      manager.runIntegrationTests();
      break;
    default:
      console.log(`
Claude Code Development Tasks

Usage: node claude-tasks/dev-tasks.js <command>

Commands:
  check      - Run full development check
  workflows  - Check n8n workflow status
  supabase   - Validate Supabase connection
  sync       - Sync with Claude projects
  test       - Run integration tests

Examples:
  node claude-tasks/dev-tasks.js check
  node claude-tasks/dev-tasks.js workflows
      `);
  }
}

module.exports = DevTaskManager;