const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  chatId: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  messageText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  messageId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Telegram message ID for reference'
  }
}, {
  tableName: 'chat_messages',
  timestamps: true,
  indexes: [
    {
      fields: ['chatId', 'createdAt']
    }
  ]
});

module.exports = ChatMessage;










