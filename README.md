## 📦 Project Structure
```plaintext
.
├── .env             # Local environment variables (ignored by git)
├── .env.example     # Example environment variables
├── .gitignore       # Git ignore rules
├── package.json     # Node.js dependencies and scripts
├── tsconfig.json    # TypeScript configuration
├── README.md        # This file
├── dist/            # Compiled JavaScript output (ignored by git)
├── src/
│   ├── index.ts     # Main entry point (runs cron + starts server)
│   ├── server.ts    # Express server for webhook
│   ├── jobs/
│   │   └── sync-leads.ts # Daily SharpSpring sync logic
│   ├── services/
│   │   ├── sharpspring.ts # SharpSpring API client
│   │   ├── supabase.ts   # Supabase DB client & functions
│   │   ├── slack.ts      # Slack webhook client
│   │   ├── openai.ts     # OpenAI API client
│   │   └── scoring.ts    # Lead scoring rules
│   └── types/
│       └── index.ts      # Core TypeScript types
├── node_modules/    # Project dependencies (ignored by git)
```

2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file by copying `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Fill in the required credentials and settings in your `.env` file:
   - **SharpSpring API Keys**: Found in SharpSpring settings.
   - **Supabase URL & Keys**: Found in your Supabase project settings. Use the `SERVICE_ROLE_KEY` for server-side operations.
   - **Slack Webhook URL**: Create an Incoming Webhook in your Slack app settings.
   - **OpenAI API Key**: Get from the OpenAI platform.

5. **Set up Supabase Database:**
   - Go to your Supabase project's SQL Editor.
   - Run the following SQL to create the necessary tables:
     ```sql
     -- Ensure the uuid-ossp extension is enabled for uuid_generate_v4()
     CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

     -- 1. Leads Table
     CREATE TABLE leads (
         id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
         sharpspring_id TEXT UNIQUE, -- Using TEXT as requested, consider UNIQUE constraint
         name TEXT,
         email TEXT,                 -- Consider UNIQUE constraint if emails must be unique
         phone TEXT,
         score INT DEFAULT 0 NOT NULL,
         tags TEXT[],                -- Array of text for tags
         last_contacted TIMESTAMPTZ, -- Timestamp with time zone
         updated_at TIMESTAMPTZ DEFAULT now() NOT NULL -- Automatically set on creation/update (see trigger below)
     );

     -- Add indexes for faster lookups
     CREATE INDEX idx_leads_sharpspring_id ON leads(sharpspring_id);
     CREATE INDEX idx_leads_email ON leads(email);

     -- Optional: Automatically update `updated_at` timestamp on row changes
     CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;

     CREATE TRIGGER set_leads_timestamp
     BEFORE UPDATE ON public.leads
     FOR EACH ROW
     EXECUTE FUNCTION public.trigger_set_timestamp();


     -- 2. Interactions Table
     CREATE TABLE interactions (
         id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
         lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE, -- Foreign key with cascade delete
         type TEXT NOT NULL,         -- e.g., "call", "sms", "note", "email"
         content TEXT,               -- Raw content/notes from the interaction
         summary TEXT,               -- Optional AI-generated summary
         created_at TIMESTAMPTZ DEFAULT now() NOT NULL
     );

     -- Add index for retrieving interactions for a specific lead
     CREATE INDEX idx_interactions_lead_id ON interactions(lead_id);


     -- 3. Slack Alerts Table
     CREATE TABLE slack_alerts (
         id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
         lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE, -- Foreign key with cascade delete
         alert_sent_at TIMESTAMPTZ DEFAULT now() NOT NULL,
         slack_message_ts TEXT,      -- Slack's message timestamp (for potential updates/threading)
         score_at_send INT NOT NULL  -- Store the score that triggered the alert
     );

     -- Add index for retrieving alerts for a specific lead
     CREATE INDEX idx_slack_alerts_lead_id ON slack_alerts(lead_id);


     -- --- Row Level Security (RLS) ---
     -- Enable RLS for all tables
     ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
     ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
     ALTER TABLE public.slack_alerts ENABLE ROW LEVEL SECURITY;

     -- Create basic policies allowing full access for the service_role (used by backend)
     -- WARNING: These policies grant full access. Review and restrict if non-service roles need access.
     CREATE POLICY "Allow service_role full access on leads"
         ON public.leads FOR ALL
         USING (true)
         WITH CHECK (true);

     CREATE POLICY "Allow service_role full access on interactions"
         ON public.interactions FOR ALL
         USING (true)
         WITH CHECK (true);

     CREATE POLICY "Allow service_role full access on slack_alerts"
         ON public.slack_alerts FOR ALL
         USING (true)
         WITH CHECK (true);

     -- Example: Allow authenticated users to read their own leads (if needed later)
     -- CREATE POLICY "Allow authenticated users to read their assigned leads"
     --     ON public.leads FOR SELECT
     --     USING (auth.role() = 'authenticated' AND owner_user_id = auth.uid()); -- Requires an 'owner_user_id' column
     ```

6. **Compile TypeScript:**
   ```