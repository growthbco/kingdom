const ticketService = require('../services/ticketService');
const roleService = require('../services/roleService');
const activityService = require('../services/activityService');
const assassinationService = require('../services/assassinationService');
const { sendMessage } = require('../bot/telegramBot');
const User = require('../models/User');

const ASSASSINATION_COST = 100;
const GUARD_REWARD = 25;

/**
 * Assassinate the King/Queen (with guard blocking system)
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
    
    // Start the attempt
    const attemptStarted = assassinationService.startAttempt(chatId, user.id, victim.id);
    
    if (!attemptStarted) {
      // Refund if couldn't start
      await ticketService.awardTickets(user.id, ASSASSINATION_COST, user.id, 'Refund - attempt failed');
      return "❌ Could not start assassination attempt. Please try again.";
    }
    
    // Announce the attempt
    let announcement = `⚔️ **ASSASSINATION ATTEMPT!** ⚔️\n\n` +
      `An assassin has paid ${ASSASSINATION_COST} 🎫 to eliminate ${victim.name} (${victim.role === 'king' ? 'King' : 'Queen'})!\n\n`;
    
    if (guards.length > 0) {
      const guardNames = guards.map(g => g.name).join(', ');
      announcement += `🛡️ **GUARDS!** ${guardNames} - You have 60 seconds to block this attempt!\n` +
        `Use /block to stop the assassination!\n\n`;
    } else {
      announcement += `⚠️ No guards are present. The assassination will proceed in 60 seconds...\n\n`;
    }
    
    announcement += `⏰ **60 seconds** to block...`;
    
    await sendMessage(chatId, announcement);
    
    // Set up background timer to check if attempt succeeds after 60 seconds
    // If blocked, the block command will handle refunds and remove the attempt
    const timerId = setTimeout(async () => {
      const attempt = assassinationService.getActiveAttempt(chatId);
      
      // Only proceed if attempt still exists (wasn't blocked) and matches this assassin
      if (attempt && attempt.assassinId === user.id && attempt.victimId === victim.id) {
        // Remove the attempt
        assassinationService.cancelAttempt(chatId);
        
        // Demote the monarch to peasant
        await roleService.setUserRole(victim.id, 'peasant');
        
        // Log activity
        await activityService.logActivity('assassination', {
          userId: user.id,
          targetUserId: victim.id,
          details: { 
            victimRole: victim.role,
            cost: ASSASSINATION_COST,
            assassinAnonymous: true,
            blocked: false
          },
          chatId: chatId
        });
        
        // Send dramatic announcement
        const successAnnouncement = `⚔️ **THE KING IS DEAD!** ⚔️\n\n` +
          `${victim.name} (${victim.role === 'king' ? 'King' : 'Queen'}) has been assassinated!\n\n` +
          `The guards failed to respond in time...\n` +
          `The assassin remains anonymous...\n` +
          `The throne is now vacant. Long live the next ruler!`;
        
        await sendMessage(chatId, successAnnouncement);
        
        // Notify the victim privately
        try {
          await sendMessage(victim.messengerId, 
            `⚔️ **You have been assassinated!** ⚔️\n\n` +
            `Your reign has come to an end. You have been demoted to Peasant.\n\n` +
            `The assassin paid ${ASSASSINATION_COST} tickets and remains anonymous.`
          );
        } catch (error) {
          // User might not have started conversation with bot - that's okay
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
      `Guards have 60 seconds to block this attempt.\n` +
      `⚠️ **Warning:** If blocked, you will lose your tickets and be sent to jail!\n\n` +
      `_Waiting for guards to respond..._`;
  } catch (error) {
    // Clean up on error
    assassinationService.cancelAttempt(chatId);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Block an assassination attempt (for guards)
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
      return "❌ There is no active assassination attempt to block.";
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

module.exports = {
  assassinate,
  block
};

