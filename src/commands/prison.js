const roleService = require('../services/roleService');
const activityService = require('../services/activityService');
const jailService = require('../services/jailService');
const ticketService = require('../services/ticketService');
const { bot, sendMessage, kickChatMember, unbanChatMember, createChatInviteLink, exportChatInviteLink, getChatMember } = require('../bot/telegramBot');
const User = require('../models/User');
const TicketTransaction = require('../models/TicketTransaction');

/**
 * Ban user to prison chat
 */
async function ban(args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    // Non-admin tried to use /ban - kick them after countdown
    const warningMessage = `⚠️ **UNAUTHORIZED COMMAND DETECTED!**\n\n` +
      `Only Enforcer and King/Queen can use /ban.\n\n` +
      `🔒 You will be removed from this chat in 10 seconds...\n\n`;
    
    // Send warning message
    await sendMessage(message.chat.id.toString(), warningMessage);
    
    // Countdown and kick
    const countdown = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    for (const num of countdown) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      try {
        await sendMessage(message.chat.id.toString(), `⏰ ${num}...`);
      } catch (e) {
        // Ignore errors during countdown
      }
    }
    
    // Log activity
    try {
      await activityService.logActivity('user_banned', {
        userId: user.id,
        targetUserId: user.id,
        details: { reason: 'Unauthorized use of /ban command' },
        chatId: message.chat.id.toString()
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
    
    // Kick the user
    try {
      const chatIdStr = message.chat.id.toString();
      const userIdInt = parseInt(senderId);
      
      console.log(`Attempting to kick user ${userIdInt} from chat ${chatIdStr}`);
      
      // Use the same kickChatMember function that works in the regular ban command
      await kickChatMember(chatIdStr, userIdInt);
      
      await sendMessage(chatIdStr, `🔒 ${user.name} has been removed for unauthorized use of admin commands.`);
    } catch (kickError) {
      console.error('Error kicking user:', kickError);
      console.error('Error details:', JSON.stringify(kickError, null, 2));
      
      let errorMsg = '';
      if (kickError.message) {
        if (kickError.message.includes('not enough rights') || kickError.message.includes('chat_admin_required')) {
          errorMsg = `⚠️ Bot is not an admin - could not remove ${user.name}. Please remove them manually.`;
        } else if (kickError.message.includes('user is an administrator')) {
          errorMsg = `⚠️ Cannot remove ${user.name} - they are an administrator of this chat.`;
        } else {
          errorMsg = `⚠️ Could not remove ${user.name}: ${kickError.message}`;
        }
      } else {
        errorMsg = `⚠️ Could not remove ${user.name}. Please check bot permissions.`;
      }
      
      await sendMessage(message.chat.id.toString(), errorMsg);
    }
    
    // Notify jail chat if configured
    try {
      const jailChatId = await jailService.getJailChatId(message.chat.id.toString());
      if (jailChatId) {
        const jailMessage = `🔒 **New Prisoner Arrived (Unauthorized Command)**\n\n` +
          `**Name:** ${user.name}\n` +
          `**User ID:** ${user.messengerId}\n` +
          `**Reason:** Attempted to use /ban command without permission\n` +
          `**Chat:** ${message.chat.title || 'Main Chat'}\n\n` +
          `_Please add this user to the jail chat manually._`;
        
        await sendMessage(jailChatId, jailMessage);
      }
    } catch (error) {
      console.error('Error sending jail notification:', error);
    }
    
    // Notify enforcer(s) about the unauthorized command attempt
    try {
      const enforcers = await User.findAll({ where: { role: 'enforcer' } });
      if (enforcers.length > 0) {
        const enforcerMessage = `⚖️ **Enforcer Alert: Unauthorized Command Attempt**\n\n` +
          `**User:** ${user.name}\n` +
          `**User ID:** ${user.messengerId}\n` +
          `**Action:** Attempted to use /ban command without permission\n` +
          `**Chat:** ${message.chat.title || 'Main Chat'}\n\n` +
          `_User has been automatically removed from chat and marked as in prison._`;
        
        let notifiedCount = 0;
        for (const enforcer of enforcers) {
          try {
            // Try to send direct message to enforcer
            await sendMessage(enforcer.messengerId, enforcerMessage);
            notifiedCount++;
          } catch (dmError) {
            // If direct message fails, mention them in the main chat instead
            try {
              const enforcerMention = enforcer.name.includes('@') ? enforcer.name : `@${enforcer.name}`;
              await sendMessage(message.chat.id.toString(), `${enforcerMention}\n\n${enforcerMessage}`);
              notifiedCount++;
            } catch (mentionError) {
              console.error(`Error notifying enforcer ${enforcer.name}:`, mentionError.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error notifying enforcer about unauthorized command:', error);
    }
    
    // Try to send them a direct message
    try {
      await sendMessage(senderId, `⚠️ **You were removed from "${message.chat.title || 'the chat'}"**\n\nReason: Attempted to use /ban command without permission.\n\nOnly Enforcer and King/Queen can use admin commands.`);
    } catch (dmError) {
      // User might not have started conversation with bot - that's okay
    }
    
    return null; // Don't send response to the command
  }
  
  let targetUserId = null;
  let targetUsername = null;
  let reason = 'Rule violation';
  
  // Check if message is a reply
  if (message.reply_to_message && message.reply_to_message.from) {
    targetUserId = message.reply_to_message.from.id.toString();
    targetUsername = message.reply_to_message.from.username || 
                     message.reply_to_message.from.first_name ||
                     `User_${targetUserId}`;
    reason = args.join(' ') || 'Rule violation';
  } else if (args.length > 0) {
    const mention = args[0];
    // Accept both @username and username (without @)
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    // Try to find by name (username or display name)
    const targetUser = await roleService.getUserByName(username);
    if (!targetUser) {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
    }
    targetUserId = targetUser.messengerId;
    targetUsername = targetUser.name;
    reason = args.slice(1).join(' ') || 'Rule violation';
  } else {
    return "❌ Usage: /ban @user <reason> or /ban username <reason> or reply to a message with /ban <reason>";
  }
  
  try {
    const targetUser = await roleService.createOrUpdateUser(
      targetUserId,
      targetUsername,
      message.chat.id.toString()
    );
    
    // Check if target is an admin (enforcer, king, queen)
    const isTargetAdmin = ['enforcer', 'king', 'queen'].includes(targetUser.role);
    const isBannerKing = user.role === 'king';
    
    // Prevent banning admins unless the ban command is from a King
    if (isTargetAdmin && !isBannerKing) {
      return `❌ Cannot ban ${targetUser.name} - they are an admin (${targetUser.role}). Only the King can ban other admins.`;
    }
    
    // Log activity
    await activityService.logActivity('user_banned', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { reason },
      chatId: message.chat.id.toString()
    });
    
    // Always attempt to kick user from chat
    let kickResult = '';
    try {
      await kickChatMember(message.chat.id.toString(), parseInt(targetUserId));
      kickResult = '\n✅ User has been removed from this chat.';
    } catch (kickError) {
      // Bot might not be admin, or user might already be banned
      if (kickError.message && kickError.message.includes('not enough rights')) {
        kickResult = '\n⚠️ Bot is not an admin - user was not removed from chat. Please remove them manually.';
      } else if (kickError.message && kickError.message.includes('chat_admin_required')) {
        kickResult = '\n⚠️ Bot needs admin rights to remove users. Please remove them manually.';
      } else if (kickError.message && kickError.message.includes('user is an administrator')) {
        kickResult = '\n⚠️ Cannot remove user - they are a Telegram chat administrator.';
      } else {
        // User might already be banned or other error
        kickResult = '\n⚠️ Could not remove user automatically. Please remove them manually if needed.';
      }
      console.error('Error kicking user:', kickError.message);
    }
    
    // Notify jail chat if configured
    let jailNotification = '';
    try {
      const jailChatId = await jailService.getJailChatId(message.chat.id.toString());
      if (jailChatId) {
        const userMention = message.reply_to_message?.from?.username 
          ? `@${message.reply_to_message.from.username}` 
          : targetUser.name;
        
        const jailMessage = `🔒 **New Prisoner Arrived**\n\n` +
          `**Name:** ${targetUser.name}\n` +
          `**User ID:** ${targetUser.messengerId}\n` +
          `**Reason:** ${reason}\n` +
          `**Banned by:** ${user.name}\n\n` +
          `_Please add this user to the jail chat manually._`;
        
        await sendMessage(jailChatId, jailMessage);
        jailNotification = `\n📢 Notification sent to jail chat.`;
      }
    } catch (error) {
      console.error('Error sending jail notification:', error);
      // Don't fail the ban if jail notification fails
    }
    
    // Notify enforcer(s) so they can take action
    let enforcerNotification = '';
    try {
      const enforcers = await User.findAll({ where: { role: 'enforcer' } });
      if (enforcers.length > 0) {
        const enforcerMessage = `⚖️ **Enforcer Alert: New Prisoner**\n\n` +
          `**Prisoner:** ${targetUser.name}\n` +
          `**User ID:** ${targetUser.messengerId}\n` +
          `**Reason:** ${reason}\n` +
          `**Banned by:** ${user.name}\n` +
          `**Chat:** ${message.chat.title || 'Main Chat'}\n\n` +
          `_Action may be required: Add user to jail chat if configured._`;
        
        let notifiedCount = 0;
        for (const enforcer of enforcers) {
          try {
            // Try to send direct message to enforcer
            await sendMessage(enforcer.messengerId, enforcerMessage);
            notifiedCount++;
          } catch (dmError) {
            // If direct message fails (user hasn't started conversation with bot),
            // mention them in the main chat instead
            try {
              const enforcerMention = enforcer.name.includes('@') ? enforcer.name : `@${enforcer.name}`;
              await sendMessage(message.chat.id.toString(), `${enforcerMention}\n\n${enforcerMessage}`);
              notifiedCount++;
            } catch (mentionError) {
              console.error(`Error notifying enforcer ${enforcer.name}:`, mentionError.message);
            }
          }
        }
        
        if (notifiedCount > 0) {
          enforcerNotification = `\n⚖️ Enforcer${enforcers.length > 1 ? 's' : ''} notified.`;
        }
      }
    } catch (error) {
      console.error('Error notifying enforcer:', error);
      // Don't fail the ban if enforcer notification fails
    }
    
    return `🔒 ${targetUser.name} has been sent to jail!\nReason: ${reason}${kickResult}${jailNotification}${enforcerNotification}`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}


/**
 * Remove user from chat (admin only, works in any chat)
 */
async function remove(args, context) {
  const { senderId, user, message } = context;
  
  // Check admin permissions - only admins can use this command
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can remove users from chats.";
  }
  
  const currentChatId = message.chat.id.toString();
  
  let targetUserId = null;
  let targetUsername = null;
  
  // Check if message is a reply
  if (message.reply_to_message && message.reply_to_message.from) {
    targetUserId = message.reply_to_message.from.id.toString();
    targetUsername = message.reply_to_message.from.username || 
                     message.reply_to_message.from.first_name ||
                     `User_${targetUserId}`;
  } else if (args.length > 0) {
    const mention = args[0];
    // Accept both @username and username (without @)
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    // Try to find by name (username or display name)
    const targetUser = await roleService.getUserByName(username);
    if (!targetUser) {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
    }
    targetUserId = targetUser.messengerId;
    targetUsername = targetUser.name;
  } else {
    return "❌ Usage: /remove @user or /remove username or reply to a message";
  }
  
  try {
    const targetUser = await roleService.createOrUpdateUser(
      targetUserId,
      targetUsername,
      currentChatId
    );
    
    // Log activity
    await activityService.logActivity('user_removed_from_jail', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { removedFrom: 'chat' },
      chatId: currentChatId
    });
    
    // Attempt to kick user from chat (if bot is admin)
    let kickResult = '';
    try {
      await kickChatMember(currentChatId, parseInt(targetUserId));
      kickResult = '\n✅ User has been removed from this chat.';
    } catch (kickError) {
      // Bot might not be admin, or user might already be banned
      if (kickError.message && kickError.message.includes('not enough rights')) {
        kickResult = '\n⚠️ Bot is not an admin - user was not removed from chat. Please remove them manually.';
      } else if (kickError.message && kickError.message.includes('chat_admin_required')) {
        kickResult = '\n⚠️ Bot needs admin rights to remove users. Please remove them manually.';
      } else if (kickError.message && kickError.message.includes('user is an administrator')) {
        kickResult = '\n⚠️ Cannot remove this user - they are an administrator of this chat.';
      } else {
        // User might already be banned or other error
        kickResult = '\n⚠️ Could not remove user automatically. Please remove them manually if needed.';
      }
      console.error('Error kicking user from chat:', kickError.message);
    }
    
    return `🔓 ${targetUser.name} has been removed from this chat!${kickResult}`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Send someone to jail using 5 tickets (requires valid reason)
 */
async function jail(args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions - only admins can use /jail
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can send users to jail.";
  }
  
  const JAIL_COST = 5; // Cost in tickets to send someone to jail
  
  // Check if message is a reply
  let targetUserId = null;
  let targetUsername = null;
  let reason = '';
  
  if (message.reply_to_message && message.reply_to_message.from) {
    targetUserId = message.reply_to_message.from.id.toString();
    targetUsername = message.reply_to_message.from.username || 
                     message.reply_to_message.from.first_name ||
                     `User_${targetUserId}`;
    reason = args.join(' ') || '';
  } else if (args.length > 0) {
    const mention = args[0];
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    const targetUser = await roleService.getUserByName(username);
    if (!targetUser) {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
    }
    targetUserId = targetUser.messengerId;
    targetUsername = targetUser.name;
    reason = args.slice(1).join(' ') || '';
  } else {
    return "❌ Usage: /jail @user <reason> or reply to a message with /jail <reason>\n\nYou need a valid reason to send someone to jail. This costs 5 🎫.";
  }
  
  // Require a valid reason
  if (!reason || reason.trim().length < 3) {
    return "❌ You must provide a valid reason (at least 3 characters) to send someone to jail.\n\nUsage: /jail @user <reason>";
  }
  
  try {
    // Admins don't need to pay for /jail (it's free for them)
    // But we'll keep the cost check for consistency, though admins bypass it
    const balance = await ticketService.getBalance(user.id);
    const needsPayment = balance < JAIL_COST;
    
    // Only deduct tickets if admin has enough (optional - could make it free for admins)
    // For now, we'll still require tickets but admin permission is required
    if (needsPayment) {
      return `❌ Insufficient tickets! You need ${JAIL_COST} 🎫 to send someone to jail, but you only have ${balance} 🎫.`;
    }
    
    // Can't jail yourself
    const targetUser = await roleService.createOrUpdateUser(
      targetUserId,
      targetUsername,
      message.chat.id.toString()
    );
    
    if (targetUser.id === user.id) {
      return "❌ You can't send yourself to jail!";
    }
    
    // Check if target is an admin (enforcer, king, queen)
    const isTargetAdmin = ['enforcer', 'king', 'queen'].includes(targetUser.role);
    const isJailerKing = user.role === 'king';
    
    // Prevent jailing admins unless the jail command is from a King
    if (isTargetAdmin && !isJailerKing) {
      return `❌ Cannot jail ${targetUser.name} - they are an admin (${targetUser.role}). Only the King can jail other admins.`;
    }
    
    // Deduct tickets
    await ticketService.awardTickets(
      user.id,
      -JAIL_COST,
      user.id,
      `Sent ${targetUser.name} to jail: ${reason}`
    );
    
    // Log activity
    await activityService.logActivity('user_jailed_tickets', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { reason, cost: JAIL_COST },
      chatId: message.chat.id.toString()
    });
    
    // Always attempt to kick user from chat
    let kickResult = '';
    try {
      await kickChatMember(message.chat.id.toString(), parseInt(targetUserId));
      kickResult = '\n✅ User has been removed from this chat.';
    } catch (kickError) {
      if (kickError.message && kickError.message.includes('not enough rights')) {
        kickResult = '\n⚠️ Bot is not an admin - user was not removed from chat. Please remove them manually.';
      } else if (kickError.message && kickError.message.includes('chat_admin_required')) {
        kickResult = '\n⚠️ Bot needs admin rights to remove users. Please remove them manually.';
      } else if (kickError.message && kickError.message.includes('user is an administrator')) {
        kickResult = '\n⚠️ Cannot remove user - they are a Telegram chat administrator.';
      } else {
        kickResult = '\n⚠️ Could not remove user automatically. Please remove them manually if needed.';
      }
      console.error('Error kicking user:', kickError.message);
    }
    
    // Notify jail chat if configured
    let jailNotification = '';
    try {
      const jailChatId = await jailService.getJailChatId(message.chat.id.toString());
      if (jailChatId) {
        const jailMessage = `🔒 **New Prisoner Arrived (Ticket-Based)**\n\n` +
          `**Name:** ${targetUser.name}\n` +
          `**User ID:** ${targetUser.messengerId}\n` +
          `**Reason:** ${reason}\n` +
          `**Sent by:** ${user.name} (cost: ${JAIL_COST} 🎫)\n\n` +
          `_${targetUser.name} can use /hirelawyer to hire a lawyer for defense._`;
        
        await sendMessage(jailChatId, jailMessage);
        jailNotification = `\n📢 Notification sent to jail chat.`;
      }
    } catch (error) {
      console.error('Error sending jail notification:', error);
    }
    
    // Notify target user (if possible)
    try {
      const targetNotification = `🔒 **You've been sent to jail!**\n\n` +
        `**Sent by:** ${user.name}\n` +
        `**Reason:** ${reason}\n` +
        `**Cost:** ${JAIL_COST} 🎫\n\n` +
        `You can hire a lawyer to defend your case using /hirelawyer <lawyer> <argument>`;
      
      await sendMessage(targetUserId, targetNotification);
    } catch (dmError) {
      // User might not have started conversation with bot - that's okay
    }
    
    const newBalance = await ticketService.getBalance(user.id);
    
    return `🔒 ${targetUser.name} has been sent to jail!\n\n` +
           `**Reason:** ${reason}\n` +
           `**Cost:** ${JAIL_COST} 🎫\n` +
           `**Your remaining balance:** ${newBalance} 🎫${kickResult}${jailNotification}\n\n` +
           `_${targetUser.name} can hire a lawyer using /hirelawyer to defend their case._`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}


/**
 * Add user back to a chat (admin only)
 * Unbans the user and optionally creates an invite link
 */
async function add(args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions - only admins can add users
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can add users to chats.";
  }
  
  let targetUserId = null;
  let targetUsername = null;
  
  // Check if message is a reply
  if (message.reply_to_message && message.reply_to_message.from) {
    targetUserId = message.reply_to_message.from.id.toString();
    targetUsername = message.reply_to_message.from.username || 
                     message.reply_to_message.from.first_name ||
                     `User_${targetUserId}`;
  } else if (args.length > 0) {
    const mention = args[0];
    // Accept both @username and username (without @)
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    // Try to find by name (username or display name)
    const targetUser = await roleService.getUserByName(username);
    if (!targetUser) {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
    }
    targetUserId = targetUser.messengerId;
    targetUsername = targetUser.name;
  } else {
    return "❌ Usage: /add @user or /add username or reply to a message";
  }
  
  try {
    const currentChatId = message.chat.id.toString();
    const targetUserIdInt = parseInt(targetUserId);
    
    // Check if user is already in the chat
    const chatMember = await getChatMember(currentChatId, targetUserIdInt);
    if (chatMember && chatMember.status !== 'left' && chatMember.status !== 'kicked') {
      return `✅ ${targetUsername} is already in this chat.`;
    }
    
    // Try to unban the user (if they're banned, this allows them to rejoin)
    let unbanResult = '';
    try {
      await unbanChatMember(currentChatId, targetUserIdInt);
      unbanResult = '\n✅ User has been unbanned and can now rejoin.';
    } catch (unbanError) {
      // User might not be banned, or bot might not have permission
      if (unbanError.message && unbanError.message.includes('not enough rights')) {
        unbanResult = '\n⚠️ Bot is not an admin - cannot unban user.';
      } else if (unbanError.message && unbanError.message.includes('user not found')) {
        unbanResult = '\n⚠️ User not found in chat ban list.';
      } else {
        // User might not be banned, that's okay
        unbanResult = '\n⚠️ Could not unban user (they may not be banned).';
      }
    }
    
    // Try to create an invite link for the user
    let inviteLink = '';
    try {
      const invite = await createChatInviteLink(currentChatId, {
        name: `Invite for ${targetUsername}`,
        creates_join_request: false
      });
      if (invite && invite.invite_link) {
        inviteLink = `\n\n🔗 Invite link: ${invite.invite_link}`;
      }
    } catch (inviteError) {
      // Try to get existing invite link
      try {
        const existingLink = await exportChatInviteLink(currentChatId);
        if (existingLink) {
          inviteLink = `\n\n🔗 Chat invite link: ${existingLink}`;
        }
      } catch (exportError) {
        // No invite link available, that's okay
        console.log('Could not create or export invite link:', exportError.message);
      }
    }
    
    // Log activity (using user_pardoned as closest match - can be updated later)
    await activityService.logActivity('user_pardoned', {
      userId: user.id,
      targetUserId: targetUserIdInt,
      details: { chatId: currentChatId, action: 'added_to_chat' },
      chatId: currentChatId
    });
    
    return `✅ ${targetUsername} has been added back to this chat!${unbanResult}${inviteLink}`;
  } catch (error) {
    console.error('Error adding user to chat:', error);
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  ban,
  jail,
  remove,
  add
};

