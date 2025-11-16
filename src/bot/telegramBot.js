const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in .env file');
}

// Create bot instance
// Use polling for development (can switch to webhook for production)
// Add error handling for polling conflicts
const bot = new TelegramBot(BOT_TOKEN, { 
  polling: {
    interval: 1000,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// Handle polling errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
  console.error('Error code:', error.code);
  if (error.message && error.message.includes('409')) {
    console.error('⚠️  Conflict detected - another bot instance may be running');
    console.error('Killing this instance. Please ensure only ONE instance is running.');
    setTimeout(() => process.exit(1), 1000);
  } else if (error.code === 'ETELEGRAM' || error.code === 'EFATAL') {
    console.error('⚠️  Fatal Telegram API error - will retry');
    // Don't exit - let PM2 restart if needed
  }
});

/**
 * Send message to a chat (group or private)
 */
async function sendMessage(chatId, message, options = {}) {
  try {
    // Try with Markdown first
    return await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...options
    });
  } catch (error) {
    // If Markdown parsing fails, send as plain text
    if (error.message && error.message.includes("can't parse entities")) {
      console.warn('Markdown parsing error, sending as plain text');
      return await bot.sendMessage(chatId, message, {
        parse_mode: undefined,
        ...options
      });
    }
    console.error('Error sending message:', error.message);
    throw error;
  }
}

/**
 * Get chat information
 */
async function getChat(chatId) {
  try {
    return await bot.getChat(chatId);
  } catch (error) {
    console.error('Error getting chat:', error.message);
    return null;
  }
}

/**
 * Get chat member information
 */
async function getChatMember(chatId, userId) {
  try {
    return await bot.getChatMember(chatId, userId);
  } catch (error) {
    console.error('Error getting chat member:', error.message);
    return null;
  }
}

/**
 * Kick/ban a user from a chat (bot must be admin)
 */
async function kickChatMember(chatId, userId, untilDate = null) {
  try {
    // Convert userId to integer if it's a string
    const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
    
    console.log(`kickChatMember: Banning user ${userIdInt} from chat ${chatId}`);
    
    // Ban the user (this removes them from the chat if they're in it)
    const result = await bot.banChatMember(chatId, userIdInt);
    
    console.log(`kickChatMember: Ban successful, result:`, result);
    
    // If no untilDate specified, immediately unban them (this makes it a kick, not a permanent ban)
    if (untilDate === null) {
      // Wait a moment to ensure the ban takes effect, then unban
      // Use Promise-based delay instead of setTimeout for better reliability
      await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5 seconds
      
      try {
        console.log(`kickChatMember: Unbanning user ${userIdInt} from chat ${chatId}`);
        await bot.unbanChatMember(chatId, userIdInt);
        console.log(`kickChatMember: Unban successful`);
      } catch (e) {
        console.error('Error unbanning after kick:', e.message);
        // Don't throw - the ban still worked, unban is just a cleanup
        // The user is already removed from the chat, which is the main goal
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error kicking chat member:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

/**
 * Unban a user from a chat (bot must be admin)
 */
async function unbanChatMember(chatId, userId) {
  try {
    return await bot.unbanChatMember(chatId, userId);
  } catch (error) {
    console.error('Error unbanning chat member:', error.message);
    throw error;
  }
}

/**
 * Create an invite link for a chat (bot must be admin)
 */
async function createChatInviteLink(chatId, options = {}) {
  try {
    return await bot.createChatInviteLink(chatId, options);
  } catch (error) {
    console.error('Error creating invite link:', error.message);
    throw error;
  }
}

/**
 * Export chat invite link (if available)
 */
async function exportChatInviteLink(chatId) {
  try {
    return await bot.exportChatInviteLink(chatId);
  } catch (error) {
    console.error('Error exporting invite link:', error.message);
    return null;
  }
}

module.exports = {
  bot,
  sendMessage,
  getChat,
  getChatMember,
  kickChatMember,
  unbanChatMember,
  createChatInviteLink,
  exportChatInviteLink
};

