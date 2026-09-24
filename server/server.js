const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
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

// Security headers with relaxed cross-origin resource policy for images
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS - allows frontend to access API
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));

// Logging - shows requests in console
app.use(morgan('dev'));

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================================================
// STATIC FILES (for file uploads & proof images)
// ================================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================================================
// DATABASE CONNECTION
// ================================================
testConnection();

// ================================================
// API ROUTES
// ================================================
app.use('/api/v1', routes);

// ================================================
// ROOT ROUTE
// ================================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Dela Costa HOA Stall Leasing API (Supabase & PayMongo Ready)',
        version: '1.0.0',
        documentation: '/api/v1'
    });
});

// ================================================
// ERROR HANDLING
// ================================================

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Global error handler with professional diagnostic notes
app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const errorCode = err.code || (status >= 500 ? 'ERR_INTERNAL_SERVER' : 'ERR_CLIENT_REQUEST');

    // Terminal Diagnostic Log
    console.error(`\n🚨 [API ERROR ${status}] ${req.method} ${req.originalUrl}`);
    console.error(`📌 Error Type: ${err.name || 'Error'} | Code: ${errorCode}`);
    console.error(`💬 Message:   ${err.message}`);
    if (err.stack && process.env.NODE_ENV !== 'production') {
        console.error(`📜 Stack Trace:\n${err.stack}`);
    }
    console.error(`------------------------------------------------------\n`);

    res.status(status).json({
        success: false,
        error_code: errorCode,
        message: err.message || 'An unexpected internal server error occurred.',
        timestamp: new Date().toISOString(),
        path: `${req.method} ${req.originalUrl}`,
        ...(process.env.NODE_ENV !== 'production' && {
            details: err.details || null,
            stack: err.stack
        })
    });
});

// ================================================
// START SERVER
// ================================================
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🏪 Dela Costa HOA Stall Leasing API Server`);
    console.log(`🚀 Running at: http://localhost:${PORT}`);
    console.log(`📡 Base API:   http://localhost:${PORT}/api/v1`);
    console.log(`💳 Payment:    PayMongo Gateway Integration Active`);
    console.log(`🗄️ Database:   Supabase PostgreSQL Pool Connected`);
    console.log(`======================================================\n`);
});