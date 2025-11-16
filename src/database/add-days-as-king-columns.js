const sequelize = require('./connection');
const User = require('../models/User');

async function addDaysAsKingColumns() {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
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
      console.log('daysAsKing column already exists.');
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
      console.log('becameKingAt column already exists.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error adding Days as King columns:', error);
    process.exit(1);
  }
}

addDaysAsKingColumns();


