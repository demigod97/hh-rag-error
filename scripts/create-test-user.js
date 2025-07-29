/**
 * Create Test User Script
 * Helps create test users for testing chat functionality
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://zjhuphfoeqbjssqnqmwu.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqaHVwaGZvZXFianNzcW5xbXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyODcyMTUsImV4cCI6MjA2ODg2MzIxNX0.-nYgJNEZ9L1yBHMOUODxXd3SKDwhE-FajlzMJm-9v0o";

console.log('🧪 Creating Test User for Chat Testing...\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false
  }
});

async function createTestUser() {
  const testEmail = 'testuser@example.com';
  const testPassword = 'testpass123';
  
  console.log('📧 Creating test user:', testEmail);
  
  try {
    // Create user account
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('✅ Test user already exists');
        
        // Try to sign in to verify it works
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        });
        
        if (signInError) {
          console.log('❌ Test user exists but sign in failed:', signInError.message);
          return false;
        }
        
        console.log('✅ Test user sign in successful');
        console.log('👤 User ID:', signInData.user?.id);
        
        // Create a test session for this user
        await createTestSession(signInData.user.id);
        
        return true;
      }
      
      console.log('❌ Error creating user:', error.message);
      return false;
    }

    console.log('✅ Test user created successfully');
    console.log('👤 User ID:', data.user?.id);
    console.log('📧 Email confirmation required:', !data.session);
    
    if (data.session) {
      // Create a test session for this user
      await createTestSession(data.user.id);
    }
    
    return true;
  } catch (err) {
    console.log('💥 Unexpected error:', err.message);
    return false;
  }
}

async function createTestSession(userId) {
  console.log('\n📝 Creating test chat session...');
  
  try {
    // Create a test notebook first
    const { data: notebook, error: notebookError } = await supabase
      .from('notebooks')
      .insert({
        title: 'Test Planning Project',
        user_id: userId,
        project_type: 'residential',
        address: 'Test Address, Test City'
      })
      .select()
      .single();
    
    if (notebookError) {
      console.log('⚠️  Could not create test notebook:', notebookError.message);
      console.log('ℹ️  This is normal if notebooks table doesn\'t exist or has different schema');
      return;
    }
    
    // Create a test chat session
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        notebook_id: notebook?.id,
        title: 'Test Chat Session'
      })
      .select()
      .single();
    
    if (sessionError) {
      console.log('⚠️  Could not create test session:', sessionError.message);
      return;
    }
    
    console.log('✅ Test session created');
    console.log('🆔 Session ID:', session.id);
    console.log('📚 Notebook ID:', notebook?.id);
    
  } catch (err) {
    console.log('⚠️  Session creation error:', err.message);
  }
}

async function testRealtimeAuth() {
  console.log('\n🔄 Testing authenticated realtime...');
  
  try {
    // Sign in as test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'testuser@example.com',
      password: 'testpass123'
    });
    
    if (authError) {
      console.log('❌ Could not sign in test user:', authError.message);
      return;
    }
    
    console.log('✅ Signed in as test user');
    
    // Test realtime subscription with auth
    return new Promise((resolve) => {
      const testSessionId = '11111111-1111-1111-1111-111111111111';
      
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
            console.log('✅ Authenticated realtime message received:', payload.new);
            channel.unsubscribe();
            resolve(true);
          }
        )
        .subscribe((status) => {
          console.log('📡 Authenticated channel status:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Authenticated realtime subscription successful');
            
            // Try to insert a test message with authentication
            setTimeout(async () => {
              const { error } = await supabase
                .from('chat_messages')
                .insert({
                  session_id: testSessionId,
                  role: 'user',
                  content: 'Test authenticated message',
                  user_id: authData.user.id
                });
              
              if (error) {
                console.log('❌ Could not insert authenticated message:', error.message);
                channel.unsubscribe();
                resolve(false);
              } else {
                console.log('📤 Test authenticated message inserted');
              }
            }, 1000);
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Authenticated realtime failed');
            resolve(false);
          }
        });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        console.log('⏰ Authenticated realtime test timeout');
        channel.unsubscribe();
        resolve(false);
      }, 10000);
    });
  } catch (err) {
    console.log('💥 Authenticated realtime test error:', err.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Running Authentication & Chat Tests...\n');
  
  const results = {
    userCreation: await createTestUser(),
    realtimeAuth: await testRealtimeAuth()
  };
  
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log('✅ User Creation:', results.userCreation ? 'PASS' : 'FAIL');
  console.log('✅ Authenticated Realtime:', results.realtimeAuth ? 'PASS' : 'FAIL');
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Score: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All authentication tests passed! Your chat is ready!');
    console.log('\n💡 Next Steps:');
    console.log('• Start your app: npm run dev');
    console.log('• Sign in with: testuser@example.com / testpass123');
    console.log('• Test the chat functionality');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
  }
  
  process.exit(passed === total ? 0 : 1);
}

runTests().catch((error) => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
}); 