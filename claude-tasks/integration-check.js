#!/usr/bin/env node

/**
 * Integration Check Script for Town Planner RAG System
 * Verifies that all local services are running and properly configured
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

let checksPassed = 0;
let totalChecks = 0;

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function check(name, passed, details = '') {
  totalChecks++;
  if (passed) {
    checksPassed++;
    log(`✅ ${name}`, 'green');
  } else {
    log(`❌ ${name}`, 'red');
    if (details) log(`   ${details}`, 'yellow');
  }
}

async function checkEnvironmentVariables() {
  log('\n🔧 Checking Environment Variables', 'blue');
  
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    check('Environment file exists', false, '.env.local not found');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  });
  
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'N8N_WEBHOOK_BASE_URL',
    'N8N_API_KEY'
  ];
  
  check('.env.local file exists', true);
  
  requiredVars.forEach(varName => {
    check(`${varName} set`, !!envVars[varName]);
  });
  
  // Check at least one LLM provider is configured
  const hasOllama = !!envVars['OLLAMA_BASE_URL'];
  const hasOpenAI = !!envVars['OPENAI_API_KEY'];
  const hasGemini = !!envVars['GEMINI_API_KEY'];
  
  check('LLM provider configured', hasOllama || hasOpenAI || hasGemini, 
        !hasOllama && !hasOpenAI && !hasGemini ? 'Need OLLAMA_BASE_URL, OPENAI_API_KEY, or GEMINI_API_KEY' : '');
  
  return envVars;
}

async function checkServiceConnectivity(envVars) {
  log('\n🌐 Checking Service Connectivity', 'blue');
  
  // Check Supabase
  try {
    const supabaseUrl = envVars['VITE_SUPABASE_URL'];
    const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from('notebooks').select('count').limit(1);
      check('Supabase connection', !error, error?.message);
    } else {
      check('Supabase connection', false, 'Missing URL or key');
    }
  } catch (error) {
    check('Supabase connection', false, error.message);
  }
  
  // Check n8n
  try {
    const n8nUrl = envVars['N8N_WEBHOOK_BASE_URL'] || 'http://localhost:5678';
    const response = await fetch(`${n8nUrl}/healthz`);
    check('n8n service', response.ok);
  } catch (error) {
    check('n8n service', false, 'Not reachable on port 5678');
  }
  
  // Check Ollama if configured
  if (envVars['OLLAMA_BASE_URL']) {
    try {
      const ollamaUrl = envVars['OLLAMA_BASE_URL'];
      const response = await fetch(`${ollamaUrl}/api/tags`);
      check('Ollama service', response.ok);
    } catch (error) {
      check('Ollama service', false, 'Not reachable');
    }
  }
}

async function checkDatabaseSchema(envVars) {
  log('\n🗄️ Checking Database Schema', 'blue');
  
  try {
    const supabaseUrl = envVars['VITE_SUPABASE_URL'];
    const serviceRoleKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];
    
    if (!supabaseUrl || !serviceRoleKey) {
      check('Database schema check', false, 'Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Check key tables exist
    const tables = ['notebooks', 'sources', 'document_chunks', 'chunk_embeddings', 
                   'chat_sessions', 'report_templates', 'processing_jobs'];
    
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        check(`Table ${table} exists`, !error);
      } catch (error) {
        check(`Table ${table} exists`, false, error.message);
      }
    }
    
  } catch (error) {
    check('Database schema check', false, error.message);
  }
}

async function checkEdgeFunctions(envVars) {
  log('\n⚡ Checking Edge Functions', 'blue');
  
  const functions = [
    'process-pdf-with-metadata',
    'generate-embeddings', 
    'batch-vector-search',
    'generate-report',
    'process-report-sections'
  ];
  
  const supabaseUrl = envVars['VITE_SUPABASE_URL'];
  const serviceRoleKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!supabaseUrl || !serviceRoleKey) {
    check('Edge functions check', false, 'Missing Supabase credentials');
    return;
  }
  
  for (const functionName of functions) {
    try {
      const functionUrl = supabaseUrl.replace('/rest/v1', '') + `/functions/v1/${functionName}`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: true })
      });
      
      // Function exists if we get any response (even 400/500)
      check(`Function ${functionName}`, response.status < 500);
    } catch (error) {
      check(`Function ${functionName}`, false, 'Not deployed or not reachable');
    }
  }
}

async function main() {
  log('🚀 Town Planner RAG System Integration Check', 'blue');
  log('============================================\n', 'blue');
  
  const envVars = await checkEnvironmentVariables();
  if (envVars) {
    await checkServiceConnectivity(envVars);
    await checkDatabaseSchema(envVars);
    await checkEdgeFunctions(envVars);
  }
  
  log('\n📊 Summary', 'blue');
  log('==========', 'blue');
  
  const successRate = Math.round((checksPassed / totalChecks) * 100);
  
  if (successRate === 100) {
    log(`✅ All ${totalChecks} checks passed! Ready for development.`, 'green');
  } else if (successRate >= 80) {
    log(`⚠️  ${checksPassed}/${totalChecks} checks passed (${successRate}%). Minor issues detected.`, 'yellow');
  } else {
    log(`❌ ${checksPassed}/${totalChecks} checks passed (${successRate}%). Significant issues need attention.`, 'red');
  }
  
  if (successRate < 100) {
    log('\n💡 Quick fixes:', 'blue');
    log('- Run `supabase start` to start local services', 'yellow');
    log('- Run `npx n8n start` to start workflow engine', 'yellow');
    log('- Run `supabase functions deploy` to deploy edge functions', 'yellow');
    log('- Check .env.local for missing environment variables', 'yellow');
  }
  
  process.exit(successRate === 100 ? 0 : 1);
}

main().catch(console.error);