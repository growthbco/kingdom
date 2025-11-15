const Group = require('../models/Group');

/**
 * Get jail chat ID (returns the prison chat ID)
 */
async function getJailChatId(mainChatId) {
  try {
    // Find any prison chat (for now, we'll use the most recent one)
    // In the future, you could link main chats to specific prison chats
    const prisonGroup = await Group.findOne({
      where: {
        type: 'prison'
      },
      order: [['createdAt', 'DESC']]
    });

    return prisonGroup ? prisonGroup.messengerGroupId : null;
  } catch (error) {
    console.error('Error getting jail chat ID:', error);
    return null;
  }
}

/**
 * Set jail chat ID (sets the current chat as the prison chat)
 */
async function setJailChat(jailChatId, jailChatName = null) {
  try {
    // Get or create prison group
    const [prisonGroup, created] = await Group.findOrCreate({
      where: {
        messengerGroupId: jailChatId,
        type: 'prison'
      },
      defaults: {
        groupName: jailChatName || 'Prison Chat'
      }
    });

    if (jailChatName && prisonGroup.groupName !== jailChatName) {
      prisonGroup.groupName = jailChatName;
      await prisonGroup.save();
    }

    return prisonGroup;
  } catch (error) {
    console.error('Error setting jail chat:', error);
    throw error;
  }
}

/**
 * Remove/unset jail chat configuration
 */
async function removeJailChat(chatId = null) {
  try {
    if (chatId) {
      // Remove specific chat from jail configuration
      const deleted = await Group.destroy({
        where: {
          messengerGroupId: chatId.toString(),
          type: 'prison'
        }
      });
      return deleted > 0;
    } else {
      // Remove all jail chat configurations
      const deleted = await Group.destroy({
        where: {
          type: 'prison'
        }
      });
      return deleted > 0;
    }
  } catch (error) {
    console.error('Error removing jail chat:', error);
    throw error;
  }
}

/**
 * Check if a chat is a jail/prison chat
 */
async function isJailChat(chatId) {
  try {
    const prisonGroup = await Group.findOne({
      where: {
        messengerGroupId: chatId.toString(),
        type: 'prison'
      }
    });
    return prisonGroup !== null;
  } catch (error) {
    console.error('Error checking if chat is jail chat:', error);
    return false;
  }
}

module.exports = {
  getJailChatId,
  setJailChat,
  removeJailChat,
  isJailChat
};

