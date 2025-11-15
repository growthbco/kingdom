const ChatMessage = require('../models/ChatMessage');
const { Op } = require('sequelize');

/**
 * Store a chat message
 */
async function storeMessage(chatId, userId, username, messageText, messageId = null) {
  try {
    return await ChatMessage.create({
      chatId: chatId.toString(),
      userId,
      username,
      messageText,
      messageId: messageId?.toString()
    });
  } catch (error) {
    console.error('Error storing chat message:', error);
    // Don't throw - message storage shouldn't break main functionality
  }
}

/**
 * Get recent chat messages for a chat
 */
async function getRecentMessages(chatId, hours = 24, limit = 100) {
  try {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return await ChatMessage.findAll({
      where: {
        chatId: chatId.toString(),
        createdAt: {
          [Op.gte]: since
        }
      },
      order: [['createdAt', 'ASC']],
      limit
    });
  } catch (error) {
    console.error('Error getting recent messages:', error);
    return [];
  }
}

/**
 * Get chat messages since a specific time
 */
async function getMessagesSince(chatId, since, limit = 100) {
  try {
    return await ChatMessage.findAll({
      where: {
        chatId: chatId.toString(),
        createdAt: {
          [Op.gte]: since
        }
      },
      order: [['createdAt', 'ASC']],
      limit
    });
  } catch (error) {
    console.error('Error getting messages since:', error);
    return [];
  }
}

/**
 * Get previous recap summary if available (for context to avoid repetition)
 * This is a placeholder - in a real implementation, you might store recap summaries
 */
async function getPreviousRecapSummary(chatId, lastRecapTime) {
  // For now, return null - we'll rely on the time-based filtering
  // In the future, you could store recap summaries and retrieve them here
  return null;
}

module.exports = {
  storeMessage,
  getRecentMessages,
  getMessagesSince,
  getPreviousRecapSummary
};


