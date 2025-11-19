const sequelize = require('./connection');
const User = require('../models/User');

async function addNicknameColumn() {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('users');

    if (!tableInfo.nickname) {
      console.log('Adding nickname column to users table...');
      await queryInterface.addColumn('users', 'nickname', {
        type: require('sequelize').DataTypes.STRING,
        allowNull: true,
        comment: 'Custom display name/nickname'
      });
      console.log('✅ nickname column added successfully!');
    } else {
      console.log('nickname column already exists.');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error adding nickname column:', error);
    process.exit(1);
  }
}

addNicknameColumn();









