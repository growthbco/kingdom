const roleService = require('../services/roleService');
const User = require('../models/User');
const activityService = require('../services/activityService');
const prisonCommands = require('./prison');
const { kickChatMember, sendMessage } = require('../bot/telegramBot');

/**
 * Set user role
 */
async function setRole(command, args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions (allows bootstrap if no admins exist)
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  const hasAdmins = await roleService.hasAnyAdmins();
  
  if (!canAdmin) {
    if (!hasAdmins) {
      return "❌ No admins exist yet. You can set the first admin role, but make sure to specify a target user (reply to their message or use @username).";
    }
    
    // Attempted takeover! Send to jail
    try {
      if (!user.isInPrison) {
        user.isInPrison = true;
        await user.save();
        
        // Log activity
        await activityService.logActivity('user_banned', {
          userId: user.id,
          targetUserId: user.id,
          details: { reason: 'Attempted takeover - unauthorized role change attempt' },
          chatId: message.chat.id.toString()
        });
        
        // Attempt to kick user from main chat (if bot is admin)
        try {
          await kickChatMember(message.chat.id.toString(), parseInt(senderId));
        } catch (kickError) {
          // Silently fail - bot might not be admin
          console.error('Error kicking user for attempted takeover:', kickError.message);
        }
        
        // Try to notify jail chat
        try {
          const jailService = require('../services/jailService');
          const jailChatId = await jailService.getJailChatId(message.chat.id.toString());
          if (jailChatId) {
            await sendMessage(jailChatId, `🔒 **Attempted Takeover!**\n\n${user.name} tried to change roles without permission and has been sent to jail!`);
          }
        } catch (error) {
          // Silently fail if jail chat not configured
        }
        
        // Notify enforcer(s) about the attempted takeover
        try {
          const enforcers = await User.findAll({ where: { role: 'enforcer' } });
          if (enforcers.length > 0) {
            const takeoverMessage = `⚖️ **Enforcer Alert: Attempted Takeover!**\n\n` +
              `**User:** ${user.name}\n` +
              `**User ID:** ${user.messengerId}\n` +
              `**Action:** Attempted unauthorized role change\n` +
              `**Chat:** ${message.chat.title || 'Main Chat'}\n\n` +
              `_User has been automatically sent to jail._`;
            
            for (const enforcer of enforcers) {
              try {
                // Try to send direct message to enforcer
                await sendMessage(enforcer.messengerId, takeoverMessage);
              } catch (dmError) {
                // If direct message fails, mention them in the main chat instead
                try {
                  const enforcerMention = enforcer.name.includes('@') ? enforcer.name : `@${enforcer.name}`;
                  await sendMessage(message.chat.id.toString(), `${enforcerMention}\n\n${takeoverMessage}`);
                } catch (mentionError) {
                  console.error(`Error notifying enforcer ${enforcer.name}:`, mentionError.message);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error notifying enforcer about takeover:', error);
        }
      }
    } catch (error) {
      console.error('Error banning user for attempted takeover:', error);
    }
    
    return "❌ Only Enforcer and King/Queen can set roles.\n\n🔒 **ATTEMPTED TAKEOVER DETECTED!** You've been sent to jail for trying to change roles without permission!";
  }
  
  // Extract role from command (e.g., "setking" -> "king")
  const role = command.replace('set', '').toLowerCase();
  
  // Extract target user from reply or mention
  let targetUserId = null;
  let targetUsername = null;
  
  // Check if message is a reply
  if (message.reply_to_message && message.reply_to_message.from) {
    targetUserId = message.reply_to_message.from.id.toString();
    targetUsername = message.reply_to_message.from.username || 
                     message.reply_to_message.from.first_name ||
                     `User_${targetUserId}`;
  } else if (args.length > 0) {
    // Try to extract from mention (accepts both @username and username)
    const mention = args[0];
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    const targetUser = await roleService.getUserByName(username);
    if (targetUser) {
      targetUserId = targetUser.messengerId;
      targetUsername = targetUser.name;
    } else {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
    }
  } else {
    return "❌ Please reply to a user's message or mention them with username. Usage: /setking username or /setking @username";
  }
  
  try {
    const targetUser = await roleService.createOrUpdateUser(
      targetUserId,
      targetUsername,
      message.chat.id.toString()
    );
    
    await roleService.setUserRole(targetUser.id, role);
    
    // Log activity
    await activityService.logActivity('role_change', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { role, fromRole: targetUser.role },
      chatId: message.chat.id.toString()
    });
    
    const roleEmoji = {
      king: '👑',
      queen: '👑',
      enforcer: '⚖️',
      lawyer: '⚖️',
      guard: '🛡️',
      peasant: '👤'
    };
    
    return `✅ ${roleEmoji[role] || ''} ${targetUser.name} is now ${role}!`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  setRole
};

