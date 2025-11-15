const sequelize = require('./connection');
const { QueryTypes } = require('sequelize');

async function addLastRecapTimeColumn() {
  try {
    console.log('Checking if lastRecapTime column exists...');
    
    // Check if column exists (SQLite specific)
    const tableInfo = await sequelize.query(
      "PRAGMA table_info(groups)",
      { type: QueryTypes.SELECT }
    );
    
    const hasLastRecapTime = tableInfo.some(col => col.name === 'lastRecapTime');
    
    if (!hasLastRecapTime) {
      console.log('Adding lastRecapTime column to groups table...');
      await sequelize.query(
        "ALTER TABLE groups ADD COLUMN lastRecapTime DATETIME",
        { type: QueryTypes.RAW }
      );
      console.log('✅ lastRecapTime column added successfully!');
    } else {
      console.log('✅ lastRecapTime column already exists.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding column:', error);
    process.exit(1);
  }
}

addLastRecapTimeColumn();


