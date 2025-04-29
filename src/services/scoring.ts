// Placeholder for lead scoring logic
import { SharpSpringLead } from '../types';

/**
 * Calculates the initial lead score based on SharpSpring data.
 * This is a basic example; refine the rules based on business logic.
 * @param ssLead Raw SharpSpring lead data.
 * @returns Calculated lead score.
 */
export function calculateInitialScore(ssLead: SharpSpringLead): number {
    let score = 0;

    // --- Rule Examples --- (Adjust weights and criteria)

    // 1. Based on Lead Status (Example weights)
    const statusScores: { [key: string]: number } = {
        'Qualified Lead': 25,
        'Contact': 10,
        'Prospect': 5,
        'open': 8,  // From our example response
        // Add other relevant statuses
    };
    score += statusScores[ssLead.leadStatus || ''] || 0;

    // 2. Based on Job Title (Example keywords)
    if (ssLead.title) {
        const titleLower = ssLead.title.toLowerCase();
        if (titleLower.includes('manager') || titleLower.includes('director') || titleLower.includes('vp') || titleLower.includes('owner')) {
            score += 15;
        }
        if (titleLower.includes('ceo') || titleLower.includes('president')) {
            score += 20;
        }
    }

    // 3. Based on having key information
    if (ssLead.emailAddress) score += 5;
    if (ssLead.phoneNumber) score += 5;
    if (ssLead.companyName) score += 5;

    // 4. Based on purchase intent (time frame)
    // Check for time frame from our example custom field
    if (ssLead.time_frame_5eceb4e7d9474) {
        const timeFrame = ssLead.time_frame_5eceb4e7d9474.toLowerCase();
        if (timeFrame.includes('within 1 month')) {
            score += 25; // Hot prospect
        } else if (timeFrame.includes('within 3 month')) {
            score += 15; // Warm prospect
        } else if (timeFrame.includes('within 6 month')) {
            score += 10; // Interested but not urgent
        }
    }

    // 5. Based on SharpSpring native score if available
    if (ssLead.leadScore) {
        // If SharpSpring already has a score, use a portion of it
        const ssScore = parseInt(ssLead.leadScore, 10);
        if (!isNaN(ssScore)) {
            score += Math.floor(ssScore * 0.5); // Weight SharpSpring score at 50%
        }
    }

    // 6. Apply multipliers based on customer status
    if (ssLead.isCustomer === '1') {
        score = Math.floor(score * 1.5); // Existing customers are 1.5x more valuable
    }

    // 7. Deductions? (e.g., competitor email domain, bounced email status)
    if (ssLead.emailAddress?.endsWith('@competitor.com')) {
        score -= 10;
    }
    
    // Convert unsubscribed users to lower score
    if (ssLead.isUnsubscribed === '1') {
        score = Math.floor(score * 0.5); // Halve the score for unsubscribed leads
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    console.log(`Calculated initial score for ${ssLead.emailAddress || ssLead.id}: ${score}`);
    return score;
}

/**
 * Recalculates the lead score based on a new interaction.
 * @param currentScore The lead's current score before this interaction.
 * @param interactionType Type of interaction (e.g., "Call", "SMS", "Meeting").
 * @param aiSummary Optional AI summary of the interaction.
 * @returns Updated lead score.
 */
export function recalculateScoreOnInteraction(currentScore: number, interactionType: string, aiSummary: string | null): number {
    let scoreAdjustment = 0;

    // Example adjustments based on interaction type
    switch (interactionType.toLowerCase()) {
        case 'call':
            scoreAdjustment += 10;
            break;
        case 'meeting':
            scoreAdjustment += 15;
            break;
        case 'demo': // Assuming 'demo' might be logged as an interaction type
            scoreAdjustment += 25;
            break;
        case 'sms':
        case 'email': // Maybe less impact than a call/meeting
            scoreAdjustment += 5;
            break;
        case 'note': // Neutral or slightly positive?
            scoreAdjustment += 2;
            break;
        default:
            scoreAdjustment += 1; // Small bump for any logged interaction
    }

    // Example adjustments based on AI summary keywords (requires careful prompt engineering)
    if (aiSummary) {
        const summaryLower = aiSummary.toLowerCase();
        if (summaryLower.includes('positive sentiment') || summaryLower.includes('interested') || summaryLower.includes('next steps scheduled')) {
            scoreAdjustment += 10;
        }
        if (summaryLower.includes('negative sentiment') || summaryLower.includes('not interested') || summaryLower.includes('objections')) {
            scoreAdjustment -= 5;
        }
        if (summaryLower.includes('sent proposal') || summaryLower.includes('requested quote')) {
            scoreAdjustment += 15;
        }
    }

    const newScore = Math.max(0, currentScore + scoreAdjustment); // Ensure score doesn't go below 0

    console.log(`Recalculated score after interaction (${interactionType}): ${currentScore} + ${scoreAdjustment} -> ${newScore}`);
    return newScore;
} 