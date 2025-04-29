import { LeadUpsertData, SharpSpringLead } from '../types';

/**
 * Map a SharpSpring lead object to our internal Lead type format
 * Extracted from sync-leads.ts into a reusable utility
 */
export function mapSharpSpringToLead(ssLead: SharpSpringLead): LeadUpsertData {
  // Combine first/last name if they exist
  const name = [ssLead.firstName, ssLead.lastName].filter(Boolean).join(' ') || null;

  // Convert SharpSpring ID to string
  const sharpSpringIdString = String(ssLead.id);
  
  // Parse boolean values (SharpSpring returns '0'/'1' strings)
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
    tags: null, // SharpSpring doesn't seem to expose tags directly in API response
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