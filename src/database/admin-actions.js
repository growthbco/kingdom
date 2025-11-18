const sequelize = require('./connection');
const User = require('../models/User');
const roleService = require('../services/roleService');
const { kickChatMember } = require('../bot/telegramBot');
require('dotenv').config();

// Set up relationships
const TicketTransaction = require('../models/TicketTransaction');
TicketTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

/**
 * Set gary as king and remove claire from group chat
 */
async function performAdminActions() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Find gary
    const gary = await User.findOne({
      where: {
        name: {
          [require('sequelize').Op.like]: '%gary%'
        }
      }
    });

    if (!gary) {
      console.log('❌ Could not find user "gary" in database.');
      console.log('Available users:');
      const allUsers = await User.findAll();
      allUsers.forEach(user => {
        console.log(`  - ${user.name} (ID: ${user.id}, Messenger ID: ${user.messengerId}, Role: ${user.role})`);
      });
      return;
    }

    console.log(`\n✅ Found gary: ${gary.name} (ID: ${gary.id}, Messenger ID: ${gary.messengerId}, Current Role: ${gary.role})`);

    // Set gary as king
    try {
      await roleService.setUserRole(gary.id, 'king');
      console.log(`✅ Set ${gary.name} as king!`);
    } catch (error) {
      console.error(`❌ Error setting gary as king:`, error.message);
    }

    // Find claire
    const claire = await User.findOne({
      where: {
        name: {
          [require('sequelize').Op.like]: '%claire%'
        }
      }
    });

    if (!claire) {
      console.log('\n⚠️  Could not find user "claire" in database.');
      console.log('Available users:');
      const allUsers = await User.findAll();
      allUsers.forEach(user => {
        console.log(`  - ${user.name} (ID: ${user.id}, Messenger ID: ${user.messengerId}, Role: ${user.role})`);
      });
      return;
    }

    console.log(`\n✅ Found claire: ${claire.name} (ID: ${claire.id}, Messenger ID: ${claire.messengerId}, Current Role: ${claire.role})`);

    // Get the main chat ID from environment, database, or use claire's currentGroupId
    let chatId = process.env.MAIN_CHAT_ID || process.env.CHAT_ID;
    
    // Try to find main chat from Group model
    if (!chatId) {
      const Group = require('../models/Group');
      const mainGroup = await Group.findOne({
        where: { type: 'main' },
        order: [['createdAt', 'DESC']]
      });
      if (mainGroup) {
        chatId = mainGroup.messengerGroupId;
        console.log(`\nFound main chat from database: ${chatId} (${mainGroup.groupName || 'Main Chat'})`);
      }
    }
    
    // Fallback to claire's currentGroupId
    if (!chatId && claire.currentGroupId) {
      chatId = claire.currentGroupId;
      console.log(`\nUsing claire's current group ID: ${chatId}`);
    }
    
    if (!chatId) {
      console.log('\n⚠️  No chat ID found. Cannot remove claire from chat.');
      console.log('Please set MAIN_CHAT_ID or CHAT_ID in your .env file, or use the /remove command in Telegram:');
      console.log(`  /remove ${claire.name}`);
      return;
    }

    console.log(`\nAttempting to remove ${claire.name} from chat ${chatId}...`);

    let claireRemoved = false;
    try {
      await kickChatMember(chatId, parseInt(claire.messengerId));
      console.log(`✅ Successfully removed ${claire.name} from chat!`);
      claireRemoved = true;
    } catch (kickError) {
      console.error(`❌ Error removing ${claire.name} from chat:`, kickError.message);
      
      if (kickError.message && kickError.message.includes('not enough rights')) {
        console.log('\n⚠️  Bot is not an admin in the chat. Please remove claire manually.');
      } else if (kickError.message && kickError.message.includes('user is an administrator')) {
        console.log('\n⚠️  Cannot remove claire - they are an administrator of the chat.');
      } else {
        console.log('\n⚠️  Could not remove claire automatically. Please remove them manually using:');
        console.log(`  /remove ${claire.name}`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`✅ ${gary.name} is now king`);
    if (claire) {
      console.log(`${claire.name} removal: ${claireRemoved ? 'Success' : 'Failed - please remove manually'}`);
    }

  } catch (error) {
    console.error('❌ Error performing admin actions:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
if (require.main === module) {
  performAdminActions()
    .then(() => {
      console.log('\nScript completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nScript failed:', error);
      process.exit(1);
    });
}

module.exports = { performAdminActions };

