const sequelize = require('./connection');
const { QueryTypes } = require('sequelize');

async function addDailyActivityTable() {
  try {
    console.log('Checking if daily_activities table exists...');
    
    // Check if table exists (SQLite specific)
    const tableInfo = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_activities'",
      { type: QueryTypes.SELECT }
    );
    
    if (tableInfo.length === 0) {
      console.log('Creating daily_activities table...');
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS daily_activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          chatId TEXT NOT NULL,
          date DATE NOT NULL,
          messageCount INTEGER DEFAULT 0,
          memeCount INTEGER DEFAULT 0,
          firstMessageOfDay BOOLEAN DEFAULT 0,
          dailyWelfareReceived BOOLEAN DEFAULT 0,
          lastMessageTimestamp DATETIME,
          activityRewardsGiven INTEGER DEFAULT 0,
          createdAt DATETIME NOT NULL,
          updatedAt DATETIME NOT NULL,
          UNIQUE(userId, chatId, date)
        )
      `, { type: QueryTypes.RAW });
      
      // Create indexes
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_daily_activities_chatId ON daily_activities(chatId)
      `, { type: QueryTypes.RAW });
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_daily_activities_date ON daily_activities(date)
      `, { type: QueryTypes.RAW });
      
      console.log('✅ daily_activities table created successfully!');
    } else {
      console.log('✅ daily_activities table already exists.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating daily_activities table:', error);
    process.exit(1);
  }
}

addDailyActivityTable();


