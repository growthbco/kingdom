const bombService = require('../services/bombService');
const roleService = require('../services/roleService');
const activityService = require('../services/activityService');
const ticketService = require('../services/ticketService');

/**
 * Award bombs to a user (admin only)
 */
async function awardBomb(args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can award bombs.";
  }
  
  // Check if message is a reply
  let targetUserId = null;
  let targetUsername = null;
  
  if (message.reply_to_message && message.reply_to_message.from) {
    targetUserId = message.reply_to_message.from.id.toString();
    targetUsername = message.reply_to_message.from.username || 
                     message.reply_to_message.from.first_name ||
                     `User_${targetUserId}`;
  }
  
  if (args.length < 1 && !targetUserId) {
    return "❌ Usage: /awardbomb @user <amount> <reason> or reply to a message with /awardbomb <amount> <reason>";
  }
  
  // Parse arguments
  let amount, reason;
  
  if (targetUserId) {
    // Reply mode: /awardbomb <amount> <reason>
    amount = parseInt(args[0]?.replace(/💣/g, '').trim());
    reason = args.slice(1).join(' ') || 'No reason provided';
  } else {
    // Mention mode: /awardbomb @user <amount> <reason>
    const amountIndex = args.findIndex((arg, idx) => idx > 0 && !isNaN(parseInt(arg.replace(/💣/g, ''))));
    if (amountIndex === -1) {
      return "❌ Could not find amount. Usage: /awardbomb @user <amount> <reason>";
    }
    amount = parseInt(args[amountIndex].replace(/💣/g, '').trim());
    reason = args.slice(amountIndex + 1).join(' ') || 'No reason provided';
    
    // Get user from mention (accepts both @username and username)
    const mention = args[0];
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    const targetUser = await roleService.getUserByName(username);
    if (!targetUser) {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
    }
    targetUserId = targetUser.messengerId;
    targetUsername = targetUser.name;
  }
  
  if (isNaN(amount) || amount < 1) {
    return "❌ Amount must be a positive number.";
  }
  
  try {
    const targetUser = await roleService.createOrUpdateUser(
      targetUserId,
      targetUsername,
      message.chat.id.toString()
    );
    
    await bombService.awardBomb(targetUser.id, amount, user.id, reason);
    const bombCount = await bombService.getBombCount(targetUser.id);
    
    // Log activity
    await activityService.logActivity('bomb_awarded', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { amount, reason },
      chatId: message.chat.id.toString()
    });
    
    return `✅ Awarded ${amount} 💣 to ${targetUser.name}!\nReason: ${reason}\nNew bomb count: ${bombCount} 💣`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Use a bomb on someone (eliminates up to 5 tickets)
 */
async function useBomb(args, context) {
  const { senderId, user, message } = context;
  
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
    return "❌ Usage: /bomb @user <reason> or reply to a message with /bomb <reason>";
  }
  
  const reason = args.length > 1 ? args.slice(1).join(' ') : (args.length === 1 && !message.reply_to_message ? args[0] : 'No reason provided');
  
  try {
    const targetUser = await roleService.createOrUpdateUser(
      targetUserId,
      targetUsername,
      message.chat.id.toString()
    );
    
    // Can't bomb yourself
    if (targetUser.id === user.id) {
      return "❌ You can't bomb yourself!";
    }
    
    const result = await bombService.useBomb(user.id, targetUser.id, reason);
    
    // Log activity
    await activityService.logActivity('bomb_used', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { ticketsEliminated: result.ticketsEliminated, reason },
      chatId: message.chat.id.toString()
    });
    
    return `💣 **BOMB DROPPED!**\n\n` +
           `${user.name} used a bomb on ${targetUser.name}!\n` +
           `💥 Eliminated ${result.ticketsEliminated} 🎫\n` +
           `${targetUser.name}'s new balance: ${result.targetBalance} 🎫\n` +
           `${user.name}'s remaining bombs: ${result.remainingBombs} 💣`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  awardBomb,
  useBomb
};






