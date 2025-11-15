const sequelize = require('./connection');
const User = require('../models/User');
const TicketTransaction = require('../models/TicketTransaction');
const Rule = require('../models/Rule');
const RedemptionAction = require('../models/RedemptionAction');
const Group = require('../models/Group');
const ActivityLog = require('../models/ActivityLog');
const ChatMessage = require('../models/ChatMessage');
const DailyActivity = require('../models/DailyActivity');
const defaultRules = require('../config/defaultRules');
const defaultActions = require('../config/defaultActions');

// Set up relationships
TicketTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
TicketTransaction.belongsTo(User, { foreignKey: 'awardedBy', as: 'awarder' });
TicketTransaction.belongsTo(RedemptionAction, { foreignKey: 'actionId', as: 'action' });
Rule.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ActivityLog.belongsTo(User, { foreignKey: 'targetUserId', as: 'targetUser' });

async function migrate() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection established.');

    console.log('Synchronizing database schema...');
    await sequelize.sync({ force: false });
    console.log('Database schema synchronized.');
    
    // Create daily_activities table if it doesn't exist
    console.log('Checking daily_activities table...');
    const { QueryTypes } = require('sequelize');
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
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_daily_activities_chatId ON daily_activities(chatId)
      `, { type: QueryTypes.RAW });
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_daily_activities_date ON daily_activities(date)
      `, { type: QueryTypes.RAW });
      
      console.log('✅ daily_activities table created!');
    } else {
      console.log('✅ daily_activities table already exists.');
    }

    // Load default rules if none exist
    const ruleCount = await Rule.count();
    if (ruleCount === 0) {
      console.log('Loading default rules...');
      await Rule.bulkCreate(defaultRules);
      console.log(`Loaded ${defaultRules.length} default rules.`);
    }

    // Load default actions if none exist
    const actionCount = await RedemptionAction.count();
    if (actionCount === 0) {
      console.log('Loading default actions...');
      await RedemptionAction.bulkCreate(defaultActions);
      console.log(`Loaded ${defaultActions.length} default actions.`);
    }

    // Add Days as King columns if they don't exist
    console.log('Checking for Days as King columns...');
    const queryInterface = sequelize.getQueryInterface();
    try {
      const tableInfo = await queryInterface.describeTable('users');
      
      if (!tableInfo.daysAsKing) {
        console.log('Adding daysAsKing column to users table...');
        await queryInterface.addColumn('users', 'daysAsKing', {
          type: require('sequelize').DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: false,
          comment: 'Number of days user has been King/Queen'
        });
        console.log('✅ daysAsKing column added successfully!');
      } else {
        console.log('✅ daysAsKing column already exists.');
      }

      if (!tableInfo.becameKingAt) {
        console.log('Adding becameKingAt column to users table...');
        await queryInterface.addColumn('users', 'becameKingAt', {
          type: require('sequelize').DataTypes.DATE,
          allowNull: true,
          comment: 'Date when user became King/Queen'
        });
        console.log('✅ becameKingAt column added successfully!');
      } else {
        console.log('✅ becameKingAt column already exists.');
      }
    } catch (error) {
      console.error('Error checking/adding Days as King columns:', error);
      // Don't fail migration if columns already exist or table doesn't exist yet
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();

