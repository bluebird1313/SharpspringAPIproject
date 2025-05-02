import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import * as slackService from '../services/slack';
import * as scoringService from '../services/scoring';
import * as openaiService from '../services/openai';
import * as twilioService from '../services/twilio';
import * as sendgridService from '../services/sendgrid';
import * as supabaseService from '../services/supabase';
import { LeadUpsertData, SharpSpringLead, SlackAlertCreateData, Lead } from '../types';
import { mapSharpSpringToLead } from '../utils/lead-mapper';
import { parseAIResponse } from '../utils/parser';
import { sendSMS } from '../services/sendSMS';
import { sendEmail } from '../services/sendEmail';

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
    
    // Add more detailed debugging
    console.log('Webhook payload structure:', JSON.stringify({
      hasLeadProperty: Boolean(payload?.lead),
      leadPropertyType: payload?.lead ? typeof payload.lead : 'undefined',
      leadProperties: payload?.lead ? Object.keys(payload.lead) : [],
      rawPayload: payload
    }));
    
    // Validate payload has the expected structure
    if (!payload || !payload.lead) {
      console.error('Invalid payload structure, missing lead data');
      return res.status(400).json({ error: 'Invalid payload structure' });
    }
    
    // Return a 200 response immediately to acknowledge receipt
    // SharpSpring expects a quick response to consider the webhook successful
    res.status(200).json({ status: 'success', message: 'Webhook received' });
    
    // Process the lead asynchronously (after sending response)
    processWebhookLead(payload.lead)
      .then(() => console.log('Webhook processing complete.'))
      .catch(error => {
        console.error('Unhandled error during async webhook processing:', error);
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
export async function processWebhookLead(ssLead: SharpSpringLead | any) {
  // If Zapier sends raw fields, adjust access: const leadId = ssLead.id; const email = ssLead.emailAddress etc.
  // For now, assume ssLead contains the lead fields directly or nested under 'lead'
  let leadForProcessing = ssLead.lead || ssLead; // Adjust based on actual Zapier payload logging
  
  // More comprehensive debugging of the incoming lead
  console.log('Raw webhook lead data type:', typeof ssLead);
  console.log('Raw webhook lead structure:', JSON.stringify({
    hasLeadProperty: Boolean(ssLead?.lead),
    topLevelFields: Object.keys(ssLead || {}),
    leadFieldsIfNested: ssLead?.lead ? Object.keys(ssLead.lead) : []
  }));
  
  // Handle possible alternative structures (e.g., if lead is nested differently)
  if (!leadForProcessing.id && !leadForProcessing.firstName && typeof leadForProcessing === 'object') {
    // Try to find the lead in a different property
    console.log('Lead object not in expected format. Attempting to find lead data in payload...');
    
    // Look for properties that might contain the lead
    for (const key of Object.keys(ssLead)) {
      const potentialLead = ssLead[key];
      if (potentialLead && typeof potentialLead === 'object' && 
         (potentialLead.id || potentialLead.firstName || potentialLead.emailAddress)) {
        console.log(`Found potential lead data in property: ${key}`);
        leadForProcessing = potentialLead;
        break;
      }
    }
  }
  
  // If we only have a name, create a basic lead structure with name components
  if (
    (typeof leadForProcessing === 'object' && Object.keys(leadForProcessing).length === 1 && leadForProcessing.name) ||
    (typeof leadForProcessing === 'string')
  ) {
    console.log('Only name found in webhook payload. Creating minimal lead structure.');
    const nameString = typeof leadForProcessing === 'string' ? leadForProcessing : leadForProcessing.name;
    const nameParts = nameString.split(' ');
    
    leadForProcessing = {
      id: `webhook-${Date.now()}`,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      emailAddress: null,
      phoneNumber: null,
      // Other fields will be null
    };
    
    console.log('Created minimal lead structure:', JSON.stringify(leadForProcessing));
  }
  
  const sharpSpringIdString = String(leadForProcessing.id || `webhook-${Date.now()}`);
  console.log('Processing webhook lead with SS ID:', sharpSpringIdString);
  
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
    const leadData: LeadUpsertData = mapSharpSpringToLead(leadForProcessing);
    
    // Calculate lead score
    const score = scoringService.calculateInitialScore(leadForProcessing);
    leadData.score = score;
    
    let savedLead: Lead | null = null;
    let isNewLead = false;
    
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
      savedLead = await supabaseService.updateLead(existingLead.id, updatePayload);
      isNewLead = false;
      
      // ALWAYS send alert for updated leads processed via webhook
      if (savedLead) { 
        console.log(`Webhook: Lead ${savedLead.email} updated (Score: ${score}). Sending alert.`);
        const messageTs = await slackService.sendHighScoreAlert(savedLead, score); // Using high score alert for updates
        
        // Log the alert in Supabase
        if (messageTs || process.env.SLACK_WEBHOOK_URL) {
          const alertData: SlackAlertCreateData = {
            lead_id: savedLead.id,
            slack_message_ts: messageTs || 'webhook_update_alert', // Changed description slightly
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
      savedLead = await supabaseService.createLead(createPayload);
      isNewLead = true;
      
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
    
    if (!savedLead) {
      console.error('Failed to save or retrieve lead from Supabase. Aborting follow-up.');
      return; // Exit if we couldn't get the saved lead
    }

    // --- AI Follow-up Logic (Using logic from main.ts) --- 
    console.log(`[FollowUp] Starting AI follow-up for lead ${savedLead.email}`);
    try {
      // Use existing openaiService function
      const aiResponse = await openaiService.generateFollowUpMessages(savedLead); 

      // *** ADD LOGGING HERE ***
      console.log("[FollowUp] Raw AI Response Text:\n", aiResponse);
      // *************************

      if (aiResponse) {
        // Use existing parser utility
        const { sms, subject, body } = parseAIResponse(aiResponse);
        console.log(`[Parser Debug] Extracted (revised line method) - SMS: ${!!sms}, Subject: ${!!subject}, Body: ${!!body}`);

        // Send SMS if phone number and message exist - TEMPORARILY DISABLED
        /*
        if (savedLead.phone && sms) {
          console.log(`[FollowUp] Attempting to send SMS to ${savedLead.phone}`);
          const smsSent = await sendSMS(savedLead.phone, sms); // Use imported function
          if (smsSent) {
            // Use imported function (ensure it matches needed params)
            await supabaseService.insertMessage(savedLead.id, 'sms', 'outbound', sms); 
          }
        } else {
          console.log(`[FollowUp] Skipping SMS for ${savedLead.email} (missing phone or SMS content).`);
        }
        */
        console.log("[FollowUp] SMS sending is temporarily disabled."); // Add log message

        // Send Email if email address and message exist
        if (savedLead.email && subject && body) {
          console.log(`[FollowUp] Attempting to send Email to ${savedLead.email}`);
          const emailSent = await sendEmail(savedLead.email, subject, body); // Use imported function
          if (emailSent) {
            const emailLogContent = `Subject: ${subject}\n\n${body}`;
            // Use imported function (ensure it matches needed params)
            await supabaseService.insertMessage(savedLead.id, 'email', 'outbound', emailLogContent); 
          }
        } else {
          console.log(`[FollowUp] Skipping Email for ${savedLead.email} (missing email, subject, or body).`);
        }

      } else {
        console.warn(`[FollowUp] No response from OpenAI for lead ${savedLead.email}`);
      }
    } catch (followUpError) {
      console.error(`[FollowUp] Error during AI follow-up for lead ${savedLead.email}:`, followUpError);
    }
    // --- END: AI Follow-up Logic --- 

    console.log(`Webhook lead processing completed for SharpSpring ID: ${sharpSpringIdString}`);
    
  } catch (error) {
    console.error('Error processing webhook lead:', error);
  }
}

// Remove the commented-out parseAIResponse helper from here, use utils/parser.ts

// --- Helper Function for Parsing AI Response --- 
// (Could be in utils/parser.ts)
/*
function parseAIResponse(responseText: string): { sms: string | null; subject: string | null; body: string | null } {
    const smsMatch = responseText.match(/SMS:(.*?)(?:Email Subject:|$)/is);
    const subjectMatch = responseText.match(/Email Subject:(.*?)(?:Email Body:|$)/is);
    const bodyMatch = responseText.match(/Email Body:(.*)/is);

    return {
        sms: smsMatch ? smsMatch[1].trim() : null,
        subject: subjectMatch ? subjectMatch[1].trim() : null,
        body: bodyMatch ? bodyMatch[1].trim() : null,
    };
}
*/ 