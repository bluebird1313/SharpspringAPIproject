/**
 * Parses the raw text response from OpenAI to extract SMS, Subject, and Body.
 * Assumes labels like "SMS:", "Email Subject:", "Email Body:" are present,
 * potentially with optional words like "Message" or "Line".
 * @param responseText The raw text from OpenAI.
 * @returns An object containing the extracted sms, subject, and body, or null if extraction fails.
 */
export function parseAIResponse(responseText: string | null): { sms: string | null; subject: string | null; body: string | null } {
    if (!responseText) {
        return { sms: null, subject: null, body: null };
    }

    // Use regex with case-insensitive and multiline flags for robustness
    // Make " Message" and " Line" optional in the labels using (?:...)? non-capturing group
    const smsMatch = responseText.match(/^SMS(?:\sMessage)?:(.*?)(?:Email Subject(?:\sLine)?:|$)/ims);
    const subjectMatch = responseText.match(/^Email Subject(?:\sLine)?:(.*?)(?:Email Body:|$)/ims);
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