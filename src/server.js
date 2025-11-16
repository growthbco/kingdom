const { bot, sendMessage } = require('./bot/telegramBot');
const { parseMessage } = require('./bot/messageHandler');
const { routeCommand } = require('./bot/commandRouter');
const roleService = require('./services/roleService');
const activityService = require('./services/activityService');
const automatedRewardsService = require('./services/automatedRewardsService');
const randomDropService = require('./services/randomDropService');
const miniGameService = require('./services/miniGameService');
const schedulerService = require('./services/schedulerService');
const sequelize = require('./database/connection');

const PORT = process.env.PORT || 3000;

// Cache bot username
let botUsername = null;

// Initialize database connection
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    
    // Ensure database schema is synchronized (creates tables if they don't exist)
    await sequelize.sync({ force: false });
    console.log('Database schema synchronized.');
    
    // Ensure Days as King columns exist
    try {
      const queryInterface = sequelize.getQueryInterface();
      const tableInfo = await queryInterface.describeTable('users');
      
      if (!tableInfo.daysAsKing) {
        console.log('Adding daysAsKing column...');
        await queryInterface.addColumn('users', 'daysAsKing', {
          type: require('sequelize').DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: false,
          comment: 'Number of days user has been King/Queen'
        });
        console.log('✅ daysAsKing column added.');
      }
      
      if (!tableInfo.becameKingAt) {
        console.log('Adding becameKingAt column...');
        await queryInterface.addColumn('users', 'becameKingAt', {
          type: require('sequelize').DataTypes.DATE,
          allowNull: true,
          comment: 'Date when user became King/Queen'
        });
        console.log('✅ becameKingAt column added.');
      }
    } catch (error) {
      // Columns might already exist, or table might not exist yet (will be created by sync)
      console.log('Days as King columns check:', error.message);
    }
    
    console.log('Telegram bot is running and polling for messages...');
    const botInfo = await bot.getMe();
    botUsername = botInfo.username.toLowerCase();
    console.log(`Bot username: @${botInfo.username}`);
    
    // Initialize scheduler for automated rewards
    try {
      schedulerService.initializeScheduler();
    } catch (schedulerError) {
      console.error('Failed to initialize scheduler:', schedulerError);
      // Don't exit - continue without scheduler
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('Error stack:', error.stack);
    // Exit only on critical startup failures
    setTimeout(() => process.exit(1), 5000); // Give time for logs
  }
}

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit - log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - log and continue
});

