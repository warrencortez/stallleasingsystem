// Set before importing the app so persistence and DB pooling use serverless defaults.
process.env.NETLIFY = 'true';
const serverless = require('serverless-http');
const app = require('../../server');
exports.handler = serverless(app);
