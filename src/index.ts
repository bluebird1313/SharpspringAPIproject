import app from './server'; // Import the configured app from server.ts
import * as dotenv from 'dotenv';
import { initializeSupabase } from './services/supabase'; // Import initializer
import { initializeOpenAI } from './services/openai';   // Import initializer

dotenv.config();

const port = process.env.PORT || 3000;

// Initialize Supabase client on startup
try {
  initializeSupabase();
} catch (error) {
  console.error("Failed to initialize Supabase:", error);
  process.exit(1); // Exit if Supabase can't connect
}

// Initialize OpenAI client on startup (optional, but good practice)
try {
  initializeOpenAI(); 
} catch (error) {
  console.error("Failed to initialize OpenAI (check API key?):", error);
  // Decide if you want to exit or just log the error
  // process.exit(1);
}

app.listen(port, () => {
  console.log(`Server (from server.ts) is running on port ${port}`);
  console.log('Ensuring all routes from server.ts are active.');
}); 