const sequelize = require('./connection');
const Protection = require('../models/Protection');

async function addProtectionsTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Sync the Protection model (creates table if it doesn't exist)
    await Protection.sync({ alter: true });
    console.log('✅ Protections table created/updated successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating protections table:', error);
    process.exit(1);
  }
}

addProtectionsTable();


