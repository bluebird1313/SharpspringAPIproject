-- Drop tables if they exist (CAREFUL with this in production!)
DROP TABLE IF EXISTS slack_alerts;
DROP TABLE IF EXISTS interactions;
DROP TABLE IF EXISTS leads;

-- Create the leads table with additional fields based on SharpSpring API response
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sharpspring_id TEXT UNIQUE,
    name TEXT,
    email TEXT,
    phone TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    tags TEXT[],
    last_contacted TIMESTAMPTZ,
    
    -- Additional fields from SharpSpring that may be useful
    company_name TEXT,
    title TEXT,
    website TEXT,
    lead_status TEXT,
    is_customer BOOLEAN DEFAULT FALSE,
    is_qualified BOOLEAN DEFAULT FALSE,
    
    -- Time fields
    ss_create_timestamp TIMESTAMPTZ,
    ss_update_timestamp TIMESTAMPTZ,
    
    -- Lead source tracking
    lead_source TEXT,
    initial_lead_source TEXT,
    
    -- Time frame/purchase intent
    time_frame TEXT,
    
    -- Location information if available
    city TEXT,
    state TEXT,
    zipcode TEXT,
    
    -- Other fields that might be useful based on your data
    ss_lead_score INTEGER, -- SharpSpring's own score
    
    -- System fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on email for faster lookup
CREATE INDEX idx_leads_email ON leads(email);
-- Create index on sharpspring_id for faster sync lookup
CREATE INDEX idx_leads_sharpspring_id ON leads(sharpspring_id);
-- Create index on lead status for filtering
CREATE INDEX idx_leads_status ON leads(lead_status);
-- Create index on score for threshold filtering
CREATE INDEX idx_leads_score ON leads(score);

-- Create the interactions table
CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on lead_id for faster lookup of all interactions for a lead
CREATE INDEX idx_interactions_lead_id ON interactions(lead_id);

-- Create the slack_alerts table
CREATE TABLE slack_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    alert_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    slack_message_ts TEXT,
    score_at_send INTEGER NOT NULL
);

-- Create index on lead_id for faster lookup of all alerts for a lead
CREATE INDEX idx_slack_alerts_lead_id ON slack_alerts(lead_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at column on leads table
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- You can add more custom fields as needed in the future with:
-- ALTER TABLE leads ADD COLUMN custom_field_name TEXT;

-- Optionally, add Row Level Security (RLS) policies if needed
-- For example:
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public leads are viewable by everyone" ON leads FOR SELECT USING (true);
-- CREATE POLICY "Leads can be inserted by authenticated users" ON leads FOR INSERT WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE leads IS 'Stores lead information synced from SharpSpring';
COMMENT ON TABLE interactions IS 'Stores interactions with leads';
COMMENT ON TABLE slack_alerts IS 'Records of alerts sent to Slack for high-scoring leads';

-- Add comments to explain important columns
COMMENT ON COLUMN leads.sharpspring_id IS 'The unique ID from SharpSpring (stored as TEXT)';
COMMENT ON COLUMN leads.score IS 'Our calculated score for this lead';
COMMENT ON COLUMN leads.ss_lead_score IS 'SharpSpring''s native lead score';
COMMENT ON COLUMN leads.lead_status IS 'Status value from SharpSpring';
COMMENT ON COLUMN leads.time_frame IS 'Timeframe for purchase (e.g., "Within 1 month")';
COMMENT ON COLUMN interactions.type IS 'Type of interaction (e.g., "Call", "Email", "Meeting")';
COMMENT ON COLUMN interactions.summary IS 'AI-generated summary of the interaction content'; 