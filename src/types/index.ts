// --- Supabase Table Types ---

// Mirroring the 'leads' table
export interface Lead {
    id: string; // UUID (Primary Key)
    sharpspring_id: string | null; // TEXT (Unique)
    name: string | null; // TEXT
    email: string | null; // TEXT (Potentially Unique)
    phone: string | null; // TEXT
    score: number; // INT (Default 0, Not Null)
    tags: string[] | null; // TEXT[]
    last_contacted: string | null; // TIMESTAMPTZ
    
    // Additional fields from SharpSpring
    company_name: string | null; // TEXT
    title: string | null; // TEXT
    website: string | null; // TEXT
    lead_status: string | null; // TEXT
    is_customer: boolean | null; // BOOLEAN
    is_qualified: boolean | null; // BOOLEAN
    
    // Time fields
    ss_create_timestamp: string | null; // TIMESTAMPTZ
    ss_update_timestamp: string | null; // TIMESTAMPTZ
    
    // Lead source tracking
    lead_source: string | null; // TEXT
    initial_lead_source: string | null; // TEXT
    
    // Time frame/purchase intent
    time_frame: string | null; // TEXT
    
    // Location info
    city: string | null; // TEXT
    state: string | null; // TEXT
    zipcode: string | null; // TEXT
    
    // SharpSpring's own score
    ss_lead_score: number | null; // INT
    
    updated_at: string; // TIMESTAMPTZ (Not Null, Default now(), Auto-updates)
    created_at: string; // TIMESTAMPTZ (Not Null, Default now())
}

// Data needed to create/update a lead (excluding auto-generated/managed fields)
// Note: 'updated_at' is handled by the trigger or backend logic
export type LeadUpsertData = Omit<Lead, 'id' | 'updated_at' | 'created_at'>;

// Mirroring the 'interactions' table
export interface Interaction {
    id: string; // UUID (Primary Key)
    lead_id: string; // UUID (Foreign Key to leads.id)
    type: string; // TEXT (Not Null)
    content: string | null; // TEXT
    summary: string | null; // TEXT (AI Summary)
    created_at: string; // TIMESTAMPTZ (Not Null, Default now())
}

// Data needed to create an interaction
export type InteractionCreateData = Omit<Interaction, 'id' | 'created_at'>;

// Mirroring the 'slack_alerts' table
export interface SlackAlert {
    id: string; // UUID (Primary Key)
    lead_id: string; // UUID (Foreign Key to leads.id)
    alert_sent_at: string; // TIMESTAMPTZ (Not Null, Default now())
    slack_message_ts: string | null; // TEXT (Slack's message timestamp)
    score_at_send: number; // INT (Not Null)
}

// Data needed to create a slack alert record
export type SlackAlertCreateData = Omit<SlackAlert, 'id' | 'alert_sent_at'>;

// --- SharpSpring Related Types (Based on actual API response) ---

// Type for SharpSpring lead object structure based on the API response
export interface SharpSpringLead {
    id: string; // SharpSpring ID (appears to be a string in API response)
    accountID: string | null;
    ownerID: string | null;
    companyName: string | null;
    title: string | null;
    firstName: string | null;
    lastName: string | null;
    street: string | null;
    city: string | null;
    country: string | null;
    state: string | null;
    zipcode: string | null;
    emailAddress: string | null;
    website: string | null;
    phoneNumber: string | null;
    officePhoneNumber: string | null;
    phoneNumberExtension: string | null;
    mobilePhoneNumber: string | null;
    faxNumber: string | null;
    description: string | null;
    campaignID: string | null;
    trackingID: string | null;
    industry: string | null;
    active: string | null;
    isQualified: string | null;
    isContact: string | null;
    isCustomer: string | null;
    status: string | null;
    updateTimestamp: string | null;
    createTimestamp: string | null;
    leadScoreWeighted: string | null;
    leadScore: string | null;
    isUnsubscribed: string | null;
    leadStatus: string | null;
    
    // Time frame data (custom field from our example)
    time_frame_5eceb4e7d9474?: string | null;
    initial_lead_source_5ecff3dcb9ec7?: string | null;
    
    // Additional fields can be added as needed based on custom fields in your SharpSpring account
    // Note that custom fields appear to have a numerical suffix in the API response
    [key: string]: any; // Allow any additional custom fields
} 