const protectionService = require('../services/protectionService');
const roleService = require('../services/roleService');
const { sendMessage } = require('../bot/telegramBot');
const activityService = require('../services/activityService');

/**
 * Activate cloak of protection for a user (admin only)
 */
async function cloakOfProtection(args, context) {
  const { senderId, user, message, chatId } = context;
  
  // Check permissions - only admin can use this
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can use cloak of protection.";
  }
  
  // Check if message is a reply
  let targetUserId = null;
  let targetUsername = null;
  
  if (message.reply_to_message && message.reply_to_message.from) {
    targetUserId = message.reply_to_message.from.id.toString();
    targetUsername = message.reply_to_message.from.username || 
                     message.reply_to_message.from.first_name ||
                     `User_${targetUserId}`;
  } else if (args.length > 0) {
    const mention = args[0];
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    const targetUser = await roleService.getUserByName(username);
    if (!targetUser) {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
    }
    targetUserId = targetUser.messengerId;
    targetUsername = targetUser.name;
  } else {
    return "❌ Usage: /cloakofprotection @user or reply to a message with /cloakofprotection";
  }
  
  try {
    const targetUser = await roleService.createOrUpdateUser(
      targetUserId,
      targetUsername,
      message.chat.id.toString()
    );
    
    // Activate protection
    const protection = await protectionService.activateProtection(targetUser.id, user.id);
    
    // Get protector info
    const protector = await roleService.getUserByMessengerId(user.messengerId);
    
    const userMention = `<a href="tg://user?id=${user.messengerId}">${user.name}</a>`;
    const targetMention = `<a href="tg://user?id=${targetUser.messengerId}">${targetUser.name}</a>`;
    
    const announcement = `🛡️ <b>CLOAK OF PROTECTION ACTIVATED!</b> 🛡️\n\n` +
      `${targetMention} has been granted protection by ${userMention}!\n\n` +
      `🛡️ <b>Protected from all attacks for 24 hours!</b>\n` +
      `⚠️ Note: Protection does NOT prevent disrespect penalties toward the King/Queen.\n\n` +
      `⏰ Protection expires: ${protection.expiresAt.toLocaleString()}`;
    
    await sendMessage(chatId, announcement, { parse_mode: 'HTML' });
    
    // Log activity
    await activityService.logActivity('protection_activated', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { 
        expiresAt: protection.expiresAt,
        duration: '24 hours'
      },
      chatId: chatId
    });
    
    return `✅ Cloak of protection activated for ${targetUser.name}!`;
  } catch (error) {
    console.error('Error activating protection:', error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Check protection status for a user
 */
async function checkProtection(args, context) {
  const { senderId, user, message } = context;
  
  let targetUserId = null;
  
  if (message.reply_to_message && message.reply_to_message.from) {
    targetUserId = message.reply_to_message.from.id.toString();
  } else if (args.length > 0) {
    const mention = args[0];
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    const targetUser = await roleService.getUserByName(username);
    if (!targetUser) {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found.`;
    }
    targetUserId = targetUser.messengerId;
  } else {
    // Default to checking yourself
    targetUserId = user.messengerId;
  }
  
  try {
    const targetUser = await roleService.getUserByMessengerId(targetUserId);
    if (!targetUser) {
      return `❌ Target user not found.`;
    }
    
    const protection = await protectionService.getActiveProtection(targetUser.id);
    
    if (!protection) {
      return `${targetUser.name} is not currently protected.`;
    }
    
    const remainingMs = await protectionService.getRemainingTime(targetUser.id);
    const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
    const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    
    const User = require('../models/User');
    const protector = await User.findByPk(protection.protectedBy);
    const protectorName = protector ? protector.name : 'Unknown';
    
    return `🛡️ <b>Protection Status</b>\n\n` +
           `User: ${targetUser.name}\n` +
           `Protected by: ${protectorName}\n` +
           `Time remaining: ${remainingHours}h ${remainingMinutes}m\n` +
           `Expires: ${protection.expiresAt.toLocaleString()}`;
  } catch (error) {
    console.error('Error checking protection:', error);
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  cloakOfProtection,
  checkProtection
};

