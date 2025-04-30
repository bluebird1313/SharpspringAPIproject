// api/index.js - Entry point for Vercel Serverless Function

// Require the main server logic from server.js
const app = require('../server.js');

// Export the app for Vercel's handler
module.exports = app; 