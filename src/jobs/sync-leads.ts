// Basic test to see if this file is being executed
console.log("=====================================");
console.log("STARTING SYNC-LEADS.TS EXECUTION");
console.log("TIMESTAMP:", new Date().toISOString());
console.log("=====================================");

// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config();
console.log("[DEBUG] Loaded .env file - SUPABASE_URL exists:", Boolean(process.env.SUPABASE_URL));

// Other imports
import * as sharpSpringService from '../services/sharpspring';
import * as slackService from '../services/slack';
import * as scoringService from '../services/scoring';
import { Lead, LeadUpsertData, SharpSpringLead, SlackAlertCreateData } from '../types';

// Import directly from Supabase for this job
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LEAD_SCORE_THRESHOLD = parseInt(process.env.LEAD_SCORE_THRESHOLD || '85', 10);

export async function syncLeads() {
    console.log("[DEBUG] ============================================");
    console.log("[DEBUG] Starting SharpSpring lead sync...");
    console.log("[DEBUG] ============================================");
    
    // Initialize Supabase directly in this function
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error("[DEBUG] Failed to initialize Supabase: Missing credentials");
        return;
    }
    
    console.log("[DEBUG] Initializing Supabase with URL:", SUPABASE_URL);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: false,
            detectSessionInUrl: false
        }
    });
    
    // Test connection
    try {
        const { data, error } = await supabase.from('leads').select('*').limit(1);
        if (error) {
            console.error("[DEBUG] Failed to query Supabase:", error);
            return;
        }
        console.log("[DEBUG] Successfully connected to Supabase");
    } catch (error) {
        console.error("[DEBUG] Error testing Supabase connection:", error);
        return;
    }
    
    let processedCount = 0;
    let errorCount = 0;
    let newLeadsCount = 0;
    let updatedLeadsCount = 0;
    let alertedLeadsCount = 0;

    try {
        // 1. Fetch leads from SharpSpring (implement pagination if needed)
        console.log("[DEBUG] About to fetch leads from SharpSpring with limit 10...");
        // Start with just 10 leads for testing
        const sharpSpringLeads = await sharpSpringService.getLeads({ limit: 10 });
        console.log("[DEBUG] SharpSpring getLeads call completed");

        if (!sharpSpringLeads || sharpSpringLeads.length === 0) {
            console.log("[DEBUG] No leads found in SharpSpring to sync.");
            return;
        }

        console.log(`[DEBUG] Fetched ${sharpSpringLeads.length} leads from SharpSpring.`);
        console.log("[DEBUG] Starting lead processing loop...");

        for (const ssLead of sharpSpringLeads) {
            // Ensure ssLead and ssLead.id exist before processing
            if (!ssLead || typeof ssLead.id === 'undefined' || ssLead.id === null) {
                console.warn('Skipping lead due to missing ID:', ssLead);
                errorCount++;
                continue;
            }
            const sharpSpringIdString = String(ssLead.id);

            try {
                // 2. Map SharpSpring data to our Lead structure
                const leadData: LeadUpsertData = mapSharpSpringToLead(ssLead);

                // 3. Calculate Lead Score (using the correct field name)
                const score = scoringService.calculateInitialScore(ssLead);
                leadData.score = score; // Use 'score' instead of 'lead_score'

                // 4. Check if lead exists in Supabase using the string ID
                const { data: existingLead, error: findError } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('sharpspring_id', sharpSpringIdString)
                    .single();
                
                if (findError && findError.code !== 'PGRST116') { // PGRST116 = Not found
                    console.error(`Error finding lead with SharpSpring ID: ${sharpSpringIdString}`, findError);
                    errorCount++;
                    continue;
                }

                let savedLead: Lead | null = null;
                let scoreChangedSignificantly = false;
                let originalScore = 0;

                if (existingLead) {
                    // Update existing lead
                    updatedLeadsCount++;
                    originalScore = existingLead.score; // Use 'score'

                    // Construct update payload carefully, merging new data but keeping existing IDs
                    const updatePayload: Partial<LeadUpsertData> & { updated_at?: string } = {
                        ...leadData,
                        sharpspring_id: sharpSpringIdString, // Ensure it remains a string
                        // Only update email/name/phone etc. if the new value is not null/undefined
                        // to avoid overwriting existing data with nulls from incomplete SharpSpring records
                        name: leadData.name ?? existingLead.name,
                        email: leadData.email ?? existingLead.email,
                        phone: leadData.phone ?? existingLead.phone,
                        tags: leadData.tags ?? existingLead.tags,
                        last_contacted: leadData.last_contacted ?? existingLead.last_contacted,
                        score: score, // Update the score
                        updated_at: new Date().toISOString(), // Manually set updated_at
                    };

                    const { data: updatedLead, error: updateError } = await supabase
                        .from('leads')
                        .update(updatePayload)
                        .eq('id', existingLead.id)
                        .select()
                        .single();
                    
                    if (updateError) {
                        console.error(`Failed to update lead with SharpSpring ID: ${sharpSpringIdString}`, updateError);
                        errorCount++;
                        continue;
                    }
                    
                    savedLead = updatedLead;
                    if (savedLead) {
                        console.log(`Updated lead: ${savedLead.email} (SharpSpring ID: ${sharpSpringIdString}), New Score: ${score}`);
                        scoreChangedSignificantly = Math.abs(score - originalScore) > 5; // Example threshold
                    }
                } else {
                    // Create new lead
                    newLeadsCount++;
                    // Ensure sharpspring_id is a string for creation
                    const createPayload = {
                        ...leadData,
                        sharpspring_id: sharpSpringIdString,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    
                    const { data: newLead, error: createError } = await supabase
                        .from('leads')
                        .insert([createPayload])
                        .select()
                        .single();
                    
                    if (createError) {
                        console.error(`Failed to create lead with SharpSpring ID: ${sharpSpringIdString}`, createError);
                        errorCount++;
                        continue;
                    }
                    
                    savedLead = newLead;
                    if (savedLead) {
                        console.log(`Created new lead: ${savedLead.email} (SharpSpring ID: ${sharpSpringIdString}), Score: ${score}`);
                        originalScore = 0; // For threshold check below
                        
                        // IMPORTANT: Always send Slack notification for ALL new leads regardless of score
                        // This ensures that the sales team is aware of all incoming leads promptly
                        console.log(`Sending Slack notification for new lead: ${savedLead.email}`);
                        const messageTs = await slackService.sendNewLeadNotification(savedLead, score);
                        if (messageTs) {
                            // Log the notification to slack_alerts table
                            const alertData: SlackAlertCreateData = {
                                lead_id: savedLead.id,
                                slack_message_ts: messageTs,
                                score_at_send: score,
                            };
                            
                            await supabase
                                .from('slack_alerts')
                                .insert([{
                                    ...alertData,
                                    // alert_sent_at has a default value
                                }]);
                            
                            // Increment the alerted count for new leads
                            alertedLeadsCount++;
                        }
                    }
                }

                // 5. Check threshold and send Slack alert for high-scoring leads
                const crossedThreshold = savedLead && score >= LEAD_SCORE_THRESHOLD && originalScore < LEAD_SCORE_THRESHOLD;
                if (savedLead && crossedThreshold) {
                    alertedLeadsCount++;
                    console.log(`Lead ${savedLead.email} crossed threshold (${score}). Sending high-score alert.`);
                    // Send alert and potentially log it
                    const messageTs = await slackService.sendHighScoreAlert(savedLead, score);
                    if (messageTs) {
                        // Log the alert to slack_alerts table
                        const alertData: SlackAlertCreateData = {
                            lead_id: savedLead.id,
                            slack_message_ts: messageTs,
                            score_at_send: score,
                        };
                        
                        await supabase
                            .from('slack_alerts')
                            .insert([{
                                ...alertData,
                                // alert_sent_at has a default value
                            }]);
                    }
                }

                processedCount++;
            } catch (leadError) {
                errorCount++;
                console.error(`Error processing lead ID ${sharpSpringIdString}:`, leadError);
                // Continue processing other leads
            }
        }

    } catch (error) {
        console.error("[DEBUG] ❌ Critical error during lead sync:", error);
        if (error instanceof Error) {
            console.error("[DEBUG] Error message:", error.message);
            console.error("[DEBUG] Error stack:", error.stack);
        }
        // Potentially send an admin alert here
    } finally {
        console.log("[DEBUG] Lead sync finished.");
        console.log(`[DEBUG] Summary: Processed=${processedCount}, New=${newLeadsCount}, Updated=${updatedLeadsCount}, Alerted=${alertedLeadsCount}, Errors=${errorCount}`);
        console.log("[DEBUG] ============================================");
    }
}

