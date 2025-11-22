const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/ai_stock_trader',
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : false
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
