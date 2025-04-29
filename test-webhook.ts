// Test script for the SharpSpring webhook
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

async function testWebhook() {
  console.log('Testing SharpSpring webhook...');
  
  // Create a mock SharpSpring lead payload
  const mockLead = {
    id: `test-${Date.now()}`,
    firstName: 'Webhook',
    lastName: 'Test',
    emailAddress: `webhook.test.${Date.now()}@example.com`,
    phoneNumber: '555-123-4567',
    companyName: 'Webhook Test Company',
    title: 'CTO',
    leadScore: '30',
    leadStatus: 'New',
    time_frame_5eceb4e7d9474: '1-3 months',
    initial_lead_source_5ecff3dcb9ec7: 'Webhook Test',
    createTimestamp: new Date().toISOString(),
    updateTimestamp: new Date().toISOString(),
    isCustomer: '0',
    isQualified: '1',
    website: 'https://example.com',
    city: 'Test City',
    state: 'TX',
    zipcode: '12345'
  };
  
  // Prepare the payload as SharpSpring would send it
  const webhookPayload = {
    lead: mockLead,
    event: 'lead.create',
    timestamp: Date.now()
  };
  
  // Get the webhook secret
  const webhookSecret = process.env.SHARPSPRING_WEBHOOK_SECRET;
  
  try {
    // The webhook URL
    const webhookUrl = 'http://localhost:3000/webhooks/sharpspring';
    
    console.log('Sending webhook request to:', webhookUrl);
    console.log('Test lead email:', mockLead.emailAddress);
    
    // Send the webhook request
    const response = await axios.post(webhookUrl, webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhookSecret
      }
    });
    
    console.log('Webhook response status:', response.status);
    console.log('Webhook response data:', response.data);
    console.log('\n✅ Webhook test completed! If your server is running, check the logs.');
    console.log('You should also check your Slack app for a new lead notification.');
    
  } catch (error) {
    console.error('Error sending webhook request:');
    if (axios.isAxiosError(error)) {
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
    } else {
      console.error(error);
    }
  }
}

// Run the test
testWebhook().catch(error => console.error('Unhandled error:', error)); 