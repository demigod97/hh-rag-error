#!/usr/bin/env node

/**
 * Helper script to add missing API compatibility functions to src/lib/api.ts
 * These functions are expected by existing components but are missing from the current API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

async function main() {
  log('🔧 Adding API Compatibility Functions', 'blue');
  log('====================================\n', 'blue');
  
  const compatibilityPath = path.join(__dirname, '..', 'DOCUMENTATION AND INSTRUCTIONS', 'api-compatibility-functions.ts');
  const apiPath = path.join(__dirname, '..', 'src', 'lib', 'api.ts');
  
  // Check if compatibility functions file exists
  if (!fs.existsSync(compatibilityPath)) {
    log('❌ Compatibility functions file not found', 'red');
    log(`   Expected: ${compatibilityPath}`, 'yellow');
    process.exit(1);
  }
  
  // Check if api.ts exists
  if (!fs.existsSync(apiPath)) {
    log('❌ API file not found', 'red');
    log(`   Expected: ${apiPath}`, 'yellow');
    process.exit(1);
  }
  
  // Read compatibility functions
  const compatibilityContent = fs.readFileSync(compatibilityPath, 'utf8');
  log('✅ Read compatibility functions file', 'green');
  
  // Read current API file
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  log('✅ Read current API file', 'green');
  
  // Extract the function definitions from compatibility file
  const functions = [
    'sendChat',
    'template', 
    'genTemplate',
    'uploadFile',
    'getDefaultNotebook',
    'initializeChatSession'
  ];
  
  // Check which functions are already present
  const missingFunctions = functions.filter(funcName => {
    return !apiContent.includes(`export async function ${funcName}`) && 
           !apiContent.includes(`export function ${funcName}`);
  });
  
  if (missingFunctions.length === 0) {
    log('✅ All compatibility functions already present', 'green');
    process.exit(0);
  }
  
  log(`\n📝 Missing functions detected: ${missingFunctions.join(', ')}`, 'yellow');
  
  // Extract function implementations from compatibility file
  const functionRegex = /export async function (\\w+)\\([^{]*\\{[\\s\\S]*?^}/gm;
  const functionImpls = {};
  let match;
  
  while ((match = functionRegex.exec(compatibilityContent)) !== null) {
    const funcName = match[1];
    if (missingFunctions.includes(funcName)) {
      functionImpls[funcName] = match[0];
    }
  }
  
  // Add missing functions to API file
  let updatedApiContent = apiContent;
  
  // Add compatibility comment section
  const compatibilityComment = `
// =====================================================
// Compatibility Functions for Existing Components
// =====================================================
`;
  
  // Add functions at the end of the file
  let functionsToAdd = compatibilityComment;
  missingFunctions.forEach(funcName => {
    if (functionImpls[funcName]) {
      functionsToAdd += '\n' + functionImpls[funcName] + '\n';
      log(`✅ Added function: ${funcName}`, 'green');
    } else {
      log(`⚠️  Could not extract function: ${funcName}`, 'yellow');
    }
  });
  
  updatedApiContent += functionsToAdd;
  
  // Write updated API file
  fs.writeFileSync(apiPath, updatedApiContent);
  log(`\n✅ Updated ${apiPath}`, 'green');
  
  log('\n📊 Summary:', 'blue');
  log(`   Functions added: ${Object.keys(functionImpls).length}`, 'green');
  log(`   File updated: src/lib/api.ts`, 'green');
  
  log('\n💡 Next steps:', 'blue');
  log('   1. Review the added functions in src/lib/api.ts', 'yellow');
  log('   2. Ensure proper imports are present', 'yellow');
  log('   3. Test component integration', 'yellow');
}

main().catch(console.error);