const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { testConnection } = require('./src/config/database');
const routes = require('./src/routes');

// Load environment variables
dotenv.config();

// Create express app
const app = express();
const PORT = process.env.PORT || 5000;

// ================================================
// MIDDLEWARE
// ================================================

// Security - adds various security headers
app.use(helmet());

// CORS - allows frontend to access API
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));

// Logging - shows requests in console
app.use(morgan('dev'));

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// ================================================
// STATIC FILES (for uploads)
// ================================================

// We'll add this later for file uploads
// app.use('/uploads', express.static('uploads'));

// ================================================
// DATABASE CONNECTION
// ================================================

// Test database connection on startup
testConnection();

// ================================================
// API ROUTES
// ================================================

// API Version 1 routes
app.use('/api/v1', routes);

// ================================================
// ROOT ROUTE
// ================================================

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Stall Leasing Management System API',
        version: '1.0.0',
        documentation: '/api/v1'
    });
});

// ================================================
// ERROR HANDLING
// ================================================

// 404 Handler - for routes that don't exist
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ================================================
// START SERVER
// ================================================

app.listen(PORT, () => {
    console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api/v1`);
    console.log(`🔐 Auth endpoints:`);
    console.log(`   POST   /api/v1/auth/register  - Create account`);
    console.log(`   POST   /api/v1/auth/login     - Sign in`);
    console.log(`   GET    /api/v1/auth/me        - Get profile (protected)`);
    console.log(`\n💡 Press Ctrl+C to stop the server\n`);
});