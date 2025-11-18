const sequelize = require('./connection');
const User = require('../models/User');

async function addBombsColumn() {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('users');

    if (!tableInfo.bombs) {
      console.log('Adding bombs column to users table...');
      await queryInterface.addColumn('users', 'bombs', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of bombs user has'
      });
      console.log('✅ bombs column added successfully!');
    } else {
      console.log('bombs column already exists.');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error adding bombs column:', error);
    process.exit(1);
  }
}

addBombsColumn();







