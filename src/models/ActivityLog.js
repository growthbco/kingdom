const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const ActivityLog = sequelize.define('ActivityLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  eventType: {
    type: DataTypes.ENUM(
      'role_change',
      'ticket_awarded',
      'ticket_redeemed',
      'rule_added',
      'rule_removed',
      'rule_edited',
      'user_banned',
      'user_pardoned',
      'action_created'
    ),
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User who performed the action or was affected'
  },
  targetUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Target user if applicable (e.g., who got tickets, who was banned)'
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON string with additional details'
  },
  chatId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Telegram chat ID where event occurred'
  }
}, {
  tableName: 'activity_logs',
  timestamps: true
});

module.exports = ActivityLog;



