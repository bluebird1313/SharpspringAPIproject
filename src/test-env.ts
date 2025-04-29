// Test script to check environment variables loading
import * as dotenv from 'dotenv';
import * as path from 'path';

// Try to find the .env file
const envPath = path.resolve(process.cwd(), '.env');
console.log('Looking for .env file at:', envPath);

// Load environment variables
dotenv.config();

// Check if critical environment variables are loaded
console.log('\nEnvironment variables loaded:');
console.log('SHARPSPRING_ACCOUNT_ID:', process.env.SHARPSPRING_ACCOUNT_ID ? 'Exists ✅' : 'Missing ❌');
console.log('SHARPSPRING_SECRET_KEY:', process.env.SHARPSPRING_SECRET_KEY ? 'Exists ✅' : 'Missing ❌');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Exists ✅' : 'Missing ❌');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Exists ✅' : 'Missing ❌');
console.log('SLACK_WEBHOOK_URL:', process.env.SLACK_WEBHOOK_URL ? 'Exists ✅' : 'Missing ❌');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Exists ✅' : 'Missing ❌');

// Show actual values for debugging (be careful with secrets)
if (process.env.SUPABASE_URL) {
  console.log('\nSUPABASE_URL value:', process.env.SUPABASE_URL);
}

// Check file system access to the .env file
import * as fs from 'fs';
try {
  const envFileExists = fs.existsSync(envPath);
  console.log('\n.env file exists:', envFileExists);
  
  if (envFileExists) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lineCount = envContent.split('\n').length;
    console.log(`.env file has ${lineCount} lines`);
    console.log('First 5 characters:', envContent.substring(0, 5));
  }
} catch (error) {
  console.error('Error checking .env file:', error);
} 