const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const TicketTransaction = sequelize.define('TicketTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Positive for awards, negative for redemptions'
  },
  type: {
    type: DataTypes.ENUM('award', 'redeem'),
    allowNull: false
  },
  actionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'redemption_actions',
      key: 'id'
    },
    comment: 'Only set if type is redeem'
  },
  awardedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User who awarded/redeemed (null for self-redemption)'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  }
}, {
  tableName: 'ticket_transactions',
  timestamps: true
});

module.exports = TicketTransaction;






