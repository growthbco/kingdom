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
    
    console.log('Telegram bot is running and polling for messages...');
    const botInfo = await bot.getMe();
    botUsername = botInfo.username.toLowerCase();
    console.log(`Bot username: @${botInfo.username}`);
    
    // Initialize scheduler for automated rewards
    schedulerService.initializeScheduler();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle all messages (text, photos, videos, etc.)
bot.on('message', async (msg) => {
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
    if (!isCommand) return;
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
