const sequelize = require('./connection');
const User = require('../models/User');
const { Sequelize } = require('sequelize');

async function setGaryNickname() {
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
    
    // Set nickname to "Master of The Iron Code"
    gary.nickname = 'Master of The Iron Code';
    await gary.save();
    
    console.log(`✅ Set ${gary.name}'s nickname to "Master of The Iron Code"`);
    console.log(`   User ID: ${gary.id}`);
    console.log(`   Messenger ID: ${gary.messengerId}`);
    console.log(`   Name: ${gary.name}`);
    console.log(`   Nickname: ${gary.nickname}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setGaryNickname();

