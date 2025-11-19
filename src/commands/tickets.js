const ticketService = require('../services/ticketService');
const bombService = require('../services/bombService');
const roleService = require('../services/roleService');
const activityService = require('../services/activityService');
const { sendMessage } = require('../bot/telegramBot');
const TicketTransaction = require('../models/TicketTransaction');
const User = require('../models/User');
const RedemptionAction = require('../models/RedemptionAction');

/**
 * Award tickets to a user
 */
async function award(args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can award tickets.";
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
  
  if (args.length < 2 && !targetUserId) {
    return "❌ Usage: /award @user <amount> <reason> or reply to a message with /award <amount> <reason>";
  }
  
  // Parse arguments - detect if awarding tickets or bombs
  let amount, reason, itemType = 'ticket'; // default to ticket
  
  // Check for bomb emoji or word "bomb" in the arguments
  const allArgsText = args.join(' ').toLowerCase();
  const hasBombEmoji = allArgsText.includes('💣');
  const hasBombWord = allArgsText.includes('bomb');
  
  if (hasBombEmoji || hasBombWord) {
    itemType = 'bomb';
  }
  
  if (targetUserId) {
    // Reply mode: /award <amount> <reason>
    if (itemType === 'bomb') {
      amount = parseInt(args[0]?.replace(/💣/g, '').trim());
    } else {
      amount = parseInt(args[0]?.replace(/🎫/g, '').trim());
    }
    reason = args.slice(1).join(' ') || 'No reason provided';
  } else {
    // Mention mode: /award @user <amount> <reason>
    let amountIndex = -1;
    if (itemType === 'bomb') {
      amountIndex = args.findIndex((arg, idx) => idx > 0 && !isNaN(parseInt(arg.replace(/💣/g, ''))));
    } else {
      amountIndex = args.findIndex((arg, idx) => idx > 0 && !isNaN(parseInt(arg.replace(/🎫/g, ''))));
    }
    
    if (amountIndex === -1) {
      // Try without emoji removal
      amountIndex = args.findIndex((arg, idx) => idx > 0 && !isNaN(parseInt(arg)));
    }
    
    if (amountIndex === -1) {
      return "❌ Could not find amount. Usage: /award @user <amount> <reason> or /award @user <amount> 💣 <reason>";
    }
    
    if (itemType === 'bomb') {
      amount = parseInt(args[amountIndex].replace(/💣/g, '').trim());
    } else {
      amount = parseInt(args[amountIndex].replace(/🎫/g, '').trim());
    }
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
    
    if (itemType === 'bomb') {
      // Award bomb
      await bombService.awardBomb(targetUser.id, amount, user.id, reason);
      const bombCount = await bombService.getBombCount(targetUser.id);
      const ticketBalance = await ticketService.getBalance(targetUser.id);
      
      // Log activity
      await activityService.logActivity('bomb_awarded', {
        userId: user.id,
        targetUserId: targetUser.id,
        details: { amount, reason },
        chatId: message.chat.id.toString()
      });
      
      return `✅ Awarded ${amount} 💣 to ${targetUser.name}!\nReason: ${reason}\nNew balance: ${ticketBalance} 🎫 and ${bombCount} 💣`;
    } else {
      // Award tickets
      await ticketService.awardTickets(targetUser.id, amount, user.id, reason);
      const ticketBalance = await ticketService.getBalance(targetUser.id);
      const bombCount = await bombService.getBombCount(targetUser.id);
      
      // Log activity
      await activityService.logActivity('ticket_awarded', {
        userId: user.id,
        targetUserId: targetUser.id,
        details: { amount, reason },
        chatId: message.chat.id.toString()
      });
      
      let balanceText = `New balance: ${ticketBalance} 🎫`;
      if (bombCount > 0) {
        balanceText += ` and ${bombCount} 💣`;
      }
      
      return `✅ Awarded ${amount} 🎫 to ${targetUser.name}!\nReason: ${reason}\n${balanceText}`;
    }
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Deduct/remove tickets from a user
 */
async function deduct(args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can deduct tickets.";
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
  
  if (args.length < 2 && !targetUserId) {
    return "❌ Usage: /deduct @user <amount> <reason> or reply to a message with /deduct <amount> <reason>";
  }
  
  // Parse arguments
  let amount, reason;
  
  if (targetUserId) {
    // Reply mode: /deduct <amount> <reason>
    amount = parseInt(args[0]?.replace(/🎫/g, '').trim());
    reason = args.slice(1).join(' ') || 'No reason provided';
  } else {
    // Mention mode: /deduct @user <amount> <reason>
    const amountIndex = args.findIndex((arg, idx) => idx > 0 && !isNaN(parseInt(arg.replace(/🎫/g, ''))));
    
    if (amountIndex === -1) {
      // Try without emoji removal
      const amountIndexAlt = args.findIndex((arg, idx) => idx > 0 && !isNaN(parseInt(arg)));
      if (amountIndexAlt === -1) {
        return "❌ Could not find amount. Usage: /deduct @user <amount> <reason>";
      }
      amount = parseInt(args[amountIndexAlt]);
      reason = args.slice(amountIndexAlt + 1).join(' ') || 'No reason provided';
    } else {
      amount = parseInt(args[amountIndex].replace(/🎫/g, '').trim());
      reason = args.slice(amountIndex + 1).join(' ') || 'No reason provided';
    }
    
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
    
    // Check current balance
    const currentBalance = await ticketService.getBalance(targetUser.id);
    const deductAmount = Math.min(amount, currentBalance); // Don't deduct more than they have
    
    if (deductAmount === 0) {
      return `❌ ${targetUser.name} has no tickets to deduct.`;
    }
    
    // Deduct tickets (using negative amount)
    await ticketService.awardTickets(targetUser.id, -deductAmount, user.id, reason);
    const ticketBalance = await ticketService.getBalance(targetUser.id);
    const bombCount = await bombService.getBombCount(targetUser.id);
    
    // Log activity
    await activityService.logActivity('ticket_deducted', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { amount: deductAmount, reason },
      chatId: message.chat.id.toString()
    });
    
    let balanceText = `New balance: ${ticketBalance} 🎫`;
    if (bombCount > 0) {
      balanceText += ` and ${bombCount} 💣`;
    }
    
    let messageText = `✅ Deducted ${deductAmount} 🎫 from ${targetUser.name}!\nReason: ${reason}\n${balanceText}`;
    
    if (deductAmount < amount) {
      messageText += `\n⚠️ Note: Only ${deductAmount} tickets were deducted (user had ${currentBalance} tickets).`;
    }
    
    return messageText;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Award tickets from natural language
 */
async function awardFromNaturalLanguage(text, context) {
  const { senderId, user, message } = context;
  
  // Check permissions
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can award tickets.";
  }
  
  // Extract amount and mention from text
  const amountMatch = text.match(/(\d+)\s*🎫/);
  const mentionMatch = text.match(/@(\w+)/);
  
  if (!amountMatch) {
    return "❌ Could not parse amount. Try: /award @user 5 reason";
  }
  
  const amount = parseInt(amountMatch[1]);
  let targetUserId = null;
  let targetUsername = null;
  
  // Check reply first
  if (message.reply_to_message && message.reply_to_message.from) {
    targetUserId = message.reply_to_message.from.id.toString();
    targetUsername = message.reply_to_message.from.username || 
                     message.reply_to_message.from.first_name ||
                     `User_${targetUserId}`;
  } else if (mentionMatch) {
    const username = mentionMatch[1];
    const targetUser = await roleService.getUserByMessengerId(username);
    if (!targetUser) {
      return `❌ User @${username} not found. They need to send a message in the chat first.`;
    }
    targetUserId = targetUser.messengerId;
    targetUsername = targetUser.name;
  } else {
    return "❌ Could not find user. Mention them with @username or reply to their message.";
  }
  
  const reason = text.replace(amountMatch[0], '').replace(mentionMatch?.[0] || '', '').trim() || 'No reason provided';
  
  try {
    const targetUser = await roleService.createOrUpdateUser(
      targetUserId,
      targetUsername,
      message.chat.id.toString()
    );
    
    await ticketService.awardTickets(targetUser.id, amount, user.id, reason);
    const balance = await ticketService.getBalance(targetUser.id);
    
    return `✅ Awarded ${amount} 🎫 to ${targetUser.name}!\nReason: ${reason}\nNew balance: ${balance} 🎫`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Get user's ticket balance
 */
async function balance(context) {
  const { senderId, user } = context;
  
  try {
    const ticketBalance = await ticketService.getBalance(user.id);
    const bombCount = await bombService.getBombCount(user.id);
    
    const parts = [];
    parts.push(`${ticketBalance} 🎫`);
    if (bombCount > 0) {
      parts.push(`${bombCount} 💣`);
    }
    
    return `You have: ${parts.join(' and ')}`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Get transaction history
 */
async function history(args, context) {
  const { senderId, user, message } = context;
  
  let targetUser = user;
  
  // Check if viewing someone else's history (admin only)
  if (message.reply_to_message && message.reply_to_message.from) {
    const canAdmin = await roleService.canPerformAdminAction(user.id);
    if (!canAdmin) {
      return "❌ Only Enforcer and King/Queen can view other users' history.";
    }
    
    const targetUserId = message.reply_to_message.from.id.toString();
    const targetUsername = message.reply_to_message.from.username || 
                           message.reply_to_message.from.first_name ||
                           `User_${targetUserId}`;
    const foundUser = await roleService.createOrUpdateUser(
      targetUserId,
      targetUsername,
      message.chat.id.toString()
    );
    targetUser = foundUser;
  } else if (args.length > 0) {
    const canAdmin = await roleService.canPerformAdminAction(user.id);
    if (!canAdmin) {
      return "❌ Only Enforcer and King/Queen can view other users' history.";
    }
    
    const mention = args[0];
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    const foundUser = await roleService.getUserByName(username);
    if (!foundUser) {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found.`;
    }
    targetUser = foundUser;
  }
  
  try {
    const transactions = await ticketService.getHistory(targetUser.id, 10);
    
    if (transactions.length === 0) {
      return `📜 No transaction history for ${targetUser.name}.`;
    }
    
    let message = `📜 Transaction history for ${targetUser.name}:\n\n`;
    
    transactions.forEach((tx, idx) => {
      const sign = tx.amount > 0 ? '+' : '';
      const emoji = tx.type === 'award' ? '🎁' : '💸';
      const action = tx.action ? ` (${tx.action.actionName})` : '';
      const awarder = tx.awarder ? ` by ${tx.awarder.name}` : '';
      const reason = tx.reason ? ` - ${tx.reason}` : '';
      
      message += `${emoji} ${sign}${tx.amount} 🎫${action}${awarder}${reason}\n`;
      message += `   ${new Date(tx.timestamp).toLocaleString()}\n\n`;
    });
    
    const balance = await ticketService.getBalance(targetUser.id);
    message += `Current balance: ${balance} 🎫`;
    
    return message;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Redeem tickets for an action
 */
async function redeem(args, context) {
  const { senderId, user, message } = context;
  
  if (args.length === 0) {
    return "❌ Usage: /redeem <action name> or type /actions to see available actions.";
  }
  
  const actionName = args.join(' ');
  
  try {
    // Find action (case-insensitive for SQLite compatibility)
    const actions = await RedemptionAction.findAll({
      where: { isActive: true }
    });
    
    const action = actions.find(a => 
      a.actionName.toLowerCase() === actionName.toLowerCase()
    );
    
    if (!action) {
      return `❌ Action "${actionName}" not found. Type /actions to see available actions.`;
    }
    
    // Special handling for Kill action
    if (action.actionName.toLowerCase() === 'kill') {
      const assassinationCommands = require('../commands/assassination');
      // Pass remaining args (target user if specified) and actionId
      const targetArgs = args.slice(1); // Remove "kill" from args
      return await assassinationCommands.assassinatePowerUser(targetArgs, context, action.id);
    }
    
    const result = await ticketService.redeemTickets(user.id, action.id);
    const balance = await ticketService.getBalance(user.id);
    
    // Log activity
    await activityService.logActivity('ticket_redeemed', {
      userId: user.id,
      details: { actionName: action.actionName, cost: action.ticketCost },
      chatId: message.chat.id.toString()
    });
    
    return `✅ Redeemed "${action.actionName}" for ${action.ticketCost} 🎫!\n${action.description}\nRemaining balance: ${balance} 🎫`;
  } catch (error) {
    return `❌ ${error.message}`;
  }
}

/**
 * Spend tickets directly (subtract from balance)
 */
async function spend(args, context) {
  const { senderId, user, message } = context;
  
  if (args.length < 1) {
    return "❌ Usage: /spend <amount> <reason>";
  }
  
  const amount = parseInt(args[0]?.replace(/🎫/g, '').trim());
  const reason = args.slice(1).join(' ') || 'No reason provided';
  
  if (isNaN(amount) || amount < 1) {
    return "❌ Amount must be a positive number.";
  }
  
  try {
    const balance = await ticketService.getBalance(user.id);
    
    if (balance < amount) {
      return `❌ Insufficient tickets. You have ${balance} 🎫, trying to spend ${amount} 🎫`;
    }
    
    // Create a transaction to subtract tickets (negative amount)
    const transaction = await TicketTransaction.create({
      userId: user.id,
      amount: -amount,
      type: 'redeem',
      awardedBy: user.id,
      reason: reason || 'Manual spend'
    });
    
    const newBalance = await ticketService.getBalance(user.id);
    
    // Log activity
    await activityService.logActivity('ticket_redeemed', {
      userId: user.id,
      details: { actionName: 'Manual Spend', cost: amount, reason },
      chatId: message.chat.id.toString()
    });
    
    return `💸 Spent ${amount} 🎫\nReason: ${reason}\nRemaining balance: ${newBalance} 🎫`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Give tickets as a gift to another user (max 10 per day)
 */
async function give(args, context) {
  const { senderId, user, message } = context;
  
  const MAX_GIFTS_PER_DAY = 10;
  
  if (args.length < 2) {
    return "❌ Usage: /give @user <amount> or reply to a message with /give <amount>";
  }
  
  let targetUserId = null;
  let targetUsername = null;
  let amount = 0;
  
  // Check if message is a reply
  if (message.reply_to_message && message.reply_to_message.from) {
    targetUserId = message.reply_to_message.from.id.toString();
    targetUsername = message.reply_to_message.from.username || 
                     message.reply_to_message.from.first_name ||
                     `User_${targetUserId}`;
    amount = parseInt(args[0]?.replace(/🎫/g, '').trim());
  } else if (args.length >= 2) {
    const mention = args[0];
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    const targetUser = await roleService.getUserByName(username);
    if (!targetUser) {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
    }
    targetUserId = targetUser.messengerId;
    targetUsername = targetUser.name;
    amount = parseInt(args[1]?.replace(/🎫/g, '').trim());
  }
  
  if (isNaN(amount) || amount < 1) {
    return "❌ Amount must be a positive number.";
  }
  
  if (amount > MAX_GIFTS_PER_DAY) {
    return `❌ Maximum gift amount is ${MAX_GIFTS_PER_DAY} tickets per day.`;
  }
  
  try {
    const targetUser = await roleService.createOrUpdateUser(
      targetUserId,
      targetUsername,
      message.chat.id.toString()
    );
    
    // Can't give to yourself
    if (targetUser.id === user.id) {
      return "❌ You cannot give tickets to yourself!";
    }
    
    // Check sender's balance
    const senderBalance = await ticketService.getBalance(user.id);
    if (senderBalance < amount) {
      return `❌ Insufficient tickets. You have ${senderBalance} 🎫, trying to give ${amount} 🎫`;
    }
    
    // Check daily gift limit
    const automatedRewardsService = require('../services/automatedRewardsService');
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const activity = await automatedRewardsService.getOrCreateDailyActivity(
      user.id,
      message.chat.id.toString(),
      dateStr
    );
    
    // Calculate how much they've given today
    const TicketTransaction = require('../models/TicketTransaction');
    const { Op } = require('sequelize');
    const todayStart = new Date(dateStr + 'T00:00:00Z');
    const todayEnd = new Date(dateStr + 'T23:59:59Z');
    
    const todayGifts = await TicketTransaction.findAll({
      where: {
        userId: user.id,
        reason: {
          [Op.like]: 'Gift to%'
        },
        timestamp: {
          [Op.between]: [todayStart, todayEnd]
        }
      }
    });
    
    const totalGivenToday = todayGifts.reduce((sum, tx) => {
      // Only count negative amounts (gifts are negative for giver)
      return sum + (tx.amount < 0 ? Math.abs(tx.amount) : 0);
    }, 0);
    
    if (totalGivenToday + amount > MAX_GIFTS_PER_DAY) {
      const remaining = MAX_GIFTS_PER_DAY - totalGivenToday;
      return `❌ Daily gift limit reached! You've given ${totalGivenToday}/${MAX_GIFTS_PER_DAY} tickets today. You can give ${remaining} more ticket${remaining !== 1 ? 's' : ''} today.`;
    }
    
    // Transfer tickets (subtract from sender, add to receiver)
    await ticketService.awardTickets(user.id, -amount, user.id, `Gift to ${targetUser.name}`);
    await ticketService.awardTickets(targetUser.id, amount, user.id, `Gift from ${user.name}`);
    
    const senderNewBalance = await ticketService.getBalance(user.id);
    const receiverNewBalance = await ticketService.getBalance(targetUser.id);
    
    // Log activity
    await activityService.logActivity('ticket_gift', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { amount },
      chatId: message.chat.id.toString()
    });
    
    // Notify receiver
    try {
      await sendMessage(message.chat.id.toString(),
        `🎁 ${user.name} gave ${amount} 🎫 to ${targetUser.name}!\n` +
        `${targetUser.name}'s new balance: ${receiverNewBalance} 🎫`
      );
    } catch (error) {
      // Fallback to returning message
    }
    
    return `✅ You gave ${amount} 🎫 to ${targetUser.name}!\n` +
           `Your remaining balance: ${senderNewBalance} 🎫\n` +
           `Daily gifts remaining: ${MAX_GIFTS_PER_DAY - totalGivenToday - amount}/${MAX_GIFTS_PER_DAY}`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  award,
  deduct,
  awardFromNaturalLanguage,
  balance,
  history,
  redeem,
  spend,
  give
};

