// Simple entry point for Vercel deployment - No TypeScript required
// Triggering fresh commit for Vercel
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    deployment: 'vercel',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// SharpSpring webhook endpoint - Basic implementation
app.post('/webhooks/sharpspring', (req, res) => {
  try {
    // Log the webhook payload
    console.log('Received SharpSpring webhook:', JSON.stringify(req.body, null, 2));
    
    // Respond immediately to acknowledge receipt
    res.status(200).json({ status: 'success', message: 'Webhook received' });
    
    // Process would happen asynchronously in the full implementation
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Interaction logging endpoint - Basic implementation
app.post('/api/log-interaction', (req, res) => {
  try {
    const { leadIdentifier, identifierType, interactionType, summary } = req.body;
    
    // Basic validation
    if (!leadIdentifier || !identifierType || !interactionType || !summary) {
      return res.status(400).json({ 
        message: 'Missing required fields: leadIdentifier, identifierType, interactionType, summary' 
      });
    }
    
    // Log the interaction request
    console.log('Received interaction logging request:', {
      leadIdentifier,
      identifierType,
      interactionType,
      summary
    });
    
    // Return success (would actually process in the full implementation)
    res.status(200).json({ 
      message: 'Interaction logged successfully (stub implementation)',
      leadId: 'sample-id',
      newScore: 50
    });
  } catch (error) {
    console.error('Error processing interaction:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fallback route
app.get('*', (req, res) => {
  res.status(200).send('SharpSpring API Server is running. Check documentation for available endpoints.');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('- GET /health - Health check');
  console.log('- POST /webhooks/sharpspring - SharpSpring webhook endpoint');
  console.log('- POST /api/log-interaction - Log user interactions with leads');
});

module.exports = app; 