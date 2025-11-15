const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const DailyActivity = sequelize.define('DailyActivity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  chatId: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Date in YYYY-MM-DD format'
  },
  messageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  memeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  firstMessageOfDay: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  dailyWelfareReceived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  lastMessageTimestamp: {
    type: DataTypes.DATE,
    allowNull: true
  },
  activityRewardsGiven: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of activity reward tickets given today (max 5 for messages, 3 for memes)'
  }
}, {
  tableName: 'daily_activities',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'chatId', 'date']
    },
    {
      fields: ['date']
    }
  ]
});

module.exports = DailyActivity;


