import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Lead, SharpSpringLead } from './types';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Webhook endpoint for SharpSpring lead updates
app.post('/webhook/sharpspring/leads', async (req, res) => {
  try {
    const { body } = req;
    console.log('Received webhook payload:', JSON.stringify(body, null, 2));

    // Validate webhook payload
    if (!body || !Array.isArray(body.leads)) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const processedLeads: Lead[] = body.leads.map((lead: any) => ({
      sharpspring_id: lead.id?.toString() || '',
      name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
      email: lead.emailAddress || '',
      phone: lead.phoneNumber || '',
      score: 0, // Initialize with default score
      tags: [],
      last_contacted: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Process each lead
    for (const lead of processedLeads) {
      const { data: existingLead, error: fetchError } = await supabase
        .from('leads')
        .select()
        .eq('sharpspring_id', lead.sharpspring_id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching lead:', fetchError);
        continue;
      }

      if (existingLead) {
        // Update existing lead
        const { error: updateError } = await supabase
          .from('leads')
          .update(lead)
          .eq('sharpspring_id', lead.sharpspring_id);

        if (updateError) {
          console.error('Error updating lead:', updateError);
        }
      } else {
        // Insert new lead
        const { error: insertError } = await supabase
          .from('leads')
          .insert([lead]);

        if (insertError) {
          console.error('Error inserting lead:', insertError);
        }
      }
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 