const sequelize = require('./connection');
const User = require('../models/User');

async function addShieldsColumn() {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('users');

    if (!tableInfo.shields) {
      console.log('Adding shields column to users table...');
      await queryInterface.addColumn('users', 'shields', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of shields user has'
      });
      console.log('✅ shields column added successfully!');
    } else {
      console.log('shields column already exists.');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error adding shields column:', error);
    process.exit(1);
  }
}

addShieldsColumn();