// Helper function to map SharpSpring lead object to our internal Lead type
function mapSharpSpringToLead(ssLead: SharpSpringLead): LeadUpsertData {
    // Combine first/last name if they exist
    const name = [ssLead.firstName, ssLead.lastName].filter(Boolean).join(' ') || null;

    // Convert SharpSpring ID to string (although it already appears to be a string from the API)
    const sharpSpringIdString = String(ssLead.id);
    
    // Parse boolean values (SharpSpring seems to return '0'/'1' strings)
    const isCustomer = ssLead.isCustomer === '1' ? true : false;
    const isQualified = ssLead.isQualified === '1' ? true : false;
    
    // Parse scores (SharpSpring returns numbers as strings)
    const ssLeadScore = ssLead.leadScore ? parseInt(ssLead.leadScore, 10) : null;
    
    // Extract phone from best available field
    const phone = ssLead.mobilePhoneNumber || ssLead.phoneNumber || ssLead.officePhoneNumber || null;
    
    // Map time frame from custom field
    const timeFrame = ssLead.time_frame_5eceb4e7d9474 || null;
    
    // Map lead source
    const initialLeadSource = ssLead.initial_lead_source_5ecff3dcb9ec7 || null;

    return {
        sharpspring_id: sharpSpringIdString,
        name: name,
        email: ssLead.emailAddress || null,
        phone: phone,
        score: 0, // Initial score, calculated later
        tags: null, // SharpSpring doesn't seem to expose tags directly in this API response
        last_contacted: null, // Will require separate API call or tracking
        
        // Additional mapped fields
        company_name: ssLead.companyName || null,
        title: ssLead.title || null,
        website: ssLead.website || null,
        lead_status: ssLead.leadStatus || null,
        is_customer: isCustomer,
        is_qualified: isQualified,
        
        // Time fields
        ss_create_timestamp: ssLead.createTimestamp || null,
        ss_update_timestamp: ssLead.updateTimestamp || null,
        
        // Lead source tracking
        lead_source: null, // Need to identify the correct field for this
        initial_lead_source: initialLeadSource,
        
        // Time frame
        time_frame: timeFrame,
        
        // Location info
        city: ssLead.city || null,
        state: ssLead.state || null,
        zipcode: ssLead.zipcode || null,
        
        // SharpSpring's own score
        ss_lead_score: ssLeadScore
    };
}

// Run the function immediately when this file is executed directly
syncLeads().catch(error => console.error("[DEBUG] Unhandled error in syncLeads:", error)); 