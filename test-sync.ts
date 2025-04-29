// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config();
console.log('Environment loaded, SLACK_WEBHOOK_URL exists:', Boolean(process.env.SLACK_WEBHOOK_URL));

import * as slackService from './src/services/slack';
import { Lead, SharpSpringLead } from './src/types';

async function testSyncFlow() {
  console.log('Testing sync flow with mock data...');
  
  // Create a mock SharpSpring lead
  const mockSharpSpringLead: SharpSpringLead = {
    id: 'mock-ss-123',
    firstName: 'John',
    lastName: 'Doe',
    emailAddress: 'john.doe@example.com',
    phoneNumber: '555-123-4567',
    companyName: 'Acme Corporation',
    title: 'CEO',
    leadScore: '60',
    leadStatus: 'New',
    time_frame_5eceb4e7d9474: '1-3 months',
    initial_lead_source_5ecff3dcb9ec7: 'Website Contact Form',
    createTimestamp: new Date().toISOString(),
    updateTimestamp: new Date().toISOString(),
    isCustomer: '0',
    isQualified: '1',
    website: 'https://acme.example.com',
    city: 'Boston',
    state: 'MA',
    zipcode: '02108'
  };
  
  // Create a mock Lead object (similar to what would be saved in Supabase)
  const mockLead: Lead = {
    id: 'mock-lead-uuid-123',
    sharpspring_id: mockSharpSpringLead.id,
    name: `${mockSharpSpringLead.firstName} ${mockSharpSpringLead.lastName}`,
    email: mockSharpSpringLead.emailAddress,
    phone: mockSharpSpringLead.phoneNumber,
    score: 75, // Simulated score after calculation
    tags: ['website', 'high-intent'],
    company_name: mockSharpSpringLead.companyName,
    title: mockSharpSpringLead.title,
    website: mockSharpSpringLead.website,
    lead_status: mockSharpSpringLead.leadStatus,
    is_customer: false,
    is_qualified: true,
    time_frame: mockSharpSpringLead.time_frame_5eceb4e7d9474,
    city: mockSharpSpringLead.city,
    state: mockSharpSpringLead.state,
    zipcode: mockSharpSpringLead.zipcode,
    lead_source: null,
    initial_lead_source: mockSharpSpringLead.initial_lead_source_5ecff3dcb9ec7,
    ss_lead_score: parseInt(mockSharpSpringLead.leadScore, 10),
    ss_create_timestamp: mockSharpSpringLead.createTimestamp,
    ss_update_timestamp: mockSharpSpringLead.updateTimestamp,
    last_contacted: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  try {
    // Test new lead notification
    console.log('\n📤 Sending new lead notification (similar to what happens in sync-leads.ts)...');
    await slackService.sendNewLeadNotification(mockLead, mockLead.score);
    console.log('✅ Notification sent! Check your Slack app.');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test high score alert
    console.log('\n📤 Sending high score alert (similar to threshold crossing)...');
    await slackService.sendHighScoreAlert(mockLead, mockLead.score);
    console.log('✅ High score alert sent! Check your Slack app.');
    
    console.log('\n✨ Test completed successfully!');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testSyncFlow().catch(error => console.error('Unhandled error:', error)); 