// Handle all messages (text, photos, videos, etc.)
bot.on('message', async (msg) => {
  // Wrap entire message handler in try-catch to prevent crashes
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || `User_${userId}`;
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    
    // Ignore messages from bots
    if (msg.from.is_bot) return;
    
    // Check if message is media (photo/video = meme)
    const isMeme = !!(msg.photo || msg.video || msg.animation);
    const text = msg.text ? msg.text.trim() : '';
    const isCommand = text.startsWith('/');
    
    // Track message activity (for all messages, including media)
    if (!isCommand) {
      try {
      const user = await roleService.createOrUpdateUser(
        userId.toString(),
        username,
        chatId.toString()
      );
      user.lastSeen = new Date();
      await user.save();
      
      // Check for disrespectful language directed at King/Queen
      if (text) {
        const lowerText = text.toLowerCase();
        const disrespectfulWords = ['bitch', 'crybaby', 'asshole'];
        const hasDisrespectfulWord = disrespectfulWords.some(word => lowerText.includes(word));
        
        if (hasDisrespectfulWord) {
          // Check if message is directed at King/Queen
          const User = require('./models/User');
          const king = await User.findOne({ where: { role: 'king' } });
          const queen = await User.findOne({ where: { role: 'queen' } });
          
          let isDirectedAtRoyalty = false;
          let targetRoyalty = null;
          
          // Check if it's a reply to King/Queen
          if (msg.reply_to_message && msg.reply_to_message.from) {
            const replyUserId = msg.reply_to_message.from.id.toString();
            if (king && king.messengerId === replyUserId) {
              isDirectedAtRoyalty = true;
              targetRoyalty = king;
            } else if (queen && queen.messengerId === replyUserId) {
              isDirectedAtRoyalty = true;
              targetRoyalty = queen;
            }
          }
          
          // Check if King/Queen is mentioned in the message
          if (!isDirectedAtRoyalty) {
            if (king && (lowerText.includes(king.name.toLowerCase()) || lowerText.includes('king'))) {
              isDirectedAtRoyalty = true;
              targetRoyalty = king;
            } else if (queen && (lowerText.includes(queen.name.toLowerCase()) || lowerText.includes('queen'))) {
              isDirectedAtRoyalty = true;
              targetRoyalty = queen;
            }
          }
          
          // If directed at royalty, ban the user
          if (isDirectedAtRoyalty) {
            const jailService = require('./services/jailService');
            const { kickChatMember } = require('./bot/telegramBot');
            
            const warningMessage = `⚠️ **DISRESPECT DETECTED!**\n\n` +
              `You have used inappropriate language directed at the ${targetRoyalty.role === 'king' ? 'King' : 'Queen'}.\n\n` +
              `🔒 You will be removed from this chat in 10 seconds...\n\n` +
              `No one shall speak to the ${targetRoyalty.role === 'king' ? 'King' : 'Queen'} in that manner!`;
            
            // Send warning message
            await sendMessage(chatId.toString(), warningMessage);
            
            // Countdown and kick
            const countdown = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
            for (const num of countdown) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              try {
                await sendMessage(chatId.toString(), `⏰ ${num}...`);
              } catch (e) {
                // Ignore errors during countdown
              }
            }
            
            // Log activity
            try {
              await activityService.logActivity('user_banned', {
                userId: user.id,
                targetUserId: user.id,
                details: { reason: `Disrespectful language directed at ${targetRoyalty.role}` },
                chatId: chatId.toString()
              });
            } catch (error) {
              console.error('Error logging activity:', error);
            }
            
            // Kick the user
            try {
              const chatIdStr = chatId.toString();
              const userIdInt = parseInt(userId);
              
              console.log(`Banning user ${userIdInt} from chat ${chatIdStr} for disrespect`);
              
              await kickChatMember(chatIdStr, userIdInt);
              
              await sendMessage(chatIdStr, `🔒 ${user.name} has been removed for disrespectful language directed at the ${targetRoyalty.role === 'king' ? 'King' : 'Queen'}.`);
            } catch (kickError) {
              console.error('Error kicking user:', kickError);
              
              let errorMsg = '';
              if (kickError.message) {
                if (kickError.message.includes('not enough rights') || kickError.message.includes('chat_admin_required')) {
                  errorMsg = `⚠️ Bot is not an admin - could not remove ${user.name}. Please remove them manually.`;
                } else if (kickError.message.includes('user is an administrator')) {
                  errorMsg = `⚠️ Cannot remove ${user.name} - they are an administrator of this chat.`;
                } else {
                  errorMsg = `⚠️ Could not remove ${user.name}: ${kickError.message}`;
                }
              } else {
                errorMsg = `⚠️ Could not remove ${user.name}. Please check bot permissions.`;
              }
              
              await sendMessage(chatId.toString(), errorMsg);
            }
            
            // Notify jail chat if configured
            try {
              const jailChatId = await jailService.getJailChatId(chatId.toString());
              if (jailChatId) {
                const jailMessage = `🔒 **New Prisoner Arrived (Disrespect)**\n\n` +
                  `**Name:** ${user.name}\n` +
                  `**User ID:** ${user.messengerId}\n` +
                  `**Reason:** Disrespectful language directed at ${targetRoyalty.role === 'king' ? 'King' : 'Queen'} ${targetRoyalty.name}\n` +
                  `**Chat:** ${msg.chat.title || 'Main Chat'}\n\n` +
                  `_Please add this user to the jail chat manually._`;
                
                await sendMessage(jailChatId, jailMessage);
              }
            } catch (error) {
              console.error('Error sending jail notification:', error);
            }
            
            // Return early - don't process message further
            return;
          }
        }
      }
      
      // Check for mentions of "sam" - auto-ban
      if (text) {
        const lowerText = text.toLowerCase();
        // Check if "sam" is mentioned as a standalone word (not part of another word)
        const samRegex = /\bsam\b/i;
        if (samRegex.test(text)) {
          const jailService = require('./services/jailService');
          const { kickChatMember } = require('./bot/telegramBot');
          
          const warningMessage = `⚠️ **FORBIDDEN NAME DETECTED!**\n\n` +
            `You have mentioned a forbidden name.\n\n` +
            `🔒 You will be removed from this chat in 10 seconds...`;
          
          // Send warning message
          await sendMessage(chatId.toString(), warningMessage);
          
          // Countdown and kick
          const countdown = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
          for (const num of countdown) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            try {
              await sendMessage(chatId.toString(), `⏰ ${num}...`);
            } catch (e) {
              // Ignore errors during countdown
            }
          }
          
          // Log activity
          try {
            await activityService.logActivity('user_banned', {
              userId: user.id,
              targetUserId: user.id,
              details: { reason: 'Mentioned forbidden name: sam' },
              chatId: chatId.toString()
            });
          } catch (error) {
            console.error('Error logging activity:', error);
          }
          
          // Kick the user
          try {
            const chatIdStr = chatId.toString();
            const userIdInt = parseInt(userId);
            
            console.log(`Banning user ${userIdInt} from chat ${chatIdStr} for mentioning forbidden name`);
            
            await kickChatMember(chatIdStr, userIdInt);
            
            await sendMessage(chatIdStr, `🔒 ${user.name} has been removed for mentioning a forbidden name.`);
          } catch (kickError) {
            console.error('Error kicking user:', kickError);
            
            let errorMsg = '';
            if (kickError.message) {
              if (kickError.message.includes('not enough rights') || kickError.message.includes('chat_admin_required')) {
                errorMsg = `⚠️ Bot is not an admin - could not remove ${user.name}. Please remove them manually.`;
              } else if (kickError.message.includes('user is an administrator')) {
                errorMsg = `⚠️ Cannot remove ${user.name} - they are an administrator of this chat.`;
              } else {
                errorMsg = `⚠️ Could not remove ${user.name}: ${kickError.message}`;
              }
            } else {
              errorMsg = `⚠️ Could not remove ${user.name}. Please check bot permissions.`;
            }
            
            await sendMessage(chatId.toString(), errorMsg);
          }
          
          // Notify jail chat if configured
          try {
            const jailChatId = await jailService.getJailChatId(chatId.toString());
            if (jailChatId) {
              const jailMessage = `🔒 **New Prisoner Arrived (Forbidden Name)**\n\n` +
                `**Name:** ${user.name}\n` +
                `**User ID:** ${user.messengerId}\n` +
                `**Reason:** Mentioned forbidden name: sam\n` +
                `**Chat:** ${msg.chat.title || 'Main Chat'}\n\n` +
                `_Please add this user to the jail chat manually._`;
              
              await sendMessage(jailChatId, jailMessage);
            }
          } catch (error) {
            console.error('Error sending jail notification:', error);
          }
          
          // Return early - don't process message further
          return;
        }
      }
      
      // Track message for activity rewards
      const { activity, isFirstMessage } = await automatedRewardsService.trackMessage(
        user.id,
        chatId.toString(),
        isMeme
      );
      
      // Award activity rewards (async, don't wait - silent, no message)
      automatedRewardsService.awardActivityRewards(user.id, chatId.toString())
        .catch(err => console.error('Error awarding activity rewards:', err));
      
      // Store chat message for recap/summarization (only if text)
      if (text) {
      const chatService = require('./services/chatService');
      await chatService.storeMessage(chatId.toString(), user.id, username, text, msg.message_id);
      }
      
      // Check if this is a reply to a bounty/trivia game
      if (msg.reply_to_message) {
        const bounty = randomDropService.getActiveDrop(chatId.toString());
        const trivia = miniGameService.getActiveGame(chatId.toString());
        
        if (bounty && bounty.type === 'bounty' && bounty.messageId === msg.reply_to_message.message_id) {
          await randomDropService.handleBountyAnswer(chatId.toString(), userId.toString(), username, text);
          return;
        }
        
        if (trivia && trivia.type === 'trivia' && trivia.messageId === msg.reply_to_message.message_id) {
          const result = await miniGameService.handleTriviaAnswer(chatId.toString(), userId.toString(), username, text);
          // Send feedback to the user who answered
          if (result && result.message) {
            try {
              await sendMessage(chatId.toString(), result.message);
            } catch (error) {
              console.error('Error sending trivia feedback:', error);
            }
          }
          return;
        }
      }
      
      } catch (error) {
        // Silently fail - don't interrupt chat
        console.error('Error processing message:', error);
      }
      
      // Don't process non-command messages further
      return;
    }
    
    // Process commands (text messages starting with /)
    if (!isCommand) return;
    
    // Log incoming commands for debugging
    console.log(`[${new Date().toISOString()}] Command from ${username} (${userId}) in chat ${chatId}: ${text.substring(0, 50)}`);
    
    try {
    // Get or create user
    const user = await roleService.createOrUpdateUser(
      userId.toString(),
      username,
      chatId.toString()
    );
    
    // Update last seen timestamp
    user.lastSeen = new Date();
    await user.save();
    
    // Check for disrespectful language directed at King/Queen (also check commands)
    if (text) {
      const lowerText = text.toLowerCase();
      const disrespectfulWords = ['bitch', 'crybaby'];
      const hasDisrespectfulWord = disrespectfulWords.some(word => lowerText.includes(word));
      
      if (hasDisrespectfulWord) {
        // Check if message is directed at King/Queen
        const User = require('./models/User');
        const king = await User.findOne({ where: { role: 'king' } });
        const queen = await User.findOne({ where: { role: 'queen' } });
        
        let isDirectedAtRoyalty = false;
        let targetRoyalty = null;
        
        // Check if it's a reply to King/Queen
        if (msg.reply_to_message && msg.reply_to_message.from) {
          const replyUserId = msg.reply_to_message.from.id.toString();
          if (king && king.messengerId === replyUserId) {
            isDirectedAtRoyalty = true;
            targetRoyalty = king;
          } else if (queen && queen.messengerId === replyUserId) {
            isDirectedAtRoyalty = true;
            targetRoyalty = queen;
          }
        }
        
        // Check if King/Queen is mentioned in the message
        if (!isDirectedAtRoyalty) {
          if (king && (lowerText.includes(king.name.toLowerCase()) || lowerText.includes('king'))) {
            isDirectedAtRoyalty = true;
            targetRoyalty = king;
          } else if (queen && (lowerText.includes(queen.name.toLowerCase()) || lowerText.includes('queen'))) {
            isDirectedAtRoyalty = true;
            targetRoyalty = queen;
          }
        }
        
        // If directed at royalty, ban the user
        if (isDirectedAtRoyalty) {
          const jailService = require('./services/jailService');
          const { kickChatMember } = require('./bot/telegramBot');
          
          const warningMessage = `⚠️ **DISRESPECT DETECTED!**\n\n` +
            `You have used inappropriate language directed at the ${targetRoyalty.role === 'king' ? 'King' : 'Queen'}.\n\n` +
            `🔒 You will be removed from this chat in 10 seconds...\n\n` +
            `No one shall speak to the ${targetRoyalty.role === 'king' ? 'King' : 'Queen'} in that manner!`;
          
          // Send warning message
          await sendMessage(chatId.toString(), warningMessage);
          
          // Countdown and kick
          const countdown = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
          for (const num of countdown) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            try {
              await sendMessage(chatId.toString(), `⏰ ${num}...`);
            } catch (e) {
              // Ignore errors during countdown
            }
          }
          
            // Log activity
            try {
              await activityService.logActivity('user_banned', {
                userId: user.id,
                targetUserId: user.id,
                details: { reason: `Disrespectful language directed at ${targetRoyalty.role}` },
                chatId: chatId.toString()
              });
            } catch (error) {
              console.error('Error logging activity:', error);
            }
          
          // Kick the user
          try {
            const chatIdStr = chatId.toString();
            const userIdInt = parseInt(userId);
            
            console.log(`Banning user ${userIdInt} from chat ${chatIdStr} for disrespect`);
            
            await kickChatMember(chatIdStr, userIdInt);
            
            await sendMessage(chatIdStr, `🔒 ${user.name} has been removed for disrespectful language directed at the ${targetRoyalty.role === 'king' ? 'King' : 'Queen'}.`);
          } catch (kickError) {
            console.error('Error kicking user:', kickError);
            
            let errorMsg = '';
            if (kickError.message) {
              if (kickError.message.includes('not enough rights') || kickError.message.includes('chat_admin_required')) {
                errorMsg = `⚠️ Bot is not an admin - could not remove ${user.name}. Please remove them manually.`;
              } else if (kickError.message.includes('user is an administrator')) {
                errorMsg = `⚠️ Cannot remove ${user.name} - they are an administrator of this chat.`;
              } else {
                errorMsg = `⚠️ Could not remove ${user.name}: ${kickError.message}`;
              }
            } else {
              errorMsg = `⚠️ Could not remove ${user.name}. Please check bot permissions.`;
            }
            
            await sendMessage(chatId.toString(), errorMsg);
          }
          
          // Notify jail chat if configured
          try {
            const jailChatId = await jailService.getJailChatId(chatId.toString());
            if (jailChatId) {
              const jailMessage = `🔒 **New Prisoner Arrived (Disrespect)**\n\n` +
                `**Name:** ${user.name}\n` +
                `**User ID:** ${user.messengerId}\n` +
                `**Reason:** Disrespectful language directed at ${targetRoyalty.role === 'king' ? 'King' : 'Queen'} ${targetRoyalty.name}\n` +
                `**Chat:** ${msg.chat.title || 'Main Chat'}\n\n` +
                `_Please add this user to the jail chat manually._`;
              
              await sendMessage(jailChatId, jailMessage);
            }
          } catch (error) {
            console.error('Error sending jail notification:', error);
          }
          
          // Return early - don't process command further
          return;
        }
      }
    }
    
    // Parse message
    const parsed = parseMessage(text);
    
    // Route command
    const response = await routeCommand(parsed, {
      senderId: userId.toString(),
      chatId: chatId.toString(),
      user,
      message: msg,
      isGroup
    });
    
    // Send response
    if (response) {
      console.log(`[${new Date().toISOString()}] Sending response to chat ${chatId}`);
      await sendMessage(chatId, response);
      console.log(`[${new Date().toISOString()}] Response sent successfully`);
    }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error processing command:`, error);
      console.error('Error stack:', error.stack);
      try {
        await sendMessage(chatId, `❌ Error processing command: ${error.message}`);
      } catch (sendError) {
        console.error('Error sending error message:', sendError);
      }
    }
  } catch (error) {
    // Catch any errors in the outer message handler
    console.error(`[${new Date().toISOString()}] Fatal error in message handler:`, error);
    console.error('Error stack:', error.stack);
    // Don't crash - just log and continue
  }
});

// Handle message reactions (for ticket rain)
bot.on('message_reaction', async (update) => {
  try {
    const chatId = update.chat.id;
    const userId = update.user.id;
    const username = update.user.username || update.user.first_name || `User_${userId}`;
    const messageId = update.message_id;
    
    // Check if this message has a ticket rain active
    const drop = randomDropService.getActiveDrop(chatId.toString());
    if (drop && drop.type === 'ticket_rain' && drop.messageId === messageId) {
      // Check if user reacted with 🎫 emoji
      const reactions = update.new_reaction || [];
      const hasTicketEmoji = reactions.some(r => 
        r.emoji === '🎫' || r.emoji === 'ticket' || r.emoji === '💰'
      );
      
      if (hasTicketEmoji) {
        await randomDropService.handleTicketRainReaction(chatId.toString(), userId.toString(), username);
      }
    }
  } catch (error) {
    console.error('Error handling reaction:', error);
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error(`[${new Date().toISOString()}] Polling error:`, error);
  // If it's a conflict error, it means multiple instances are running
  if (error.message && error.message.includes('409')) {
    console.error('⚠️  Multiple bot instances detected! Killing all instances...');
    process.exit(1);
  }
});

// Start server
startServer();

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});
