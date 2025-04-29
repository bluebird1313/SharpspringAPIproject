// Placeholder for Slack notification logic
import axios from 'axios';
import { Lead } from '../types';
import * as dotenv from 'dotenv';

// Load environment variables directly
dotenv.config();

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
console.log('Slack service initialized');
console.log('SLACK_WEBHOOK_URL exists:', Boolean(SLACK_WEBHOOK_URL));

/**
 * Formats a new lead notification message for Slack using Block Kit.
 */
function formatNewLeadNotification(lead: Lead, score: number): object {
    // Use the 'name' field from our Lead type
    const leadName = lead.name || lead.email || `Lead ID ${lead.sharpspring_id}`;

    // Format the time frame in a user-friendly way
    const timeFrame = lead.time_frame || 'Unknown';
    
    // Use fields from the updated Lead type
    const message = {
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `🆕 New Lead: ${leadName}`,
                    emoji: true
                }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Score:* ${score}` },
                    { type: 'mrkdwn', text: `*Status:* ${lead.lead_status || 'New'}` },
                    { type: 'mrkdwn', text: `*Email:* ${lead.email ? `<mailto:${lead.email}|${lead.email}>` : '_N/A_'}` },
                    { type: 'mrkdwn', text: `*Phone:* ${lead.phone || '_N/A_'}` },
                    { type: 'mrkdwn', text: `*Company:* ${lead.company_name || '_N/A_'}` },
                    { type: 'mrkdwn', text: `*Title:* ${lead.title || '_N/A_'}` },
                    { type: 'mrkdwn', text: `*Purchase Timeline:* ${timeFrame}` },
                    { type: 'mrkdwn', text: `*Location:* ${[lead.city, lead.state, lead.zipcode].filter(Boolean).join(', ') || '_N/A_'}` }
                ]
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Lead Source:* ${lead.initial_lead_source || lead.lead_source || '_Unknown_'}` },
                    { type: 'mrkdwn', text: `*Website:* ${lead.website || '_N/A_'}` }
                ]
            },
            {
                type: 'context',
                elements: [
                    { type: 'mrkdwn', text: `Tags: ${lead.tags?.join(', ') || '_None_'}` }
                ]
            },
            {
                type: 'divider'
            },
            {
                type: 'context',
                elements: [
                    { type: 'mrkdwn', text: `Created: ${new Date(lead.created_at).toLocaleString()} | SharpSpring ID: ${lead.sharpspring_id}` }
                ]
            }
        ]
    };
    return message;
}

/**
 * Formats a high-scoring lead alert message for Slack using Block Kit.
 */
function formatHighScoreAlert(lead: Lead, score: number): object {
    // Use the 'name' field from our Lead type
    const leadName = lead.name || lead.email || `Lead ID ${lead.sharpspring_id}`;

    // Use fields from the updated Lead type
    const message = {
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `🚨 Hot Lead Alert! Score: ${score} 🔥`,
                    emoji: true
                }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Lead:* ${leadName}` },
                    { type: 'mrkdwn', text: `*Previous Score:* ${lead.ss_lead_score || 0} → *New Score: ${score}*` },
                    { type: 'mrkdwn', text: `*Email:* ${lead.email ? `<mailto:${lead.email}|${lead.email}>` : '_N/A_'}` },
                    { type: 'mrkdwn', text: `*Phone:* ${lead.phone || '_N/A_'}` },
                    { type: 'mrkdwn', text: `*Status:* ${lead.lead_status || '_N/A_'}` },
                    { type: 'mrkdwn', text: `*Company:* ${lead.company_name || '_N/A_'}` },
                    { type: 'mrkdwn', text: `*Purchase Timeline:* ${lead.time_frame || 'Unknown'}` },
                    { type: 'mrkdwn', text: `*Last Contacted:* ${lead.last_contacted ? new Date(lead.last_contacted).toLocaleString() : '_N/A_'}` }
                ]
            },
            {
                type: 'context',
                elements: [
                    { type: 'mrkdwn', text: `Source: ${lead.initial_lead_source || lead.lead_source || '_Unknown_'} | Tags: ${lead.tags?.join(', ') || '_None_'}` }
                ]
            },
            {
                type: 'divider'
            },
            {
                type: 'context',
                elements: [
                    { type: 'mrkdwn', text: `Alert generated: ${new Date().toLocaleString()} | Lead DB ID: ${lead.id}` }
                ]
            }
        ]
    };
    return message;
}

/**
 * Sends a new lead notification to Slack.
 * @param lead The newly created lead.
 * @param score The lead's score.
 * @returns The Slack message timestamp (ts) if successful, otherwise null.
 */
export async function sendNewLeadNotification(lead: Lead, score: number): Promise<string | null> {
    if (!SLACK_WEBHOOK_URL) {
        console.warn('Slack Webhook URL not configured. Skipping notification.');
        return null;
    }

    const payload = formatNewLeadNotification(lead, score);
    return sendSlackMessage(payload, `new lead: ${lead.email || lead.name || lead.sharpspring_id}`);
}

/**
 * Sends a high-scoring lead alert to Slack.
 * @param lead The lead that crossed the score threshold.
 * @param score The lead's current score that triggered the alert.
 * @returns The Slack message timestamp (ts) if successful, otherwise null.
 */
export async function sendHighScoreAlert(lead: Lead, score: number): Promise<string | null> {
    if (!SLACK_WEBHOOK_URL) {
        console.warn('Slack Webhook URL not configured. Skipping alert.');
        return null;
    }

    const payload = formatHighScoreAlert(lead, score);
    return sendSlackMessage(payload, `high-scoring lead: ${lead.email || lead.name || lead.sharpspring_id} (${score})`);
}

/**
 * For backward compatibility - will use the high score alert format
 */
export async function sendLeadAlert(lead: Lead, score: number): Promise<string | null> {
    return sendHighScoreAlert(lead, score);
}

/**
 * Helper function to send a message to Slack.
 * @param payload The formatted Slack message payload.
 * @param description Description for logging.
 * @returns The Slack message timestamp (ts) if successful, otherwise null.
 */
async function sendSlackMessage(payload: any, description: string): Promise<string | null> {
    try {
        console.log(`Sending Slack message for ${description}`);
        const response = await axios.post(SLACK_WEBHOOK_URL as string, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
            validateStatus: (status: any) => status >= 200 && status < 300,
        });

        console.log(`Slack message sent successfully. Status: ${response.status}`);

        // Extract timestamp if available
        let messageTs: string | null = null;
        const responseData = response.data as { ts?: string };
        if (responseData && responseData.ts) {
            messageTs = responseData.ts;
        }
        
        return messageTs;
    } catch (error: any) {
        if (error && error.isAxiosError) {
            const errorResponse = error.response?.data;
            console.error(`Error sending Slack message: ${error.response?.status}`, errorResponse);
        } else {
            console.error('Generic error sending Slack message:', error);
        }
        return null;
    }
}