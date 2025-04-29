// Simple entry point for Vercel deployment
const express = require('express');
const app = express();

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', deployment: 'vercel' });
});

// Fallback route
app.get('*', (req, res) => {
  res.status(200).send('SharpSpring API Server is running. Check documentation for available endpoints.');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; 