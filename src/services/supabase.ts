// Placeholder for Supabase client and database interactions
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Lead, LeadUpsertData, Interaction, InteractionCreateData, SlackAlertCreateData, SlackAlert } from '../types';

let supabase: SupabaseClient;

export function initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase URL or Service Role Key is missing from environment variables.');
    }

    if (!supabase) { // Initialize only once
        supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                // Automatically refreshes JSON Web Token
                autoRefreshToken: true,
                 // Persists session across restarts
                persistSession: false,
                // Detects session from URL, only works client-side
                detectSessionInUrl: false
            }
        });
        console.log('Supabase client initialized.');
    }
    return supabase;
}

// Ensure client is initialized before use
function getSupabaseClient(): SupabaseClient {
    if (!supabase) {
        throw new Error('Supabase client has not been initialized. Call initializeSupabase() first.');
    }
    return supabase;
}

// --- Lead Functions ---

export async function getLeadBySharpSpringId(sharpspringId: string): Promise<Lead | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
        .from('leads')
        .select('*')
        .eq('sharpspring_id', sharpspringId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = row not found
        console.error('Error fetching lead by SharpSpring ID:', error);
        throw error;
    }
    return data ? data as Lead : null;
}

export async function getLeadByEmail(email: string): Promise<Lead | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
        .from('leads')
        .select('*')
        .eq('email', email)
        .maybeSingle(); // Use maybeSingle to handle 0 or 1 results gracefully

    if (error) {
        console.error('Error fetching lead by email:', error);
        throw error;
    }
    return data ? data as Lead : null;
}

export async function createLead(leadData: LeadUpsertData): Promise<Lead | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
        .from('leads')
        .insert([{ ...leadData, created_at: new Date(), updated_at: new Date() }])
        .select()
        .single();

    if (error) {
        console.error('Error creating lead:', error);
        // Consider more specific error handling (e.g., unique constraint violation)
        throw error;
    }
    return data ? data as Lead : null;
}

export async function updateLead(id: string, leadData: Partial<LeadUpsertData> & { updated_at?: string }): Promise<Lead | null> {
    const client = getSupabaseClient();
    const updatePayload = {
        ...leadData,
        updated_at: leadData.updated_at || new Date().toISOString(), // Ensure updated_at is set
        // Supabase client might automatically update `updated_at` if you have a trigger, verify this
    };
    const { data, error } = await client
        .from('leads')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating lead:', error);
        throw error;
    }
    return data ? data as Lead : null;
}

export async function updateLeadScoreAndNotes(id: string, score: number, notes: string | null): Promise<Lead | null> {
     const client = getSupabaseClient();
     const updatePayload: Partial<Lead> = {
        score: score,
        updated_at: new Date().toISOString()
     };

    // In this design, notes are stored in interactions, not directly on the lead table.
    // If you needed to add notes directly to the lead (e.g., a summary field), update it here.
    // if (notes) {
    //     updatePayload.some_notes_field = notes;
    // }

    const { data, error } = await client
        .from('leads')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating lead score:', error);
        throw error;
    }
    return data ? data as Lead : null;
}

// --- Interaction Functions ---

export async function addInteraction(interactionData: InteractionCreateData): Promise<Interaction | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
        .from('interactions')
        .insert([{ ...interactionData, created_at: new Date() }])
        .select()
        .single();

    if (error) {
        console.error('Error adding interaction:', error);
        throw error;
    }
    return data ? data as Interaction : null;
}

// --- Outbound Message Logging --- 

// Replace previous logOutboundMessage with insertMessage from user provided code
export async function insertMessage(leadId: string, channel: string, direction: string, content: string): Promise<void> { // Return void as per user code
    if (!leadId || !channel || !direction || !content) {
        console.error('[Supabase] Missing parameters for insertMessage.');
        // Consider throwing an error or returning indication of failure
        return; 
    }
    const client = getSupabaseClient();
    const { error } = await client
        .from('messages') // Ensure this table name is correct
        .insert({ 
            lead_id: leadId, 
            channel, 
            direction, 
            content 
        });

    if (error) { 
        console.error(`[Supabase] Error inserting ${direction} ${channel} message for lead ${leadId}:`, error);
        throw error; // Throw error as per user code example
    }
    console.log(`[Supabase] Successfully inserted ${direction} ${channel} message for lead ${leadId}.`);
}

// --- Slack Alert Functions ---

export async function createSlackAlert(alertData: SlackAlertCreateData): Promise<SlackAlert | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
        .from('slack_alerts')
        .insert([{
            ...alertData,
            // 'alert_sent_at' has a default value in the DB
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating slack alert record:', error);
        // Don't throw here usually, as the alert was already sent
        return null;
    }
    console.log(`Successfully logged Slack alert for lead ${alertData.lead_id} (Msg Ts: ${alertData.slack_message_ts})`);
    return data ? data as SlackAlert : null;
}

// Add other necessary Supabase functions (e.g., get interactions for a lead) 