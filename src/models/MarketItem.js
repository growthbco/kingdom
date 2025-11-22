const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const MarketItem = sequelize.define('MarketItem', {
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
    },
    comment: 'User who owns this item'
  },
  emoji: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Emoji representing the item'
  },
  itemName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Name of the item'
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
    comment: 'Quantity of this item owned'
  }
}, {
  tableName: 'market_items',
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'emoji'],
      unique: true
    }
  ]
});

module.exports = MarketItem;


