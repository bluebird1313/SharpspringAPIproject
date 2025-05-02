// Test script for the SharpSpring webhook
import * as dotenv from 'dotenv';
dotenv.config();

import { processWebhookLead } from './src/webhooks/sharpspring-webhook';
import { initializeSupabase } from './src/services/supabase';

async function testWebhook() {
  console.log('Testing webhook processing with sample payloads...');

  // Initialize Supabase first
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials. Check your .env file.');
    return;
  }

  // Initialize supabase service
  initializeSupabase();
  console.log('Supabase initialized for testing.');

  // Test case 1: Name-only payload (simulating the issue)
  const nameOnlyPayload = {
    lead: {
      name: 'Karli'
    }
  };
  
  // Test case 2: Standard payload
  const standardPayload = {
    lead: {
      id: `test-${Date.now()}`,
      firstName: 'Test',
      lastName: 'User',
      emailAddress: 'test.user@example.com',
      phoneNumber: '555-123-4567',
      companyName: 'Test Company',
      title: 'Manager',
      website: 'https://example.com',
      leadStatus: 'New'
    }
  };
  
  try {
    console.log('\n\n======= TESTING NAME-ONLY PAYLOAD =======');
    console.log('This simulates the issue with only a name coming through');
    await processWebhookLead(nameOnlyPayload);
    
    console.log('\n\n======= TESTING STANDARD PAYLOAD =======');
    console.log('This tests normal processing with full lead data');
    await processWebhookLead(standardPayload);
    
    console.log('\n\nTest completed! Check logs above for details on processing.');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Expose processWebhookLead to make it available for the test script
export { processWebhookLead } from './src/webhooks/sharpspring-webhook';

// Run the test
testWebhook().catch(error => console.error('Unhandled error:', error)); 