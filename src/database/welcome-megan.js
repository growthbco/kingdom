const sequelize = require('./connection');
const User = require('../models/User');
const { sendMessage } = require('../bot/telegramBot');
const Group = require('../models/Group');

async function welcomeMegan() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Find Megan (queen)
    const megan = await User.findOne({
      where: { role: 'queen' }
    });
    
    if (!megan) {
      console.log('❌ Megan not found as queen. Please set her as queen first.');
      process.exit(1);
    }
    
    // Get all groups to send welcome message
    const groups = await Group.findAll({
      where: { type: 'main' }
    });
    
    if (groups.length === 0) {
      console.log('⚠️ No groups found. Welcome message will need to be sent manually.');
      console.log('\n📝 Welcome message:');
      console.log(`👑 **ALL HAIL THE NEW QUEEN!** 👑\n\n`);
      console.log(`Long live Queen ${megan.name}! 👑\n\n`);
      console.log(`The Kingdom welcomes its new ruler with open arms!`);
      console.log(`May her reign be prosperous and just! 🎉\n\n`);
      console.log(`All hail Queen ${megan.name}! 👑`);
      process.exit(0);
    }
    
    const meganMention = `<a href="tg://user?id=${megan.messengerId}">${megan.name}</a>`;
    const welcomeMessage = `👑 **ALL HAIL THE NEW QUEEN!** 👑\n\n` +
      `Long live ${meganMention}! 👑\n\n` +
      `The Kingdom welcomes its new ruler with open arms!\n` +
      `May her reign be prosperous and just! 🎉\n\n` +
      `All hail Queen ${megan.name}! 👑`;
    
    // Send to all main groups
    for (const group of groups) {
      try {
        await sendMessage(group.messengerGroupId, welcomeMessage, { parse_mode: 'HTML' });
        console.log(`✅ Welcome message sent to ${group.groupName || group.messengerGroupId}`);
      } catch (error) {
        console.error(`❌ Error sending to ${group.messengerGroupId}:`, error.message);
      }
    }
    
    console.log('\n✅ Welcome messages sent!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

welcomeMegan();


