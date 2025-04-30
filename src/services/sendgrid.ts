import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

const SENDGRID_API_BASE_URL = 'https://api.sendgrid.com/v3';

/**
 * Sends an email using the SendGrid API.
 * @param to The recipient email address.
 * @param subject The email subject line.
 * @param body The plain text email body content.
 * @returns True if the request was accepted by SendGrid (2xx status), false otherwise.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    if (!SENDGRID_API_KEY || !EMAIL_FROM) {
        console.error('[SendGrid] Missing API Key or From Email environment variables.');
        return false;
    }
    if (!to || !subject || !body) {
        console.error('[SendGrid] Missing recipient, subject, or body.');
        return false;
    }

    const endpoint = `${SENDGRID_API_BASE_URL}/mail/send`;
    const headers = {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
    };
    const data = {
        personalizations: [{
            to: [{ email: to }],
            subject: subject,
        }],
        from: { email: EMAIL_FROM }, // Ensure this email is verified in SendGrid
        content: [{
            type: 'text/plain',
            value: body,
        }],
    };

    try {
        console.log(`[SendGrid] Sending email to ${to} with subject: "${subject}"`);
        const response = await axios.post(endpoint, data, { headers });

        // SendGrid returns 202 Accepted on success
        if (response.status >= 200 && response.status < 300) {
            console.log(`[SendGrid] Email request accepted for ${to}. Status: ${response.status}`);
            return true;
        } else {
            console.warn(`[SendGrid] Received non-success status code ${response.status} sending email to ${to}.`);
            return false;
        }
    } catch (error: any) {
        console.error(`[SendGrid] Error sending email to ${to}:`, error.response?.data || error.message);
        return false;
    }
} 