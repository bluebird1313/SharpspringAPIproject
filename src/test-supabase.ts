// Test script to verify Supabase connection
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
console.log('Loading environment variables...');
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL:', SUPABASE_URL ? 'Found' : 'Missing');
console.log('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'Found' : 'Missing');

async function testSupabaseConnection() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('❌ Error: Supabase URL or Service Key is missing.');
        return;
    }

    console.log('Creating Supabase client...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: false,
            detectSessionInUrl: false
        }
    });

    try {
        console.log('Testing connection by querying tables...');
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .limit(1);

        if (error) {
            console.error('❌ Error querying Supabase:', error);
            return;
        }

        console.log('✅ Successfully connected to Supabase!');
        console.log('Query result:', data);

        // Try to insert a test lead
        console.log('\nAttempting to insert a test lead...');
        const testLead = {
            sharpspring_id: 'test-' + Date.now(),
            name: 'Test Lead',
            email: 'test@example.com',
            score: 50,
            created_at: new Date(),
            updated_at: new Date()
        };

        const { data: insertData, error: insertError } = await supabase
            .from('leads')
            .insert([testLead])
            .select();

        if (insertError) {
            console.error('❌ Error inserting test lead:', insertError);
            return;
        }

        console.log('✅ Successfully inserted test lead!');
        console.log('Inserted lead:', insertData);

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the test
testSupabaseConnection()
    .catch(err => console.error('Unhandled error:', err))
    .finally(() => console.log('Test completed.')); 