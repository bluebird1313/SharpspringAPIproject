// Load environment variables first (before any other imports)
import * as dotenv from 'dotenv';
dotenv.config();
console.log('Environment loaded, SLACK_WEBHOOK_URL exists:', Boolean(process.env.SLACK_WEBHOOK_URL));

// Test script for Slack lead notifications
import { createClient } from '@supabase/supabase-js';
import * as slackService from './services/slack';
import { Lead } from './types';

/**
 * Test function to verify Slack notifications are working correctly
 */
async function testSlackNotifications() {
    console.log('Starting Slack notification test...');

    // Create a test lead with all fields that would appear in notifications
    const testLead: Lead = {
        id: 'test-lead-id-123',
        sharpspring_id: 'test-ss-id-456',
        name: 'Test User',
        email: 'test@example.com',
        phone: '555-123-4567',
        score: 90,
        tags: ['test', 'important', 'potential'],
        last_contacted: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        
        // Additional fields shown in Slack notifications
        company_name: 'Test Company, Inc.',
        title: 'Chief Test Officer',
        lead_status: 'Qualified',
        initial_lead_source: 'Website Form',
        lead_source: 'Google Ads',
        time_frame: '3-6 months',
        city: 'Seattle',
        state: 'WA',
        zipcode: '98101',
        ss_lead_score: 75, // Previous score (for high score alerts)
        website: 'https://example.com',
        is_customer: false,
        is_qualified: true,
        ss_create_timestamp: new Date().toISOString(),
        ss_update_timestamp: new Date().toISOString()
    };

    try {
        // Test New Lead Notification
        console.log('\n🔍 Testing new lead notification...');
        const newLeadTs = await slackService.sendNewLeadNotification(testLead, testLead.score);
        
        if (newLeadTs !== null) {
            console.log('✅ New lead notification sent successfully!');
            console.log(`   Message timestamp: ${newLeadTs}`);
        } else {
            // Check if it was a webhook URL issue or just no timestamp returned
            if (process.env.SLACK_WEBHOOK_URL) {
                console.log('✅ New lead notification likely sent (no timestamp returned from webhook)');
            } else {
                console.log('❌ Failed to send new lead notification - webhook URL not configured.');
            }
        }

        // Wait a moment between notifications
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test High Score Alert
        console.log('\n🔍 Testing high score alert...');
        const highScoreTs = await slackService.sendHighScoreAlert(testLead, testLead.score);
        
        if (highScoreTs !== null) {
            console.log('✅ High score alert sent successfully!');
            console.log(`   Message timestamp: ${highScoreTs}`);
        } else {
            // Check if it was a webhook URL issue or just no timestamp returned
            if (process.env.SLACK_WEBHOOK_URL) {
                console.log('✅ High score alert likely sent (no timestamp returned from webhook)');
            } else {
                console.log('❌ Failed to send high score alert - webhook URL not configured.');
            }
        }

        // Optionally, if we have Supabase connection, we could log these alerts
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.log('\n🔍 Testing alert logging to Supabase...');
            
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            
            // Only log if we think the notification was sent
            if (process.env.SLACK_WEBHOOK_URL) {
                const { data, error } = await supabase
                    .from('slack_alerts')
                    .insert([{
                        lead_id: testLead.id,
                        slack_message_ts: newLeadTs || 'unknown',
                        score_at_send: testLead.score,
                        alert_type: 'new_lead'
                    }]);
                
                if (error) {
                    console.log('❌ Failed to log new lead alert to Supabase:', error.message);
                } else {
                    console.log('✅ Successfully logged new lead alert to Supabase!');
                }
            }
        }

        console.log('\n✨ Slack notification test completed! Check your Slack channel.');

    } catch (error) {
        console.error('Error during Slack notification test:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
        }
    }
}

// Run the test
testSlackNotifications().catch(err => {
    console.error('Unhandled error in test:', err);
    process.exit(1);
}); 