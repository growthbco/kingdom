const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const Protection = sequelize.define('Protection', {
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
    comment: 'User who is protected'
  },
  protectedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User who activated the protection'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'When the protection expires (24 hours from activation)'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Whether the protection is currently active'
  }
}, {
  tableName: 'protections',
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'isActive']
    },
    {
      fields: ['expiresAt']
    }
  ]
});

module.exports = Protection;


