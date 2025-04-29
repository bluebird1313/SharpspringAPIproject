// Placeholder for SharpSpring API interaction logic
import axios from 'axios';
import { SharpSpringLead } from '../types';

const ACCOUNT_ID = process.env.SHARPSPRING_ACCOUNT_ID;
const SECRET_KEY = process.env.SHARPSPRING_SECRET_KEY;
// Use v1.2 for UTC timezone handling as recommended
const BASE_URL = 'https://api.sharpspring.com/pubapi/v1.2/';

// --- Helper Function for API Calls ---
async function makeSharpSpringRequest(method: string, params: any): Promise<any> {
    console.log(`[DEBUG] Starting SharpSpring API request for method: ${method}`);
    
    if (!ACCOUNT_ID || !SECRET_KEY) {
        console.error('[DEBUG] SharpSpring API credentials missing!');
        throw new Error('SharpSpring API credentials are not configured in environment variables.');
    }

    console.log(`[DEBUG] Using Account ID: ${ACCOUNT_ID.substring(0, 5)}... and Secret Key: ${SECRET_KEY.substring(0, 5)}...`);
    
    const requestID = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`; // Add randomness for better correlation
    const url = `${BASE_URL}?accountID=${ACCOUNT_ID}&secretKey=${SECRET_KEY}`;

    const requestBody = {
        method: method,
        params: params,
        id: requestID,
    };

    console.log(`[DEBUG] SharpSpring Request (${requestID}): Method=${method}, URL=${BASE_URL}, Params=${JSON.stringify(params)}`);

    try {
        console.log(`[DEBUG] Sending API request to SharpSpring...`);
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log(`[DEBUG] SharpSpring Response received (${requestID}): Status=${response.status}`);
        
        // Log the raw response data (be careful with sensitive data)
        console.log(`[DEBUG] Response data structure:`, typeof response.data, 
                   response.data ? Object.keys(response.data) : 'No response data');

        // Check for API-Level Errors first
        if (response.data.error) {
            console.error(`[DEBUG] SharpSpring API Error (${requestID}) for method ${method}:`, JSON.stringify(response.data.error));
            throw new Error(`SharpSpring API Error: ${response.data.error.message} (Code: ${response.data.error.code})`);
        }

        // Return the result part for further processing (including object-level errors)
        return response.data.result;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`[DEBUG] Axios error calling SharpSpring method ${method} (${requestID}):`, 
                         error.message, 
                         error.response?.status, 
                         error.response?.data);
            // Provide more context if possible
            const message = error.response?.data?.error?.message || error.message;
            throw new Error(`HTTP error calling SharpSpring API: ${message}`);
        } else {
            console.error(`[DEBUG] Generic error calling SharpSpring method ${method} (${requestID}):`, error);
            throw error; // Re-throw other errors
        }
    }
}

// --- API Methods ---
// Note: SharpSpring API has limits (e.g., 10 req/sec, 500 objects/request). Implement rate limiting/batching if needed.

/**
 * Fetches leads from SharpSpring.
 * @param options - Options like limit, offset, or filter criteria (e.g., { where: { updateTimestamp: { GT: 'YYYY-MM-DD HH:MM:SS' } } })
 *                  Ensure limit is <= 500 as per API limits.
 */
export async function getLeads(options: { limit?: number; offset?: number; where?: any }): Promise<SharpSpringLead[]> {
    console.log('[DEBUG] Starting getLeads call with options:', options);
    
    // Ensure limit doesn't exceed API maximum
    if (options.limit && options.limit > 500) {
        console.warn('[DEBUG] getLeads limit reduced to 500 (SharpSpring API maximum).');
        options.limit = 500;
    }
    
    // Ensure the where parameter is always present - SharpSpring requires it
    if (!options.where) {
        options.where = {}; // Empty object for no filtering
    }

    try {
        console.log('[DEBUG] Calling makeSharpSpringRequest for getLeads...');
        const result = await makeSharpSpringRequest('getLeads', options);
        console.log('[DEBUG] makeSharpSpringRequest completed for getLeads');

        // *** Log the raw result for inspection ***
        console.log('[DEBUG] Raw SharpSpring getLeads result structure:', typeof result);
        console.log('[DEBUG] Result keys:', result ? Object.keys(result) : 'No result object');
        console.log('[DEBUG] Full raw result:', JSON.stringify(result, null, 2));
        // ******************************************

        // *** IMPORTANT: Verify the actual structure of the response for getLeads. ***
        // The documentation example is generic. It might be result.leads, result.lead, etc.
        console.log('[DEBUG] Checking for leads array in result.lead');
        const leads = result?.lead; // Adjust this key based on actual response inspection!

        if (!leads) {
            console.warn('[DEBUG] No leads array found at result.lead!');
            if (result?.leads) {
                console.log('[DEBUG] Found leads at result.leads instead');
                return result.leads as SharpSpringLead[];
            }
        }

        if (!leads || !Array.isArray(leads)) {
            console.warn('[DEBUG] SharpSpring getLeads response did not contain an array at result.lead (or expected key):', result);
            return [];
        }
        
        console.log(`[DEBUG] Successfully fetched ${leads.length} leads.`);
        
        // Log first lead as a sample (if available)
        if (leads.length > 0) {
            console.log('[DEBUG] First lead sample:', JSON.stringify(leads[0], null, 2));
        }
        
        return leads as SharpSpringLead[];
    } catch (error) {
        console.error('[DEBUG] Error in getLeads:', error);
        // Re-throw to caller
        throw error;
    }
}

/**
 * Updates leads in SharpSpring. Handles only one lead currently but uses the batch method.
 * @param leadId - The SharpSpring lead ID.
 * @param score - The new lead score.
 * @param notes - Notes to add separately via createNote.
 */
export async function updateLead(leadId: number, score: number, notes?: string): Promise<boolean> {
    console.log(`Attempting to update SharpSpring lead ID: ${leadId} with score: ${score}`);

    // *** IMPORTANT: Verify the field name for your calculated score in SharpSpring. ***
    // This assumes a field with the API name 'leadScore'. It might be a custom field like 'customFieldID_XXXXX'.
    const scoreFieldName = 'leadScore'; // <-- CHANGE THIS if using a custom field

    const updates: any = {
        id: leadId,
        [scoreFieldName]: score,
    };

    const updateParams = {
        objects: [updates],
    };

    let updateSuccessful = false;
    try {
        const result = await makeSharpSpringRequest('updateLeads', updateParams);

        // Check for Object-Level Errors within the result
        if (result?.updates && Array.isArray(result.updates) && result.updates.length > 0) {
            const updateResult = result.updates[0];
            if (updateResult.success === 'false' || updateResult.success === false) {
                console.error(`SharpSpring object-level error updating lead ${leadId}:`, JSON.stringify(updateResult.error));
                // Return false, but don't throw an error unless critical
            } else {
                console.log(`Successfully updated score for SharpSpring lead ID: ${leadId}`);
                updateSuccessful = true;
            }
        } else {
            // This case might indicate an unexpected success response format
            console.warn(`SharpSpring updateLeads response format unexpected for lead ${leadId}. Assuming success, but verify. Result:`, result);
            updateSuccessful = true; // Optimistically assume success if no error reported
        }
    } catch (error) {
        console.error(`Failed to execute updateLeads request for lead ${leadId}:`, error);
        // Error already logged in makeSharpSpringRequest, just return false
        return false;
    }

    // Add notes using createNote if notes are provided (runs even if score update failed, which might be desired)
    if (notes) {
        try {
            await createNote(leadId, notes);
        } catch (noteError) {
            // Error is logged within createNote, just note the failure here.
            console.warn(`Failed to add note to SharpSpring lead ID: ${leadId}, but score update may have succeeded.`);
        }
    }

    return updateSuccessful;
}

/**
 * Creates a note for a specific lead in SharpSpring.
 * @param leadId - The SharpSpring lead ID.
 * @param noteContent - The content of the note.
 */
export async function createNote(leadId: number, noteContent: string): Promise<boolean> {
    console.log(`Creating note for SharpSpring lead ID: ${leadId}`);
    const params = {
        objects: [
            {
                leadID: leadId, // Ensure this field name `leadID` is correct
                note: noteContent,
            },
        ],
    };

    try {
        const result = await makeSharpSpringRequest('createNotes', params);

        // Check for Object-Level Errors within the result
        if (result?.creates && Array.isArray(result.creates) && result.creates.length > 0) {
            const createResult = result.creates[0];
            if (createResult.success === 'false' || createResult.success === false) {
                console.error(`SharpSpring object-level error creating note for lead ${leadId}:`, JSON.stringify(createResult.error));
                return false;
            } else {
                console.log(`Successfully created note for lead ID ${leadId}.`);
                return true;
            }
        } else {
            // This case might indicate an unexpected success response format
            console.warn(`SharpSpring createNotes response format unexpected for lead ${leadId}. Assuming success, but verify. Result:`, result);
            return true; // Optimistically assume success if no error reported
        }
    } catch (error) {
        console.error(`Failed to execute createNotes request for lead ${leadId}:`, error);
        // Error already logged in makeSharpSpringRequest
        return false;
    }
}

// TODO: Add other necessary SharpSpring API functions as needed (e.g., getLead details if sync needs more info).

// Add other necessary SharpSpring API functions here (e.g., getLead, getCampaigns, getTags etc.) 