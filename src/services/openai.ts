// Placeholder for OpenAI API interaction logic
import OpenAI from 'openai';
import { Lead } from '../types'; // Assuming Lead type is relevant
import * as fs from 'fs'; // Import Node.js file system module
import * as path from 'path'; // Import Node.js path module

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

/**
 * Generates follow-up messages (SMS, Email Subject, Email Body) using OpenAI.
 * @param lead The lead object containing customer info.
 * @returns The raw text response from OpenAI containing the generated messages, or null on error.
 */
export async function generateFollowUpMessages(lead: Lead): Promise<string | null> {
    if (!lead) {
        console.error('generateFollowUpMessages: Lead object is required.');
        return null;
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo'; // Or your preferred model

    // Load prompt template
    let promptTemplate: string;
    try {
        // Construct the absolute path to the prompt file
        const promptPath = path.resolve(__dirname, '../../prompts/sales_message.md'); 
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (readError) {
        console.error('Error reading prompt template file:', readError);
        return null;
    }

    // Format prompt
    const leadJson = JSON.stringify(lead, null, 2); // Pretty print for readability in prompt if needed
    const formattedPrompt = promptTemplate.replace('{{lead_json}}', leadJson);

    try {
        console.log(`Requesting OpenAI message generation using model: ${model} for lead: ${lead.email}`);
        const completion = await client.chat.completions.create({
            messages: [
                // The prompt template itself contains the system message/instructions
                { role: 'user', content: formattedPrompt }
            ],
            model: model,
            max_tokens: 300, // Adjust based on expected output length
            temperature: 0.7, // Adjust for creativity vs consistency
        });

        const responseText = completion.choices[0]?.message?.content;
        if (responseText) {
            console.log('OpenAI message generation successful.');
            return responseText;
        } else {
            console.warn('OpenAI response did not contain message content.', completion);
            return null;
        }
    } catch (error) {
        console.error('Error calling OpenAI API for message generation:', error);
        return null;
    }
} 