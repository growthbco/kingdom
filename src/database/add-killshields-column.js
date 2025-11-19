const sequelize = require('./connection');
const User = require('../models/User');

async function addKillShieldsColumn() {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('users');

    if (!tableInfo.killShields) {
      console.log('Adding killShields column to users table...');
      await queryInterface.addColumn('users', 'killShields', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of kill shields user has (for blocking kill attempts)'
      });
      console.log('✅ killShields column added successfully!');
    } else {
      console.log('killShields column already exists.');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error adding killShields column:', error);
    process.exit(1);
  }
}

addKillShieldsColumn();

