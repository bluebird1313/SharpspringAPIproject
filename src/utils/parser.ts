/**
 * Parses the raw text response from OpenAI to extract SMS, Subject, and Body.
 * Assumes labels like "SMS:", "Email Subject:", "Email Body:" appear on their own lines.
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

    // Split into lines for simpler processing
    const lines = responseText.split(/\r?\n/);
    let currentSection: 'sms' | 'subject' | 'body' | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.match(/^SMS(?:\sMessage)?:/i)) {
            currentSection = 'sms';
            currentContent = []; // Reset for new section
        } else if (trimmedLine.match(/^Email Subject(?:\sLine)?:/i)) {
            currentSection = 'subject';
            currentContent = []; // Reset for new section
        } else if (trimmedLine.match(/^Email Body:/i)) {
            currentSection = 'body';
            currentContent = []; // Reset for new section
        } else if (currentSection && trimmedLine.length > 0) {
             // Only add non-empty lines to the current section's content
            currentContent.push(trimmedLine);
        } else if (currentSection && trimmedLine.length === 0 && currentContent.length > 0) {
            // If we hit an empty line after collecting content, potentially end the section
            // This helps if there are unwanted blank lines between sections
            if(currentSection === 'sms') sms = currentContent.join('\n').trim() || null;
            if(currentSection === 'subject') subject = currentContent.join('\n').trim() || null;
            if(currentSection === 'body') body = currentContent.join('\n').trim() || null;
            // Keep currentSection active in case the body has multiple paragraphs separated by blank lines
            if (currentSection !== 'body') {
                 currentContent = []; // Clear content unless it's the body
            }
        }
    }
    
    // Assign remaining content if loop finishes
    if(currentSection === 'sms' && currentContent.length > 0) sms = currentContent.join('\n').trim() || null;
    if(currentSection === 'subject' && currentContent.length > 0) subject = currentContent.join('\n').trim() || null;
    if(currentSection === 'body' && currentContent.length > 0) body = currentContent.join('\n').trim() || null;
    
    // Basic validation: Check if at least one part was extracted
    if (!sms && !subject && !body) {
         console.warn('[Parser] Could not extract any message parts from AI response (line-by-line method):', responseText);
    }

    console.log(`[Parser Debug] Extracted (line-by-line) - SMS: ${!!sms}, Subject: ${!!subject}, Body: ${!!body}`);

    return { sms, subject, body };
} 