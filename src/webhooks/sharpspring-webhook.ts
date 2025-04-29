import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import * as slackService from '../services/slack';
import * as scoringService from '../services/scoring';
import { LeadUpsertData, SharpSpringLead, SlackAlertCreateData, Lead } from '../types';
import { mapSharpSpringToLead } from '../utils/lead-mapper';

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Webhook secret for validation
const WEBHOOK_SECRET = process.env.SHARPSPRING_WEBHOOK_SECRET;

/**
 * Handle SharpSpring webhook requests for new leads
 */
export async function handleSharpSpringWebhook(req: Request, res: Response) {
  console.log('Received SharpSpring webhook request:', req.method);
  
  try {
    // Verify webhook secret if configured (basic security)
    const providedSecret = req.headers['x-webhook-secret'] as string;
    if (WEBHOOK_SECRET && providedSecret !== WEBHOOK_SECRET) {
      console.error('Invalid webhook secret provided');
      return res.status(403).json({ error: 'Invalid webhook secret' });
    }
    
    // Extract lead data from the webhook payload
    const payload = req.body;
    console.log('Webhook payload received:', JSON.stringify(payload));
    
    // Validate payload has the expected structure
    if (!payload || !payload.lead) {
      console.error('Invalid payload structure, missing lead data');
      return res.status(400).json({ error: 'Invalid payload structure' });
    }
    
    // Return a 200 response immediately to acknowledge receipt
    // SharpSpring expects a quick response to consider the webhook successful
    res.status(200).json({ status: 'success', message: 'Webhook received' });
    
    // Process the lead asynchronously (after sending response)
    processWebhookLead(payload.lead).catch(error => {
      console.error('Error processing webhook lead:', error);
    });
    
  } catch (error) {
    console.error('Error handling SharpSpring webhook:', error);
    
    // If we haven't sent a response yet, send an error response
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * Process a lead received from a webhook
 */
async function processWebhookLead(ssLead: SharpSpringLead) {
  console.log('Processing webhook lead:', ssLead.id);
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials for webhook lead processing');
    return;
  }
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  
  try {
    // Convert SharpSpring ID to string
    const sharpSpringIdString = String(ssLead.id);
    
    // Check if lead already exists in the database
    const { data: existingLead, error: findError } = await supabase
      .from('leads')
      .select('*')
      .eq('sharpspring_id', sharpSpringIdString)
      .single();
    
    if (findError && findError.code !== 'PGRST116') { // PGRST116 = Not found
      console.error(`Error finding lead with SharpSpring ID: ${sharpSpringIdString}`, findError);
      return;
    }
    
    // Map the lead data from SharpSpring format to our database format
    const leadData: LeadUpsertData = mapSharpSpringToLead(ssLead);
    
    // Calculate lead score
    const score = scoringService.calculateInitialScore(ssLead);
    leadData.score = score;
    
    let savedLead: Lead | null = null;
    
    if (existingLead) {
      // This is an existing lead, update it
      console.log(`Webhook: Updating existing lead ${existingLead.email} (ID: ${sharpSpringIdString})`);
      
      const originalScore = existingLead.score;
      
      // Prepare update payload, keeping existing data for null/undefined values
      const updatePayload: Partial<LeadUpsertData> & { updated_at?: string } = {
        ...leadData,
        sharpspring_id: sharpSpringIdString,
        name: leadData.name ?? existingLead.name,
        email: leadData.email ?? existingLead.email,
        phone: leadData.phone ?? existingLead.phone,
        tags: leadData.tags ?? existingLead.tags,
        last_contacted: leadData.last_contacted ?? existingLead.last_contacted,
        score: score,
        updated_at: new Date().toISOString(),
      };
      
      // Update the lead in the database
      const { data: updatedLead, error: updateError } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', existingLead.id)
        .select()
        .single();
      
      if (updateError) {
        console.error(`Failed to update lead with SharpSpring ID: ${sharpSpringIdString}`, updateError);
        return;
      }
      
      savedLead = updatedLead;
      
      // Check if the lead crossed the score threshold
      const LEAD_SCORE_THRESHOLD = parseInt(process.env.LEAD_SCORE_THRESHOLD || '85', 10);
      const crossedThreshold = savedLead && score >= LEAD_SCORE_THRESHOLD && originalScore < LEAD_SCORE_THRESHOLD;
      
      if (savedLead && crossedThreshold) {
        console.log(`Webhook: Lead ${savedLead.email} crossed score threshold (${score}). Sending alert.`);
        const messageTs = await slackService.sendHighScoreAlert(savedLead, score);
        
        if (messageTs || process.env.SLACK_WEBHOOK_URL) {
          // Log the alert
          const alertData: SlackAlertCreateData = {
            lead_id: savedLead.id,
            slack_message_ts: messageTs || 'webhook_alert',
            score_at_send: score,
          };
          
          await supabase
            .from('slack_alerts')
            .insert([alertData]);
        }
      }
      
    } else {
      // This is a new lead, create it
      console.log(`Webhook: Creating new lead with email ${leadData.email} (ID: ${sharpSpringIdString})`);
      
      // Prepare create payload
      const createPayload = {
        ...leadData,
        sharpspring_id: sharpSpringIdString,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Insert the new lead
      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert([createPayload])
        .select()
        .single();
      
      if (createError) {
        console.error(`Failed to create lead with SharpSpring ID: ${sharpSpringIdString}`, createError);
        return;
      }
      
      savedLead = newLead;
      
      // Send notification for new lead
      if (savedLead) {
        console.log(`Webhook: Sending notification for new lead: ${savedLead.email}`);
        const messageTs = await slackService.sendNewLeadNotification(savedLead, score);
        
        if (messageTs || process.env.SLACK_WEBHOOK_URL) {
          // Log the notification
          const alertData: SlackAlertCreateData = {
            lead_id: savedLead.id,
            slack_message_ts: messageTs || 'webhook_notification',
            score_at_send: score,
          };
          
          await supabase
            .from('slack_alerts')
            .insert([alertData]);
        }
      }
    }
    
    console.log(`Webhook lead processing completed for ID: ${sharpSpringIdString}`);
    
  } catch (error) {
    console.error('Error processing webhook lead:', error);
  }
} 