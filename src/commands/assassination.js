const ticketService = require('../services/ticketService');
const roleService = require('../services/roleService');
const activityService = require('../services/activityService');
const assassinationService = require('../services/assassinationService');
const shieldService = require('../services/shieldService');
const { sendMessage } = require('../bot/telegramBot');
const User = require('../models/User');

const ASSASSINATION_COST = 100; // King/Queen assassination cost
const ASSASSINATION_REDEMPTION_COST = 50; // Redemption action cost for guards/lawyers/etc.
const GUARD_REWARD = 25;

/**
 * Assassinate the King/Queen (with guard blocking system)
 * Original function - unchanged
 */
async function assassinate(args, context) {
  const { senderId, user, message } = context;
  const chatId = message.chat.id.toString();
  
  try {
    // Check if there's already an active attempt
    if (assassinationService.hasActiveAttempt(chatId)) {
      return "❌ There is already an active assassination attempt in progress. Please wait for it to complete.";
    }
    
    // Check balance
    const balance = await ticketService.getBalance(user.id);
    if (balance < ASSASSINATION_COST) {
      return `❌ Insufficient tickets! Assassination costs ${ASSASSINATION_COST} 🎫, but you only have ${balance} 🎫.`;
    }
    
    // Find current King or Queen
    const monarchs = await User.findAll({
      where: {
        role: {
          [require('sequelize').Op.in]: ['king', 'queen']
        }
      }
    });
    
    if (monarchs.length === 0) {
      return "❌ There is no King or Queen to assassinate.";
    }
    
    // Can't assassinate yourself
    const targetMonarch = monarchs.find(m => m.id === user.id);
    if (targetMonarch) {
      return "❌ You cannot assassinate yourself!";
    }
    
    // Use first monarch found (or could randomize)
    const victim = monarchs[0];
    
    // Check for guards
    const guards = await User.findAll({
      where: {
        role: 'guard',
        currentGroupId: chatId
      }
    });
    
    // Deduct tickets immediately (will refund if blocked)
    await ticketService.awardTickets(
      user.id,
      -ASSASSINATION_COST,
      user.id,
      `Assassination attempt on ${victim.name} (${victim.role})`
    );
    
    // Start the attempt (mark as king/queen assassination - guard-based)
    const attemptStarted = assassinationService.startAttempt(chatId, user.id, victim.id, true);
    
    if (!attemptStarted) {
      // Refund if couldn't start
      await ticketService.awardTickets(user.id, ASSASSINATION_COST, user.id, 'Refund - attempt failed');
      return "❌ Could not start assassination attempt. Please try again.";
    }
    
    // Announce the attempt (tag the victim using HTML mention)
    const victimMention = `<a href="tg://user?id=${victim.messengerId}">${victim.name}</a>`;
    let announcement = `⚔️ <b>ASSASSINATION ATTEMPT!</b> ⚔️\n\n` +
      `${victimMention} - An assassin has paid ${ASSASSINATION_COST} 🎫 to eliminate you (${victim.role === 'king' ? 'King' : 'Queen'})!\n\n`;
    
    if (guards.length > 0) {
      const guardNames = guards.map(g => g.name).join(', ');
      announcement += `🛡️ <b>GUARDS!</b> ${guardNames} - You have 90 seconds to block this attempt!\n` +
        `Use /block to stop the assassination!\n\n`;
    } else {
      announcement += `⚠️ No guards are present. The assassination will proceed in 90 seconds...\n\n`;
    }
    
    announcement += `⏰ <b>90 seconds</b> to block...`;
    
    await sendMessage(chatId, announcement, { parse_mode: 'HTML' });
    
    // Set up background timer to check if attempt succeeds after 90 seconds
    // If blocked, the block command will handle refunds and remove the attempt
    const timerId = setTimeout(async () => {
      const attempt = assassinationService.getActiveAttempt(chatId);
      
      // Only proceed if attempt still exists (wasn't blocked) and matches this assassin
      if (attempt && attempt.assassinId === user.id && attempt.victimId === victim.id) {
        // Remove the attempt
        assassinationService.cancelAttempt(chatId);
        
        // Promote assassin to the victim's role
        const newRole = victim.role === 'king' ? 'king' : 'queen';
        await roleService.setUserRole(user.id, newRole);
        
        // Demote the monarch to peasant
        await roleService.setUserRole(victim.id, 'peasant');
        
        // Log activity
        await activityService.logActivity('assassination', {
          userId: user.id,
          targetUserId: victim.id,
          details: { 
            victimRole: victim.role,
            cost: ASSASSINATION_COST,
            assassinAnonymous: false,
            blocked: false,
            assassinName: user.name
          },
          chatId: chatId
        });
        
        // Send dramatic announcement
        const successAnnouncement = `⚔️ <b>THE KING IS DEAD!</b> ⚔️\n\n` +
          `${victim.name} (${victim.role === 'king' ? 'King' : 'Queen'}) has been assassinated!\n\n` +
          `The guards failed to respond in time...\n` +
          `${user.name} is now the new ${newRole === 'king' ? 'King' : 'Queen'}!\n` +
          `The throne has been claimed!`;
        
        await sendMessage(chatId, successAnnouncement, { parse_mode: 'HTML' });
        
        // Notify the victim (tag them using HTML mention)
        const victimMention = `<a href="tg://user?id=${victim.messengerId}">${victim.name}</a>`;
        try {
          await sendMessage(chatId,
            `${victimMention} ⚔️ <b>You have been assassinated!</b> ⚔️\n\n` +
            `You have been assassinated by ${user.name}.\n` +
            `They are now the new ${newRole === 'king' ? 'King' : 'Queen'} and you are a lowly peasant.`,
            { parse_mode: 'HTML' }
          );
        } catch (error) {
          // Fallback to private message if group message fails
          try {
            await sendMessage(victim.messengerId, 
              `⚔️ **You have been assassinated!** ⚔️\n\n` +
              `You have been assassinated by ${user.name}.\n` +
              `They are now the new ${newRole === 'king' ? 'King' : 'Queen'} and you are a lowly peasant.`
          );
        } catch (error) {
          // User might not have started conversation with bot - that's okay
          }
        }
      }
    }, assassinationService.BLOCK_WINDOW_MS);
    
    // Store timer ID in attempt for potential cleanup
    const attempt = assassinationService.getActiveAttempt(chatId);
    if (attempt) {
      attempt.timer = timerId;
    }
    
    // Return immediately - the timer will handle completion
    return `⚔️ **Assassination attempt initiated!** ⚔️\n\n` +
      `You have paid ${ASSASSINATION_COST} 🎫 to attempt to eliminate ${victim.name}.\n` +
      `Guards have 90 seconds to block this attempt.\n` +
      `⚠️ **Warning:** If blocked, you will lose your tickets and be sent to jail!\n\n` +
      `_Waiting for guards to respond..._`;
  } catch (error) {
    // Clean up on error
    assassinationService.cancelAttempt(chatId);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Assassinate a guard/lawyer/enforcer/etc. (via redemption action)
 * Uses shield-based blocking system
 * @param {number} actionId - The redemption action ID (for transaction tracking)
 */
async function assassinatePowerUser(args, context, actionId = null) {
  const { senderId, user, message } = context;
  const chatId = message.chat.id.toString();
  
  try {
    // Check if there's already an active attempt
    if (assassinationService.hasActiveAttempt(chatId)) {
      return "❌ There is already an active assassination attempt in progress. Please wait for it to complete.";
    }
    
    // Check balance (should already be checked by redemption handler, but double-check)
    const balance = await ticketService.getBalance(user.id);
    if (balance < ASSASSINATION_REDEMPTION_COST) {
      return `❌ Insufficient tickets! Assassination costs ${ASSASSINATION_REDEMPTION_COST} 🎫, but you only have ${balance} 🎫.`;
    }
    
    // Find target user (must be guard, lawyer, enforcer, prosecutor - not king/queen/peasant)
    let targetUser = null;
    
    if (args.length > 0) {
      // User specified a target
      const mention = args[0];
      const username = mention.startsWith('@') ? mention.substring(1) : mention;
      targetUser = await roleService.getUserByName(username);
    } else if (message.reply_to_message && message.reply_to_message.from) {
      // Reply to a message
      const targetUserId = message.reply_to_message.from.id.toString();
      const targetUsername = message.reply_to_message.from.username || 
                             message.reply_to_message.from.first_name ||
                             `User_${targetUserId}`;
      targetUser = await roleService.createOrUpdateUser(
        targetUserId,
        targetUsername,
        chatId
      );
    } else {
      // Find a random power user
      const powerUsers = await User.findAll({
        where: {
          role: {
            [require('sequelize').Op.in]: ['guard', 'lawyer', 'enforcer', 'prosecutor']
          },
          currentGroupId: chatId
        }
      });
      
      if (powerUsers.length === 0) {
        return "❌ No guards, lawyers, enforcers, or prosecutors found to assassinate.";
      }
      
      // Randomly select one
      targetUser = powerUsers[Math.floor(Math.random() * powerUsers.length)];
    }
    
    if (!targetUser) {
      return "❌ Target user not found. Mention them with @username or reply to their message.";
    }
    
    // Can't assassinate yourself
    if (targetUser.id === user.id) {
      return "❌ You cannot assassinate yourself!";
    }
    
    // Can't assassinate peasants or monarchs with this action
    if (targetUser.role === 'peasant' || targetUser.role === 'king' || targetUser.role === 'queen') {
      return `❌ You cannot assassinate ${targetUser.role}s with this action. Use /assassinate for King/Queen.`;
    }
    
    // Check if target is in this chat
    if (targetUser.currentGroupId !== chatId) {
      return `❌ ${targetUser.name} is not in this chat.`;
    }
    
    // Deduct tickets immediately (will refund if blocked)
    // Create proper redemption transaction if actionId is provided
    const TicketTransaction = require('../models/TicketTransaction');
    if (actionId) {
      await TicketTransaction.create({
        userId: user.id,
        amount: -ASSASSINATION_REDEMPTION_COST,
        type: 'redeem',
        actionId: actionId,
        reason: `Assassination attempt on ${targetUser.name} (${targetUser.role})`
      });
    } else {
      // Fallback to awardTickets if no actionId (shouldn't happen in normal flow)
      await ticketService.awardTickets(
        user.id,
        -ASSASSINATION_REDEMPTION_COST,
        user.id,
        `Assassination attempt on ${targetUser.name} (${targetUser.role})`
      );
    }
    
    // Start the attempt (mark as non-monarch assassination)
    const attemptStarted = assassinationService.startAttempt(chatId, user.id, targetUser.id, false);
    
    if (!attemptStarted) {
      // Refund if couldn't start
      await ticketService.awardTickets(user.id, ASSASSINATION_REDEMPTION_COST, user.id, 'Refund - attempt failed');
      return "❌ Could not start assassination attempt. Please try again.";
    }
    
    // Announce the attempt (tag the target using HTML mention)
    const targetMention = `<a href="tg://user?id=${targetUser.messengerId}">${targetUser.name}</a>`;
    const announcement = `⚔️ <b>KILL ATTEMPT!</b> ⚔️\n\n` +
      `${targetMention} - Someone has paid ${ASSASSINATION_REDEMPTION_COST} 🎫 to kill you (${targetUser.role})!\n\n` +
      `⚔️ <b>KILL SHIELD HOLDERS!</b> Anyone with a kill shield can block this attempt within 90 seconds!\n` +
      `The target can block it themselves if they have a kill shield, or anyone else can block it for them!\n` +
      `Use /blockkill to stop the kill attempt (requires 1 ⚔️ kill shield)!\n\n` +
      `⏰ <b>90 seconds</b> to block...`;
    
    await sendMessage(chatId, announcement, { parse_mode: 'HTML' });
    
    // Set up background timer to check if attempt succeeds after 90 seconds
    const timerId = setTimeout(async () => {
      const attempt = assassinationService.getActiveAttempt(chatId);
      
      // Only proceed if attempt still exists (wasn't blocked) and matches this assassin
      if (attempt && attempt.assassinId === user.id && attempt.victimId === targetUser.id) {
        // Remove the attempt
        assassinationService.cancelAttempt(chatId);
        
        // Promote assassin to the victim's role
        await roleService.setUserRole(user.id, targetUser.role);
        
        // Demote the power user to peasant
        await roleService.setUserRole(targetUser.id, 'peasant');
        
        // Log activity
        await activityService.logActivity('assassination', {
          userId: user.id,
          targetUserId: targetUser.id,
          details: { 
            victimRole: targetUser.role,
            cost: ASSASSINATION_REDEMPTION_COST,
            assassinAnonymous: false,
            blocked: false,
            type: 'power_user',
            assassinName: user.name
          },
          chatId: chatId
        });
        
        // Send dramatic announcement
        const successAnnouncement = `⚔️ <b>KILL SUCCESSFUL!</b> ⚔️\n\n` +
          `${targetUser.name} (${targetUser.role}) has been killed!\n\n` +
          `No one was able to block the attempt in time...\n` +
          `${user.name} is now the new ${targetUser.role}!\n` +
          `The position has been claimed!`;
        
        await sendMessage(chatId, successAnnouncement, { parse_mode: 'HTML' });
        
        // Notify the victim (tag them using HTML mention)
        const targetMention = `<a href="tg://user?id=${targetUser.messengerId}">${targetUser.name}</a>`;
        try {
          await sendMessage(chatId,
            `${targetMention} ⚔️ <b>You have been killed!</b> ⚔️\n\n` +
            `You have been killed by ${user.name}.\n` +
            `They are now the new ${targetUser.role} and you are a lowly peasant.`,
            { parse_mode: 'HTML' }
          );
        } catch (error) {
          // Fallback to private message if group message fails
          try {
            await sendMessage(targetUser.messengerId, 
              `⚔️ **You have been killed!** ⚔️\n\n` +
              `You have been killed by ${user.name}.\n` +
              `They are now the new ${targetUser.role} and you are a lowly peasant.`
            );
          } catch (error) {
            // User might not have started conversation with bot - that's okay
          }
        }
      }
    }, assassinationService.BLOCK_WINDOW_MS);
    
    // Store timer ID in attempt for potential cleanup
    const attempt = assassinationService.getActiveAttempt(chatId);
    if (attempt) {
      attempt.timer = timerId;
    }
    
    // Return immediately - the timer will handle completion
    return `⚔️ **Kill attempt initiated!** ⚔️\n\n` +
      `You have paid ${ASSASSINATION_REDEMPTION_COST} 🎫 to attempt to kill ${targetUser.name}.\n` +
      `Anyone with a shield has 90 seconds to block this attempt.\n` +
      `⚠️ **Warning:** If blocked, you will lose your tickets!\n\n` +
      `_Waiting for shield holders to respond..._`;
  } catch (error) {
    // Clean up on error
    assassinationService.cancelAttempt(chatId);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Block an assassination attempt (for guards - king/queen only)
 */
async function block(context) {
  const { user, message } = context;
  const chatId = message.chat.id.toString();
  
  try {
    // Check if user is a guard
    if (user.role !== 'guard') {
      return "❌ Only Guards can block assassination attempts!";
    }
    
    // Check if there's an active attempt
    if (!assassinationService.hasActiveAttempt(chatId)) {
      return "❌ There is no active kill attempt to block.";
    }
    
    // Block the attempt
    const result = assassinationService.blockAttempt(chatId, user.id);
    
    if (!result.success) {
      return `❌ ${result.message}`;
    }
    
    // Get victim and assassin info
    const victim = await User.findByPk(result.victimId);
    const assassin = await User.findByPk(result.assassinId);
    
    // Send assassin to jail (no refund - they lose the tickets)
    assassin.isInPrison = true;
    await assassin.save();
    
    // Log activity for jail
    await activityService.logActivity('user_banned', {
      userId: user.id, // Guard who blocked
      targetUserId: assassin.id,
      details: { reason: 'Failed assassination attempt - caught by guards' },
      chatId: chatId
    });
    
    // Attempt to kick assassin from main chat (if bot is admin)
    let kickResult = '';
    try {
      const { kickChatMember } = require('../bot/telegramBot');
      await kickChatMember(chatId, parseInt(assassin.messengerId));
      kickResult = '\n✅ The assassin has been removed from this chat.';
    } catch (kickError) {
      if (kickError.message && kickError.message.includes('not enough rights')) {
        kickResult = '\n⚠️ Bot is not an admin - assassin was not removed from chat. Please remove them manually.';
      } else if (kickError.message && kickError.message.includes('chat_admin_required')) {
        kickResult = '\n⚠️ Bot needs admin rights to remove users. Please remove them manually.';
      } else {
        kickResult = '\n⚠️ Could not remove assassin automatically. Please remove them manually if needed.';
      }
      console.error('Error kicking assassin:', kickError.message);
    }
    
    // Notify jail chat if configured
    let jailNotification = '';
    try {
      const jailService = require('../services/jailService');
      const jailChatId = await jailService.getJailChatId(chatId);
      if (jailChatId) {
        await sendMessage(jailChatId,
          `🔒 **Failed Assassination Attempt!**\n\n` +
          `${assassin.name} attempted to assassinate ${victim.name} but was caught by the guards!\n\n` +
          `They have lost ${ASSASSINATION_COST} 🎫 and been sent to jail.`
        );
        jailNotification = '\n✅ Assassin has been notified in jail chat.';
      }
    } catch (error) {
      // Jail chat might not be configured - that's okay
    }
    
    // Reward all guards who blocked (including this one)
    const guards = await User.findAll({
      where: {
        id: {
          [require('sequelize').Op.in]: result.blockedBy
        }
      }
    });
    
    for (const guard of guards) {
      await ticketService.awardTickets(
        guard.id,
        GUARD_REWARD,
        guard.id,
        `Blocked assassination attempt on ${victim.name}`
      );
    }
    
    // Log activity for blocking
    await activityService.logActivity('assassination_blocked', {
      userId: user.id,
      targetUserId: result.victimId,
      details: { 
        guards: result.blockedBy,
        reward: GUARD_REWARD,
        assassinJailed: true
      },
      chatId: chatId
    });
    
    // Announce the block
    const guardNames = guards.map(g => g.name).join(', ');
    const announcement = `🛡️ **ASSASSINATION BLOCKED!** 🛡️\n\n` +
      `${guardNames} successfully protected ${victim.name}!\n\n` +
      `The assassin has been caught and sent to jail!\n` +
      `They have lost ${ASSASSINATION_COST} 🎫 (no refund).\n` +
      `Each guard receives ${GUARD_REWARD} 🎫 as reward!${kickResult}${jailNotification}`;
    
    await sendMessage(chatId, announcement);
    
    const guardBalance = await ticketService.getBalance(user.id);
    
    return `✅ **Assassination blocked!**\n\n` +
      `You successfully protected ${victim.name}!\n` +
      `Reward: ${GUARD_REWARD} 🎫\n` +
      `Your balance: ${guardBalance} 🎫`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Block an assassination attempt using a shield (for power user assassinations)
 */
async function blockAssassination(context) {
  const { user, message } = context;
  const chatId = message.chat.id.toString();
  
  try {
    // Check if there's an active attempt
    if (!assassinationService.hasActiveAttempt(chatId)) {
      return "❌ There is no active kill attempt to block.";
    }
    
    // Check if user has a kill shield
    const killShieldCount = await shieldService.getKillShieldCount(user.id);
    if (killShieldCount < 1) {
      return "❌ You don't have any kill shields! You need at least 1 ⚔️ kill shield to block a kill attempt.";
    }
    
    // Block the attempt (this will consume a kill shield)
    const result = assassinationService.blockAttemptWithShield(chatId, user.id);
    
    if (!result.success) {
      return `❌ ${result.message}`;
    }
    
    // Use a kill shield
    const killShieldUsed = await shieldService.useKillShield(user.id);
    if (!killShieldUsed) {
      // This shouldn't happen, but handle it just in case
      return "❌ Failed to use kill shield. Please try again.";
    }
    
    // Get victim and assassin info
    const victim = await User.findByPk(result.victimId);
    const assassin = await User.findByPk(result.assassinId);
    
    // Refund the assassin's tickets (they lose the tickets but don't go to jail)
    await ticketService.awardTickets(
      assassin.id,
      ASSASSINATION_REDEMPTION_COST,
      user.id,
      `Refund - assassination blocked by ${user.name}`
    );
    
    // Log activity
    await activityService.logActivity('assassination_blocked', {
      userId: user.id,
      targetUserId: result.victimId,
      details: { 
        blocker: user.id,
        blockerName: user.name,
        cost: ASSASSINATION_REDEMPTION_COST,
        shieldUsed: true,
        type: 'power_user'
      },
      chatId: chatId
    });
    
    // Announce the block
    const announcement = `⚔️ **KILL BLOCKED!** ⚔️\n\n` +
      `${user.name} successfully protected ${victim.name} using a shield!\n\n` +
      `The killer has been refunded ${ASSASSINATION_REDEMPTION_COST} 🎫.\n` +
      `${user.name} used 1 ⚔️ kill shield to block the attempt.`;
    
    await sendMessage(chatId, announcement);
    
    const killShieldBalance = await shieldService.getKillShieldCount(user.id);
    
    return `✅ **Kill blocked!**\n\n` +
      `You successfully protected ${victim.name}!\n` +
      `Kill shield used: 1 ⚔️\n` +
      `Remaining kill shields: ${killShieldBalance} ⚔️`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  assassinate,
  assassinatePowerUser,
  block,
  blockAssassination
};

