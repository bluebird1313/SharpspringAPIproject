/**
 * Parses the raw text response from OpenAI to extract SMS, Subject, and Body.
 * Assumes labels appear on their own lines.
 * @param responseText The raw text from OpenAI.
 * @returns An object containing the extracted sms, subject, and body.
 */
export function parseAIResponse(responseText: string | null): { sms: string | null; subject: string | null; body: string | null } {
    if (!responseText) {
        return { sms: null, subject: null, body: null };
    }

    let sms: string | null = null;
    let subject: string | null = null;
    let body: string | null = null;

    const sections: Record<string, string[]> = {};
    let currentKey: string | null = null;

    // Split into lines and process
    const lines = responseText.split(/\r?\n/);

    for (const line of lines) {
        const trimmedLine = line.trim();
        let isLabel = false;

        // Check if the line is a label
        if (trimmedLine.match(/^(Warm\s)?SMS(?:\sMessage)?:/i)) {
            currentKey = 'sms';
            isLabel = true;
        } else if (trimmedLine.match(/^(Inviting\s)?Email Subject(?:\sLine)?:/i)) {
            currentKey = 'subject';
            isLabel = true;
        } else if (trimmedLine.match(/^(Helpful\s)?Email Body:/i)) {
            currentKey = 'body';
            isLabel = true;
        }

        // If it's not a label and we have a current key, append the line
        if (!isLabel && currentKey && trimmedLine.length > 0) {
            if (!sections[currentKey]) {
                sections[currentKey] = [];
            }
            sections[currentKey].push(trimmedLine); // Keep original trim, join later
        }
    }

    // Join the lines for each section
    sms = sections['sms'] ? sections['sms'].join('\n').trim() : null;
    subject = sections['subject'] ? sections['subject'].join('\n').trim() : null;
    body = sections['body'] ? sections['body'].join('\n').trim() : null;

    // Validation
    if (!sms && !subject && !body) {
         console.warn('[Parser] Could not extract any message parts (revised line method):', responseText);
    }

    console.log(`[Parser Debug] Extracted (revised line method) - SMS: ${!!sms}, Subject: ${!!subject}, Body: ${!!body}`);

    return { sms, subject, body };
} 