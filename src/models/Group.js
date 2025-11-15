const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  messengerGroupId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  groupName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('main', 'prison'),
    defaultValue: 'main',
    allowNull: false
  },
  lastRecapTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp of the last recap generated for this chat'
  }
}, {
  tableName: 'groups',
  timestamps: true
});

module.exports = Group;


