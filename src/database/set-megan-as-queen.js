const sequelize = require('./connection');
const User = require('../models/User');

async function setMeganAsQueen() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Find Megan (case-insensitive search)
    const megan = await User.findOne({
      where: require('sequelize').where(
        require('sequelize').fn('LOWER', require('sequelize').col('name')),
        'megan'
      )
    });
    
    if (!megan) {
      console.log('❌ Megan not found in database. Please make sure she has sent a message first.');
      process.exit(1);
    }
    
    // Remove any existing king
    const existingKing = await User.findOne({ where: { role: 'king' } });
    if (existingKing) {
      existingKing.role = 'peasant';
      existingKing.becameKingAt = null;
      await existingKing.save();
      console.log(`✅ Removed ${existingKing.name} from King role`);
    }
    
    // Remove any existing queen
    const existingQueen = await User.findOne({ where: { role: 'queen' } });
    if (existingQueen && existingQueen.id !== megan.id) {
      existingQueen.role = 'peasant';
      existingQueen.becameKingAt = null;
      await existingQueen.save();
      console.log(`✅ Removed ${existingQueen.name} from Queen role`);
    }
    
    // Set Megan as queen
    megan.role = 'queen';
    megan.becameKingAt = new Date();
    megan.daysAsKing = 0;
    await megan.save();
    
    console.log(`✅ ${megan.name} is now the Queen!`);
    console.log(`✅ Ready to welcome the new ruler!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting Megan as queen:', error);
    process.exit(1);
  }
}

setMeganAsQueen();


