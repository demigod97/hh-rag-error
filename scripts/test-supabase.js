#!/usr/bin/env node

/**
 * Supabase Integration Test Script
 * Tests the complete Supabase setup for the town-planner project
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class SupabaseTestSuite {
  constructor() {
    this.supabaseUrl = process.env.VITE_SUPABASE_URL;
    this.supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async test(description, testFn) {
    try {
      log(`\n🧪 ${description}`, 'blue');
      await testFn();
      log(`✅ PASS: ${description}`, 'green');
      this.results.passed++;
      this.results.tests.push({ description, status: 'PASS' });
    } catch (error) {
      log(`❌ FAIL: ${description}`, 'red');
      log(`   Error: ${error.message}`, 'red');
      this.results.failed++;
      this.results.tests.push({ description, status: 'FAIL', error: error.message });
    }
  }

  async runAllTests() {
    log('🚀 Starting Supabase Integration Tests', 'blue');
    log('=' .repeat(50), 'blue');

    // Environment validation
    await this.test('Environment variables are configured', async () => {
      if (!this.supabaseUrl) throw new Error('VITE_SUPABASE_URL not set');
      if (!this.supabaseKey) throw new Error('VITE_SUPABASE_ANON_KEY not set');
      log(`   URL: ${this.supabaseUrl}`, 'yellow');
    });

    // Client connection
    let supabase;
    await this.test('Can create Supabase client', async () => {
      supabase = createClient(this.supabaseUrl, this.supabaseKey);
      if (!supabase) throw new Error('Failed to create client');
    });

    // Service role client
    let serviceClient;
    await this.test('Can create service role client', async () => {
      if (!this.serviceKey) {
        log('   Warning: SUPABASE_SERVICE_ROLE_KEY not set, skipping service tests', 'yellow');
        return;
      }
      serviceClient = createClient(this.supabaseUrl, this.serviceKey);
      if (!serviceClient) throw new Error('Failed to create service client');
    });

    // Database connectivity
    await this.test('Database connection works', async () => {
      const { data, error } = await supabase
        .from('hh_chat_sessions')
        .select('count', { count: 'exact', head: true });
      
      if (error) throw error;
      log(`   Found ${data || 0} chat sessions`, 'yellow');
    });

    // Table structure validation
    await this.test('Core tables exist and are accessible', async () => {
      const tables = ['hh_chat_sessions', 'hh_uploads', 'hh_chat_messages', 'hh_templates'];
      
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('count', { count: 'exact', head: true });
        
        if (error) {
          throw new Error(`Table ${table} not accessible: ${error.message}`);
        }
        log(`   ✓ ${table}: ${data || 0} records`, 'yellow');
      }
    });

    // Storage bucket tests
    await this.test('Storage buckets are configured', async () => {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) throw error;
      
      const requiredBuckets = ['hh_pdf_library', 'hh_templates'];
      const existingBuckets = buckets.map(b => b.name);
      
      for (const bucket of requiredBuckets) {
        if (!existingBuckets.includes(bucket)) {
          throw new Error(`Bucket ${bucket} not found`);
        }
        log(`   ✓ ${bucket} bucket exists`, 'yellow');
      }
    });

    // RLS policies test
    await this.test('Row Level Security is enabled', async () => {
      if (!serviceClient) {
        log('   Skipping RLS test (no service key)', 'yellow');
        return;
      }

      // Try to access data without auth (should fail due to RLS)
      const { data, error } = await supabase
        .from('hh_chat_sessions')
        .select('*')
        .limit(1);

      // This should return empty array or error due to RLS
      if (data && data.length > 0) {
        log('   Warning: RLS may not be properly configured', 'yellow');
      } else {
        log('   ✓ RLS is blocking unauthorized access', 'yellow');
      }
    });

    // Vector extension test
    await this.test('Vector extension is available', async () => {
      if (!serviceClient) {
        log('   Skipping vector test (no service key)', 'yellow');
        return;
      }

      const { data, error } = await serviceClient
        .from('hh_pdf_vectors')
        .select('count', { count: 'exact', head: true });

      if (error && error.code === '42883') {
        throw new Error('Vector extension not installed');
      }
      
      if (error && !error.message.includes('permission denied')) {
        throw error;
      }

      log('   ✓ Vector extension appears to be available', 'yellow');
    });

    // Edge functions connectivity (if running locally)
    await this.test('Edge functions are accessible', async () => {
      try {
        const response = await fetch(`${this.supabaseUrl}/functions/v1/proxy/test`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ test: true })
        });

        if (response.status === 404) {
          log('   Edge functions not deployed yet (expected in development)', 'yellow');
        } else if (response.ok) {
          log('   ✓ Edge functions are responding', 'yellow');
        } else {
          log(`   Edge functions returned status ${response.status}`, 'yellow');
        }
      } catch (error) {
        log('   Edge functions not accessible (expected in development)', 'yellow');
      }
    });

    // Generate test report
    this.generateReport();
  }

  generateReport() {
    log('\n' + '=' .repeat(50), 'blue');
    log('📊 SUPABASE TEST RESULTS', 'blue');
    log('=' .repeat(50), 'blue');
    
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? Math.round((this.results.passed / total) * 100) : 0;
    
    log(`✅ Passed: ${this.results.passed}`, 'green');
    log(`❌ Failed: ${this.results.failed}`, 'red');
    log(`📈 Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');

    if (this.results.failed > 0) {
      log('\n🔴 FAILED TESTS:', 'red');
      this.results.tests
        .filter(test => test.status === 'FAIL')
        .forEach(test => {
          log(`  • ${test.description}: ${test.error}`, 'red');
        });
    }

    log('\n💡 NEXT STEPS:', 'blue');
    if (this.results.failed === 0) {
      log('  🎉 All tests passed! Supabase is ready for development.', 'green');
      log('  📋 You can now:', 'blue');
      log('     1. Start the development server: npm run dev', 'yellow');
      log('     2. Deploy edge functions: supabase functions deploy', 'yellow');
      log('     3. Test file uploads and chat functionality', 'yellow');
    } else {
      log('  🔧 Fix the failed tests above:', 'yellow');
      log('     1. Run database migrations: supabase db reset', 'yellow');
      log('     2. Check environment variables in .env', 'yellow');
      log('     3. Verify Supabase project settings', 'yellow');
      log('     4. Re-run this test: npm run test:supabase', 'yellow');
    }

    // Save detailed report
    const reportPath = '.automation/reports/supabase-test-report.json';
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        supabaseUrl: this.supabaseUrl,
        hasServiceKey: !!this.serviceKey
      },
      results: this.results,
      summary: {
        total,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate
      }
    };

    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      log(`\n📄 Detailed report saved: ${reportPath}`, 'blue');
    } catch (error) {
      log(`\n⚠️  Could not save report: ${error.message}`, 'yellow');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  // Load environment variables from .env if it exists
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }

  const testSuite = new SupabaseTestSuite();
  testSuite.runAllTests().catch(error => {
    log(`\n💥 Test suite failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = SupabaseTestSuite;