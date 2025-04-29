// Placeholder for OpenAI API interaction logic
import OpenAI from 'openai';

let openai: OpenAI;

export function initializeOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key is missing from environment variables.');
    }
    if (!openai) { // Initialize only once
        openai = new OpenAI({ apiKey });
        console.log('OpenAI client initialized.');
    }
    return openai;
}

function getOpenAIClient(): OpenAI {
    if (!openai) {
        throw new Error('OpenAI client has not been initialized. Call initializeOpenAI() first.');
    }
    return openai;
}

/**
 * Uses OpenAI to summarize an interaction log.
 * @param interactionText The raw text from the interaction summary.
 * @returns AI-generated summary string, or null if an error occurs.
 */
export async function summarizeInteraction(interactionText: string): Promise<string | null> {
    if (!interactionText?.trim()) {
        console.log('No interaction text provided for summarization.');
        return null;
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo'; // Or specify another model

    try {
        console.log(`Requesting OpenAI summarization using model: ${model}`);
        const completion = await client.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a helpful assistant that summarizes sales interaction logs concisely. Focus on key outcomes, next steps, and customer sentiment.' },
                { role: 'user', content: `Please summarize the following interaction log:
                \"${interactionText}\"` }
            ],
            model: model,
            max_tokens: 100, // Adjust as needed
            temperature: 0.5, // Lower for more deterministic summaries
        });

        const summary = completion.choices[0]?.message?.content?.trim();
        if (summary) {
            console.log('OpenAI summarization successful.');
            return summary;
        } else {
            console.warn('OpenAI response did not contain a summary.', completion);
            return null;
        }
    } catch (error) {
        console.error('Error calling OpenAI API for summarization:', error);
        return null; // Return null on error to avoid breaking the flow
    }
} 