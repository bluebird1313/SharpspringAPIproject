/**
 * Parses the raw text response from OpenAI to extract SMS, Subject, and Body.
 * Assumes labels like "SMS:", "Email Subject:", "Email Body:" are present.
 * @param responseText The raw text from OpenAI.
 * @returns An object containing the extracted sms, subject, and body, or null if extraction fails.
 */
export function parseAIResponse(responseText: string | null): { sms: string | null; subject: string | null; body: string | null } {
    if (!responseText) {
        return { sms: null, subject: null, body: null };
    }

    // Use regex with case-insensitive and multiline flags for robustness
    const smsMatch = responseText.match(/^SMS:(.*?)(?:Email Subject:|$)/ims);
    const subjectMatch = responseText.match(/^Email Subject:(.*?)(?:Email Body:|$)/ims);
    const bodyMatch = responseText.match(/^Email Body:(.*)/ims);

    // Trim results and handle potential null matches
    const sms = smsMatch?.[1]?.trim() || null;
    const subject = subjectMatch?.[1]?.trim() || null;
    const body = bodyMatch?.[1]?.trim() || null;

    // Basic validation: Check if at least one part was extracted
    if (!sms && !subject && !body) {
         console.warn('[Parser] Could not extract any message parts from AI response:', responseText);
         // Return nulls if nothing useful was found
         return { sms: null, subject: null, body: null };
    }

    return { sms, subject, body };
} 