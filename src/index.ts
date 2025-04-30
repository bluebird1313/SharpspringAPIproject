import app from './server'; // Import the configured app from server.ts
import * as dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 3000;

// Initialize services if needed (Supabase/OpenAI clients are initialized within their respective service files)
// Example: supabaseService.initializeSupabase();
// Example: openaiService.initializeOpenAI();

app.listen(port, () => {
  console.log(`Server (from server.ts) is running on port ${port}`);
  console.log('Ensuring all routes from server.ts are active.');
}); 