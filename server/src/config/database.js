const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config();

// Create connection pool to Supabase
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test function to check if we can connect
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Connected to Supabase successfully!');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.log('💡 Check your .env file settings');
        return false;
    }
};

module.exports = { pool, testConnection };