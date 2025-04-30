import axios from 'axios';

export async function sendEmail(to: string, subject: string, body: string) {
  const url = 'https://api.sendgrid.com/v3/mail/send';

  const payload = {
    personalizations: [
      {
        to: [{ email: to }],
        subject
      }
    ],
    from: { email: process.env.EMAIL_FROM }, // Ensure EMAIL_FROM is set in env
    content: [
      {
        type: 'text/plain',
        value: body
      }
    ]
  };

  // Add try...catch for error handling and logging
  try {
    console.log(`[SendGrid] Attempting to send email to ${to} with subject: "${subject}"`);
    const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        }
    });
    // SendGrid success is typically 202 Accepted
     if (response.status >= 200 && response.status < 300) {
            console.log(`[SendGrid] Email request accepted for ${to}. Status: ${response.status}`);
            return true; // Indicate success
        } else {
            console.warn(`[SendGrid] Received non-success status code ${response.status} sending email to ${to}.`);
            return false; // Indicate failure
        }
  } catch (error: any) {
      console.error(`[SendGrid] Error sending email to ${to}:`, error.response?.data || error.message);
      // Optionally re-throw or handle specific errors
      // throw error;
      return false; // Indicate failure
  }

} 