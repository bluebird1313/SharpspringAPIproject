import * as dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function testSlack() {
  console.log('Testing Slack webhook...');
  console.log('SLACK_WEBHOOK_URL exists:', Boolean(SLACK_WEBHOOK_URL));
  
  if (!SLACK_WEBHOOK_URL) {
    console.error('Slack Webhook URL not configured!');
    return;
  }
  
  try {
    // Simple test message
    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🧪 Test Notification',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'This is a test notification to verify your Slack integration is working!'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Sent: ${new Date().toLocaleString()}`
            }
          ]
        }
      ]
    };
    
    console.log('Sending test message to Slack...');
    const response = await axios.post(SLACK_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Message sent successfully!');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data));
  } catch (error) {
    console.error('Error sending message to Slack:');
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
testSlack().catch(error => console.error('Unhandled error:', error)); 