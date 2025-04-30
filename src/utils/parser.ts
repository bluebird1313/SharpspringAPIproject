/**
 * Parses the raw text response from OpenAI to extract SMS, Subject, and Body.
 * Assumes labels like "SMS:", "Email Subject:", "Email Body:" are present,
 * potentially with optional words like "Message" or "Line", followed by content on the next line(s).
 * @param responseText The raw text from OpenAI.
 * @returns An object containing the extracted sms, subject, and body, or null if extraction fails.
 */
export function parseAIResponse(responseText: string | null): { sms: string | null; subject: string | null; body: string | null } {
    if (!responseText) {
        return { sms: null, subject: null, body: null };
    }

    // Revised Regex: Match label, skip rest of line, capture subsequent lines
    // Use positive lookahead (?=...) to stop *before* the next label starts on a new line or end of string
    // Use `is` flags: i=ignore case, s=dot matches newline
    const smsMatch = responseText.match(/^SMS(?:\sMessage)?:.*\r?\n(.*?)(?=\r?\n^Email Subject(?:\sLine)?:|\r?\n^Email Body:|$)/is);
    const subjectMatch = responseText.match(/^Email Subject(?:\sLine)?:.*\r?\n(.*?)(?=\r?\n^Email Body:|$)/is);
    const bodyMatch = responseText.match(/^Email Body:.*\r?\n(.*)/is);

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

    // Log what was actually extracted this time for debugging
    console.log(`[Parser Debug] Extracted - SMS: ${!!sms}, Subject: ${!!subject}, Body: ${!!body}`);

    return { sms, subject, body };
} 