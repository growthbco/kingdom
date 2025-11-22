const sequelize = require('./connection');
const MarketItem = require('../models/MarketItem');

async function addMarketItemsTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Sync the MarketItem model (creates table if it doesn't exist)
    await MarketItem.sync({ alter: true });
    console.log('✅ Market items table created/updated successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating market items table:', error);
    process.exit(1);
  }
}

addMarketItemsTable();


