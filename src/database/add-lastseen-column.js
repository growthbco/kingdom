const sequelize = require('./connection');
const { QueryTypes } = require('sequelize');

async function addLastSeenColumn() {
  try {
    console.log('Checking if lastSeen column exists...');
    
    // Check if column exists (SQLite specific)
    const tableInfo = await sequelize.query(
      "PRAGMA table_info(users)",
      { type: QueryTypes.SELECT }
    );
    
    const hasLastSeen = tableInfo.some(col => col.name === 'lastSeen');
    
    if (!hasLastSeen) {
      console.log('Adding lastSeen column to users table...');
      await sequelize.query(
        "ALTER TABLE users ADD COLUMN lastSeen DATETIME",
        { type: QueryTypes.RAW }
      );
      console.log('✅ lastSeen column added successfully!');
    } else {
      console.log('✅ lastSeen column already exists.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding column:', error);
    process.exit(1);
  }
}

addLastSeenColumn();







