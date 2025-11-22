const pool = require('./database');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Read schema file
    const schema = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );
    
    // Execute schema
    await pool.query(schema);
    
    console.log('✅ Database initialized successfully');
    console.log('Tables created:');
    console.log('  - users');
    console.log('  - portfolios');
    console.log('  - positions');
    console.log('  - orders');
    console.log('  - experiments');
    console.log('  - bots');
    console.log('  - bot_metrics');
    console.log('  - bot_trades');
    console.log('  - price_history');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initializeDatabase();
