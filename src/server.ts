import express, { Request, Response } from 'express';
import * as supabaseService from './services/supabase';
import * as openaiService from './services/openai';
import * as sharpSpringService from './services/sharpspring';
import * as slackService from './services/slack';
import * as scoringService from './services/scoring';
import { Lead } from './types';
import * as dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { handleSharpSpringWebhook } from './webhooks/sharpspring-webhook';

dotenv.config();

const LEAD_SCORE_THRESHOLD = parseInt(process.env.LEAD_SCORE_THRESHOLD || '85', 10);

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Webhook endpoint for logging manual interactions (calls, SMS, etc.)
app.post('/api/log-interaction', async (req: Request, res: Response) => {
    console.log('Received request to /api/log-interaction');
    const { leadIdentifier, identifierType, interactionType, summary } = req.body;

    // Basic Validation
    if (!leadIdentifier || !identifierType || !interactionType || !summary) {
        return res.status(400).json({ message: 'Missing required fields: leadIdentifier, identifierType, interactionType, summary' });
    }
    if (identifierType !== 'email' && identifierType !== 'sharpspring_id') {
         return res.status(400).json({ message: 'Invalid identifierType. Must be "email" or "sharpspring_id".' });
    }

    try {
        // 1. Find the lead in Supabase
        let lead: Lead | null = null;
        if (identifierType === 'email') {
            lead = await supabaseService.getLeadByEmail(leadIdentifier);
        } else {
            lead = await supabaseService.getLeadBySharpSpringId(leadIdentifier);
        }

        if (!lead || !lead.id) {
            return res.status(404).json({ message: `Lead not found with ${identifierType}: ${leadIdentifier}` });
        }

        console.log(`Found lead ${lead.email} (ID: ${lead.id}) for interaction logging.`);
        const originalScore = lead.score;

        // 2. Summarize interaction with OpenAI (async, but wait for it here)
        const aiSummary = await openaiService.summarizeInteraction(summary);
        console.log(`AI Summary: ${aiSummary || 'Not generated'}`);

        // 3. Log the interaction in Supabase
        const interactionData = {
            lead_id: lead.id,
            type: interactionType,
            summary: summary,
            summary_ai: aiSummary,
            interaction_time: new Date()
        };
        const loggedInteraction = await supabaseService.addInteraction(interactionData);
        if (!loggedInteraction) {
             // Log error but try to continue updating score/notes
            console.error("Failed to log interaction to Supabase, continuing...");
        }

        // 4. Recalculate score based on interaction
        const newScore = scoringService.recalculateScoreOnInteraction(lead.score, interactionType, aiSummary);

        // 5. Update lead score in Supabase
        const updatedLead = await supabaseService.updateLeadScoreAndNotes(lead.id, newScore, null); // Not adding notes here yet
        if (!updatedLead) {
             console.error("Failed to update lead score in Supabase after interaction.");
             // Consider how to handle this - maybe don't update SharpSpring?
             return res.status(500).json({ message: 'Error updating lead score in database.' });
        }

        // 6. Send Slack Alert if score crosses threshold
        const scoreCrossedThreshold = newScore >= LEAD_SCORE_THRESHOLD && originalScore < LEAD_SCORE_THRESHOLD;
        if (scoreCrossedThreshold) {
            console.log(`Lead ${updatedLead.email} crossed threshold (${newScore}) after interaction. Sending alert.`);
            await slackService.sendLeadAlert(updatedLead, newScore);
        }

        // 7. Update lead in SharpSpring (async, don't necessarily wait)
        const noteForSharpSpring = `Interaction Logged (${interactionType}):\n${summary}\n\n${aiSummary ? 'AI Summary: ' + aiSummary + '\n' : ''}Score updated to: ${newScore}`;
        sharpSpringService.updateLead(lead.sharpspring_id, newScore, noteForSharpSpring)
            .then(() => console.log(`Successfully triggered update for SharpSpring lead ${lead.sharpspring_id}`))
            .catch(err => console.error(`Error triggering update for SharpSpring lead ${lead.sharpspring_id}:`, err));

        return res.status(200).json({ message: 'Interaction logged successfully', leadId: lead.id, newScore: newScore });

    } catch (error) {
        console.error("Error processing /api/log-interaction:", error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// SharpSpring webhook endpoint
app.post('/webhooks/sharpspring', handleSharpSpringWebhook);

export const startServer = (port: number | string): void => {
    app.listen(port, () => {
        console.log(`🚀 Server listening on port ${port}`);
        console.log('Available endpoints:');
        console.log('- GET /health - Health check');
        console.log('- POST /webhooks/sharpspring - SharpSpring webhook endpoint');
    });
};

export default app; 