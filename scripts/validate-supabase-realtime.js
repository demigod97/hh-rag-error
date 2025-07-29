/**
 * Supabase Realtime Chat Validation Script
 * Tests all aspects of realtime chat functionality
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://zjhuphfoeqbjssqnqmwu.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqaHVwaGZvZXFianNzcW5xbXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyODcyMTUsImV4cCI6MjA2ODg2MzIxNX0.-nYgJNEZ9L1yBHMOUODxXd3SKDwhE-FajlzMJm-9v0o";

console.log('🚀 Starting Supabase Realtime Chat Validation...\n');

// Create Supabase client with enhanced realtime config
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false // For testing
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    },
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries) => Math.min(1000 * Math.pow(2, tries), 10000),
    logger: (...args) => console.log('📡 Realtime:', ...args),
    timeout: 20000
  }
});

/**
 * Test 1: Basic Connection
 */
async function testBasicConnection() {
  console.log('📋 Test 1: Basic Connection');
  console.log('🔗 Supabase URL:', SUPABASE_URL);
  console.log('🔑 Using API Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
  
  try {
    // Test basic API call
    const { data, error } = await supabase.from('chat_sessions').select('count').limit(1);
    
    if (error) {
      console.log('❌ Basic connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Basic connection successful');
    return true;
  } catch (err) {
    console.log('❌ Connection error:', err.message);
    return false;
  }
}

/**
 * Test 2: Database Schema Validation
 */
async function testDatabaseSchema() {
  console.log('\n📋 Test 2: Database Schema Validation');
  
  const tables = ['chat_sessions', 'chat_messages'];
  const results = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table ${table}: ${error.message}`);
        results[table] = false;
      } else {
        console.log(`✅ Table ${table}: Available`);
        results[table] = true;
      }
    } catch (err) {
      console.log(`❌ Table ${table}: ${err.message}`);
      results[table] = false;
    }
  }
  
  return Object.values(results).every(Boolean);
}

/**
 * Test 3: Authentication Test
 */
async function testAuthentication() {
  console.log('\n📋 Test 3: Authentication');
  
  try {
    // Test anonymous access (should work with RLS policies)
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('❌ Auth error:', error.message);
      return false;
    }
    
    console.log('✅ Auth system accessible');
    console.log('📊 Current session:', session ? 'Authenticated' : 'Anonymous');
    return true;
  } catch (err) {
    console.log('❌ Auth test failed:', err.message);
    return false;
  }
}

/**
 * Test 4: Real-time Connection
 */
async function testRealtimeConnection() {
  console.log('\n📋 Test 4: Real-time Connection');
  
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.log('❌ Realtime connection timeout');
        resolved = true;
        resolve(false);
      }
    }, 10000);
    
    // Test basic realtime connection
    const channel = supabase.channel('test-connection')
      .on('presence', { event: 'sync' }, () => {
        console.log('📡 Presence sync received');
      })
      .subscribe((status) => {
        console.log('📡 Channel status:', status);
        
        if (status === 'SUBSCRIBED' && !resolved) {
          console.log('✅ Realtime connection successful');
          clearTimeout(timeout);
          resolved = true;
          channel.unsubscribe();
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' && !resolved) {
          console.log('❌ Realtime connection failed');
          clearTimeout(timeout);
          resolved = true;
          resolve(false);
        }
      });
  });
}

/**
 * Test 5: Chat Messages Real-time
 */
async function testChatMessagesRealtime() {
  console.log('\n📋 Test 5: Chat Messages Real-time');
  
  // First, let's create a test session (if we can)
  const testSessionId = '123e4567-e89b-12d3-a456-426614174000'; // Fixed UUID for testing
  
  return new Promise((resolve) => {
    let messageReceived = false;
    const timeout = setTimeout(() => {
      if (!messageReceived) {
        console.log('❌ Chat realtime timeout - no messages received');
        channel.unsubscribe();
        resolve(false);
      }
    }, 15000);
    
    // Subscribe to chat messages for our test session
    const channel = supabase
      .channel(`chat-${testSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${testSessionId}`
        },
        (payload) => {
          console.log('✅ Chat message received via realtime:', payload.new);
          messageReceived = true;
          clearTimeout(timeout);
          channel.unsubscribe();
          resolve(true);
        }
      )
      .subscribe((status) => {
        console.log('📡 Chat channel status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('📡 Subscribed to chat messages for session:', testSessionId);
          console.log('📡 Waiting for test message...');
          
          // Try to insert a test message after a short delay
          setTimeout(async () => {
            try {
              const { error } = await supabase
                .from('chat_messages')
                .insert({
                  session_id: testSessionId,
                  role: 'system',
                  content: 'Test message for realtime validation',
                  user_id: null // This might need adjustment based on RLS
                });
              
              if (error) {
                console.log('⚠️  Could not insert test message (expected due to RLS):', error.message);
                console.log('ℹ️  This is normal - RLS policies require authentication');
              } else {
                console.log('📤 Test message inserted');
              }
            } catch (err) {
              console.log('⚠️  Test message insertion failed:', err.message);
            }
          }, 2000);
        }
      });
  });
}

/**
 * Test 6: Performance Metrics
 */
async function testPerformance() {
  console.log('\n📋 Test 6: Performance Metrics');
  
  const tests = [];
  
  // Test query performance
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    try {
      await supabase.from('chat_sessions').select('id').limit(10);
      const duration = Date.now() - start;
      tests.push(duration);
      console.log(`📊 Query ${i + 1}: ${duration}ms`);
    } catch (err) {
      console.log(`❌ Query ${i + 1} failed:`, err.message);
    }
  }
  
  if (tests.length > 0) {
    const avg = tests.reduce((a, b) => a + b, 0) / tests.length;
    console.log(`📊 Average query time: ${avg.toFixed(2)}ms`);
    
    if (avg < 500) {
      console.log('✅ Performance: Excellent');
    } else if (avg < 1000) {
      console.log('✅ Performance: Good');
    } else {
      console.log('⚠️  Performance: Needs attention');
    }
    
    return true;
  }
  
  return false;
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  console.log('🧪 Running comprehensive Supabase realtime validation...\n');
  
  const results = {
    basicConnection: await testBasicConnection(),
    databaseSchema: await testDatabaseSchema(),
    authentication: await testAuthentication(),
    realtimeConnection: await testRealtimeConnection(),
    chatMessagesRealtime: await testChatMessagesRealtime(),
    performance: await testPerformance()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const passed = Object.entries(results).filter(([, result]) => result).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result ? '✅' : '❌';
    const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    console.log(`${status} ${testName}`);
  });
  
  console.log(`\n🎯 Overall Score: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Your Supabase realtime chat is ready!');
  } else if (passed >= total * 0.8) {
    console.log('⚠️  Most tests passed, but some issues need attention.');
  } else {
    console.log('❌ Several issues detected. Please review the failures above.');
  }
  
  console.log('\n💡 Recommendations:');
  
  if (!results.basicConnection) {
    console.log('• Check your SUPABASE_URL and API key');
    console.log('• Verify network connectivity');
  }
  
  if (!results.databaseSchema) {
    console.log('• Run database migrations: npx supabase db push');
    console.log('• Check RLS policies');
  }
  
  if (!results.realtimeConnection) {
    console.log('• Check if realtime is enabled in your Supabase project');
    console.log('• Verify websocket connections are not blocked');
  }
  
  if (!results.chatMessagesRealtime) {
    console.log('• RLS policies may be preventing test messages');
    console.log('• This is normal for production security');
    console.log('• Test with authenticated user in your app');
  }
  
  console.log('\n🔗 Next Steps:');
  console.log('• Link your project: npx supabase link --project-ref zjhuphfoeqbjssqnqmwu');
  console.log('• Push functions: npx supabase functions deploy');
  console.log('• Test in your app with authenticated user');
  
  process.exit(passed === total ? 0 : 1);
}

// Run the tests
runAllTests().catch((error) => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
}); 