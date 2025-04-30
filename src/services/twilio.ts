import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE;

const TWILIO_API_BASE_URL = `https://api.twilio.com/2010-04-01`;

/**
 * Sends an SMS message using Twilio API.
 * @param to The recipient phone number (e.g., +15551234567).
 * @param body The message content.
 * @returns True if the request was likely successful, false otherwise.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_PHONE) {
        console.error('[Twilio] Missing SID, Token, or Phone Number environment variables.');
        return false;
    }
    if (!to || !body) {
        console.error('[Twilio] Missing recipient phone number or message body.');
        return false;
    }

    const endpoint = `${TWILIO_API_BASE_URL}/Accounts/${TWILIO_SID}/Messages.json`;
    
    // Twilio expects form-urlencoded data, not JSON
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', TWILIO_PHONE);
    params.append('Body', body);

    try {
        console.log(`[Twilio] Sending SMS to ${to}`);
        const response = await axios.post(endpoint, params.toString(), {
            auth: {
                username: TWILIO_SID,
                password: TWILIO_TOKEN,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        // Twilio usually returns 201 Created on success
        if (response.status >= 200 && response.status < 300) {
            // Explicitly cast response.data to access potential properties
            const responseData = response.data as any; 
            console.log(`[Twilio] SMS sent successfully to ${to}. SID: ${responseData?.sid}`);
            return true;
        } else {
            console.warn(`[Twilio] Received non-success status code ${response.status} sending SMS to ${to}.`);
            return false;
        }

    } catch (error: any) {
        console.error(`[Twilio] Error sending SMS to ${to}:`, error.response?.data || error.message);
        return false;
    }
} 