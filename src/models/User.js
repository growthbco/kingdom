const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  messengerId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nickname: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Custom display name/nickname'
  },
  role: {
    type: DataTypes.ENUM('king', 'queen', 'peasant', 'enforcer', 'lawyer', 'guard', 'prosecutor'),
    defaultValue: 'peasant',
    allowNull: false
  },
  currentGroupId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isInPrison: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  lastSeen: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time user was active in chat'
  },
  bombs: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of bombs user has'
  },
  shields: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of shields user has'
  },
  daysAsKing: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of days user has been King/Queen'
  },
  becameKingAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when user became King/Queen'
  }
}, {
  tableName: 'users',
  timestamps: true
});

module.exports = User;

