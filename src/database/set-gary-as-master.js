const sequelize = require('./connection');
const User = require('../models/User');
const { Sequelize } = require('sequelize');

async function setGaryAsMaster() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Find Gary (garysanc)
    const gary = await User.findOne({
      where: Sequelize.where(
        Sequelize.fn('LOWER', Sequelize.col('name')),
        'garysanc'
      )
    });
    
    if (!gary) {
      console.error('❌ User "garysanc" not found. Please ensure Gary has sent a message in the chat.');
      process.exit(1);
    }
    
    // Set role to master
    gary.role = 'master';
    await gary.save();
    
    console.log(`✅ Set ${gary.name}'s role to "master"`);
    console.log(`   User ID: ${gary.id}`);
    console.log(`   Name: ${gary.name}`);
    console.log(`   Nickname: ${gary.nickname || 'None'}`);
    console.log(`   Role: ${gary.role}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setGaryAsMaster();


