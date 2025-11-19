const shieldService = require('../services/shieldService');
const bombAttackService = require('../services/bombAttackService');
const ticketService = require('../services/ticketService');
const roleService = require('../services/roleService');
const activityService = require('../services/activityService');
const User = require('../models/User');

/**
 * Award shields to a user (admin only)
 */
async function awardShield(args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can award shields.";
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
    return "❌ Usage: /awardshield @user <amount> <reason> or reply to a message with /awardshield <amount> <reason>";
  }
  
  // Parse arguments
  let amount, reason;
  
  if (targetUserId) {
    // Reply mode: /awardshield <amount> <reason>
    amount = parseInt(args[0]?.replace(/🛡️/g, '').trim());
    reason = args.slice(1).join(' ') || 'No reason provided';
  } else {
    // Mention mode: /awardshield @user <amount> <reason>
    const amountIndex = args.findIndex((arg, idx) => idx > 0 && !isNaN(parseInt(arg.replace(/🛡️/g, ''))));
    if (amountIndex === -1) {
      return "❌ Could not find amount. Usage: /awardshield @user <amount> <reason>";
    }
    amount = parseInt(args[amountIndex].replace(/🛡️/g, '').trim());
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
    
    await shieldService.awardShield(targetUser.id, amount, user.id, reason);
    const shieldCount = await shieldService.getShieldCount(targetUser.id);
    
    // Log activity
    await activityService.logActivity('shield_awarded', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { amount, reason },
      chatId: message.chat.id.toString()
    });
    
    return `✅ Awarded ${amount} 🛡️ to ${targetUser.name}!\nReason: ${reason}\nNew shield count: ${shieldCount} 🛡️`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Block a recent bomb attack using a shield
 */
async function blockShield(context) {
  const { user, message } = context;
  
  try {
    // Check if user has shields
    const shieldCount = await shieldService.getShieldCount(user.id);
    if (shieldCount < 1) {
      return "❌ You don't have any shields! Use /shield to check your shield count.";
    }
    
    // Check for recent bomb attack
    const attack = bombAttackService.getRecentAttack(user.id);
    
    if (!attack) {
      return "❌ No recent bomb attack found. You can only block bomb attacks within 2 minutes of being bombed.";
    }
    
    // Check remaining time
    const remainingSeconds = bombAttackService.getRemainingTime(user.id);
    
    // Use shield to block
    const shieldUsed = await shieldService.useShield(user.id);
    
    if (!shieldUsed) {
      return "❌ Failed to use shield. Please try again.";
    }
    
    // Get attacker info before restoring tickets
    const attacker = await User.findByPk(attack.attackerId);
    const attackerName = attacker ? attacker.name : 'Unknown';
    
    // Restore tickets
    await ticketService.awardTickets(
      user.id,
      attack.ticketsLost,
      user.id,
      `Shield blocked bomb attack from ${attackerName}`
    );
    
    // Remove attack from tracking
    bombAttackService.blockAttack(user.id);
    
    // Log activity
    await activityService.logActivity('shield_blocked_bomb', {
      userId: user.id,
      targetUserId: attack.attackerId,
      details: { 
        ticketsRestored: attack.ticketsLost,
        reason: attack.reason,
        remainingTime: remainingSeconds
      },
      chatId: message.chat.id.toString()
    });
    
    const newBalance = await ticketService.getBalance(user.id);
    const newShieldCount = await shieldService.getShieldCount(user.id);
    
    return `🛡️ **BOMB BLOCKED!** 🛡️\n\n` +
           `You successfully blocked the bomb attack from ${attackerName}!\n\n` +
           `✅ Restored ${attack.ticketsLost} 🎫\n` +
           `Your balance: ${newBalance} 🎫\n` +
           `Remaining shields: ${newShieldCount} 🛡️`;
  } catch (error) {
    console.error('Error blocking shield:', error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Check shield status and recent attacks
 */
async function shieldStatus(context) {
  const { user } = context;
  
  try {
    const shieldCount = await shieldService.getShieldCount(user.id);
    const attack = bombAttackService.getRecentAttack(user.id);
    
    let message = `🛡️ **Shield Status**\n\n` +
                  `${user.name}, you have ${shieldCount} 🛡️ shield${shieldCount !== 1 ? 's' : ''}.\n\n`;
    
    if (attack) {
      const remainingSeconds = bombAttackService.getRemainingTime(user.id);
      message += `⚠️ **Recent Bomb Attack Detected!**\n\n` +
                 `You lost ${attack.ticketsLost} 🎫 from a bomb attack!\n` +
                 `Time remaining to block: ${remainingSeconds} seconds\n` +
                 `Use /blockbomb to block this attack and restore your tickets!`;
    } else {
      message += `Use /blockbomb within 2 minutes of being bombed to block the attack and restore your tickets!`;
    }
    
    return message;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  awardShield,
  blockShield,
  shieldStatus
};

