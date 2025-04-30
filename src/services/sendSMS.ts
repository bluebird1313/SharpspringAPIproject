import axios from 'axios';

export async function sendSMS(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_SID}/Messages.json`;
  const auth = {
    username: process.env.TWILIO_SID || '',
    password: process.env.TWILIO_TOKEN || ''
  };

  const payload = new URLSearchParams({
    From: process.env.TWILIO_PHONE || '',
    To: to,
    Body: body
  });

  // Add try...catch for error handling and logging
  try {
    console.log(`[Twilio] Attempting to send SMS to ${to}`);
    const response = await axios.post(url, payload.toString(), { 
      auth,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
     });
    // Twilio success is typically 201 Created
    if (response.status >= 200 && response.status < 300) {
        const responseData = response.data as any;
        console.log(`[Twilio] SMS sent successfully to ${to}. SID: ${responseData?.sid}`);
        return true; // Indicate success
    } else {
        console.warn(`[Twilio] Received non-success status code ${response.status} sending SMS to ${to}.`);
        return false; // Indicate failure
    }
  } catch (error: any) {
    console.error(`[Twilio] Error sending SMS to ${to}:`, error.response?.data || error.message);
    // Optionally re-throw or handle specific errors
    // throw error;
    return false; // Indicate failure
  }
} 