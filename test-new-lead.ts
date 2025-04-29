// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config();
console.log('Environment loaded, SLACK_WEBHOOK_URL exists:', Boolean(process.env.SLACK_WEBHOOK_URL));

import { createClient } from '@supabase/supabase-js';
import * as slackService from './src/services/slack';
import * as scoringService from './src/services/scoring';
import { Lead, SharpSpringLead, LeadUpsertData } from './src/types';

async function testNewLead() {
  console.log('Creating a test lead and sending notification...');
  
  // Mock a new SharpSpring lead with data
  const mockSharpSpringLead: any = {
    id: `mock-${Date.now()}`,
    firstName: 'Test',
    lastName: 'Customer',
    emailAddress: 'test.customer@example.com',
    phoneNumber: '555-123-4567',
    companyName: 'Test Company, Inc.',
    title: 'CTO',
    leadScore: '25',
    leadStatus: 'New',
    time_frame_5eceb4e7d9474: '1-3 months',
    initial_lead_source_5ecff3dcb9ec7: 'Website Contact Form',
    createTimestamp: new Date().toISOString(),
    updateTimestamp: new Date().toISOString(),
    isCustomer: '0',
    isQualified: '1',
    website: 'https://testcompany.com',
    city: 'Dallas',
    state: 'TX',
    zipcode: '75001'
  };
  
  try {
    // Initialize Supabase
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase credentials. Check your .env file.');
      return;
    }
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Map SharpSpring lead to our Lead structure
    const name = [mockSharpSpringLead.firstName, mockSharpSpringLead.lastName].filter(Boolean).join(' ') || null;
    const sharpSpringIdString = String(mockSharpSpringLead.id);
    
    // Parse scores
    const ssLeadScore = mockSharpSpringLead.leadScore ? parseInt(mockSharpSpringLead.leadScore, 10) : null;
    
    // Extract phone from best available field
    const phone = mockSharpSpringLead.mobilePhoneNumber || mockSharpSpringLead.phoneNumber || mockSharpSpringLead.officePhoneNumber || null;
    
    // Map time frame
    const timeFrame = mockSharpSpringLead.time_frame_5eceb4e7d9474 || null;
    
    // Map lead source
    const initialLeadSource = mockSharpSpringLead.initial_lead_source_5ecff3dcb9ec7 || null;
    
    // Prepare lead data
    const leadData: LeadUpsertData = {
      sharpspring_id: sharpSpringIdString,
      name: name,
      email: mockSharpSpringLead.emailAddress || null,
      phone: phone,
      score: 0, // Will be calculated
      tags: ['test', 'demo'],
      last_contacted: null,
      
      // Additional mapped fields
      company_name: mockSharpSpringLead.companyName || null,
      title: mockSharpSpringLead.title || null,
      website: mockSharpSpringLead.website || null,
      lead_status: mockSharpSpringLead.leadStatus || null,
      is_customer: mockSharpSpringLead.isCustomer === '1' ? true : false,
      is_qualified: mockSharpSpringLead.isQualified === '1' ? true : false,
      
      // Time fields
      ss_create_timestamp: mockSharpSpringLead.createTimestamp || null,
      ss_update_timestamp: mockSharpSpringLead.updateTimestamp || null,
      
      // Lead source tracking
      lead_source: null,
      initial_lead_source: initialLeadSource,
      
      // Time frame
      time_frame: timeFrame,
      
      // Location info
      city: mockSharpSpringLead.city || null,
      state: mockSharpSpringLead.state || null,
      zipcode: mockSharpSpringLead.zipcode || null,
      
      // SharpSpring's own score
      ss_lead_score: ssLeadScore
    };
    
    // Calculate a score
    const score = 90; // A high score to trigger notifications
    leadData.score = score;
    
    // Insert the lead
    const createPayload = {
      ...leadData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Inserting new lead...');
    const { data: newLead, error } = await supabase
      .from('leads')
      .insert([createPayload])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating test lead:', error);
      return;
    }
    
    console.log('Lead created successfully!');
    
    // Send a Slack notification
    console.log('Sending Slack notification...');
    const messageTs = await slackService.sendNewLeadNotification(newLead, score);
    
    if (messageTs !== null) {
      console.log('✅ Notification sent successfully!');
    } else {
      if (process.env.SLACK_WEBHOOK_URL) {
        console.log('✅ Notification likely sent but no timestamp returned.');
      } else {
        console.log('❌ Failed to send notification.');
      }
    }
    
    // Log notification to slack_alerts table
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        const alertData = {
          lead_id: newLead.id,
          slack_message_ts: messageTs || 'unknown',
          score_at_send: score
        };
        
        await supabase
          .from('slack_alerts')
          .insert([alertData]);
          
        console.log('✅ Alert logged to database.');
      } catch (alertError) {
        console.error('Error logging alert:', alertError);
      }
    }
    
    console.log('\n✨ Test completed! Check your Slack app for the notification.');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testNewLead().catch(error => console.error('Unhandled error:', error)); 