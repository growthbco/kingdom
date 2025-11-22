const activityService = require('../services/activityService');
const chatService = require('../services/chatService');
const aiService = require('../services/aiService');
const User = require('../models/User');
const { Op } = require('sequelize');

/**
 * Generate a dramatic, funny summary of bot actions
 */
function generateDramaticSummary(grouped, hours) {
  const parts = [];
  
  // Role changes - dramatic power shifts
  if (grouped.role_changes.length > 0) {
    const roleChanges = grouped.role_changes;
    const roleNames = roleChanges.map(r => r.target).join(', ');
    const roles = roleChanges.map(r => r.role).join(', ');
    if (roleChanges.length === 1) {
      parts.push(`👑 **Power Shift Alert!** ${roleNames} ascended to the role of ${roles}! The Kingdom trembles with anticipation...`);
    } else {
      parts.push(`👑 **Massive Power Restructuring!** ${roleChanges.length} citizens experienced dramatic role changes: ${roleNames} now hold new positions of power!`);
    }
  }
  
  // Bans - dramatic falls from grace
  if (grouped.bans.length > 0) {
    const banCounts = {};
    grouped.bans.forEach(ban => {
      banCounts[ban.user] = (banCounts[ban.user] || 0) + 1;
    });
    const repeatOffenders = Object.entries(banCounts).filter(([_, count]) => count > 1);
    const singleBans = Object.entries(banCounts).filter(([_, count]) => count === 1);
    
    if (repeatOffenders.length > 0) {
      const offenders = repeatOffenders.map(([name, count]) => `${name} (${count}x)`).join(', ');
      parts.push(`🔒 **CHAOS ALERT!** ${offenders} found themselves in the slammer MULTIPLE TIMES! Someone clearly didn't learn their lesson...`);
    }
    if (singleBans.length > 0) {
      const names = singleBans.map(([name]) => name).join(', ');
      parts.push(`🔒 **Justice Served!** ${names} ${singleBans.length === 1 ? 'was' : 'were'} banished to the dungeons!`);
    }
  }
  
  // Pardons - dramatic redemptions
  if (grouped.pardons.length > 0) {
    const pardonCounts = {};
    grouped.pardons.forEach(pardon => {
      pardonCounts[pardon.user] = (pardonCounts[pardon.user] || 0) + 1;
    });
    const repeatPardons = Object.entries(pardonCounts).filter(([_, count]) => count > 1);
    const singlePardons = Object.entries(pardonCounts).filter(([_, count]) => count === 1);
    
    if (repeatPardons.length > 0) {
      const names = repeatPardons.map(([name, count]) => `${name} (${count}x)`).join(', ');
      parts.push(`✅ **Redemption Arc!** ${names} ${repeatPardons.length === 1 ? 'was' : 'were'} pardoned MULTIPLE TIMES! The lawyers must be working overtime!`);
    }
    if (singlePardons.length > 0) {
      const names = singlePardons.map(([name]) => name).join(', ');
      parts.push(`✅ **Mercy Prevails!** ${names} ${singlePardons.length === 1 ? 'has' : 'have'} been granted freedom from the dungeons!`);
    }
  }
  
  // Ticket drama
  if (grouped.ticket_awards.length > 0 || grouped.ticket_redemptions.length > 0) {
    const totalAwards = grouped.ticket_awards.reduce((sum, a) => sum + (a.amount || 0), 0);
    const totalSpent = grouped.ticket_redemptions.reduce((sum, r) => sum + (r.cost || 0), 0);
    
    if (totalAwards > 0 && totalSpent > 0) {
      parts.push(`🎫 **Economic Chaos!** ${totalAwards} tickets were awarded while ${totalSpent} tickets were spent! The Kingdom's economy is in flux!`);
    } else if (totalAwards > 0) {
      parts.push(`🎫 **Generosity Overflowing!** ${totalAwards} tickets rained down upon the citizens!`);
    } else if (totalSpent > 0) {
      parts.push(`💸 **Spending Spree!** Citizens burned through ${totalSpent} tickets! The treasury weeps...`);
    }
  }
  
  // Rule changes - dramatic lawmaking
  if (grouped.rules.length > 0) {
    const added = grouped.rules.filter(r => r.type === 'rule_added').length;
    const removed = grouped.rules.filter(r => r.type === 'rule_removed').length;
    const edited = grouped.rules.filter(r => r.type === 'rule_edited').length;
    
    if (added > 0 && removed > 0) {
      parts.push(`📜 **Legal Chaos!** ${added} new laws were written while ${removed} were torn down! The rulebook is being rewritten in real-time!`);
    } else if (added > 0) {
      parts.push(`📜 **New Laws Decreed!** ${added} new rules have been added to the Kingdom's code!`);
    } else if (removed > 0) {
      parts.push(`📜 **Laws Repealed!** ${removed} rules were struck from the books! Freedom rings!`);
    } else if (edited > 0) {
      parts.push(`📜 **Legal Amendments!** ${edited} rules were modified! The fine print is getting finer...`);
    }
  }
  
  // New actions
  if (grouped.actions.length > 0) {
    const actionNames = grouped.actions.map(a => `"${a.actionName}"`).join(', ');
    parts.push(`🎯 **New Powers Unlocked!** ${actionNames} ${grouped.actions.length === 1 ? 'has' : 'have'} been added to the redemption menu!`);
  }
  
  return parts.join(' ');
}

/**
 * Generate recap of recent activity
 */
async function recap(args, context) {
  const { user, chatId, message } = context;
  
  // Block rainbeau1/caro from using recap command (check name and nickname)
  const blockedNames = ['rainbeau1', 'caro', 'peasant caro'];
  const userName = (user.name || '').toLowerCase();
  const userNickname = (user.nickname || '').toLowerCase();
  const isBlocked = blockedNames.some(blocked => 
    userName === blocked || 
    userName.includes(blocked) ||
    userNickname === blocked ||
    userNickname.includes(blocked)
  );
  
  if (isBlocked) {
    return "❌ You do not have permission to use this command.";
  }
  
  try {
    // Parse hours argument (default 24 hours)
    let hours = 24;
    if (args.length > 0) {
      const hoursArg = parseInt(args[0]);
      if (!isNaN(hoursArg) && hoursArg > 0 && hoursArg <= 168) { // Max 1 week
        hours = hoursArg;
      }
    }
    
    // Get activities
    const activities = await activityService.getRecentActivities(chatId, hours, 100);
    
    // Get or create group to track last recap time
    const Group = require('../models/Group');
    let group = await Group.findOne({
      where: { messengerGroupId: chatId.toString() }
    });
    
    if (!group) {
      group = await Group.create({
        messengerGroupId: chatId.toString(),
        groupName: message?.chat?.title || 'Unknown Group',
        type: 'main'
      });
    }
    
    // Get last recap time for context (but always show requested hours)
    const lastRecapTime = group.lastRecapTime;
    const now = new Date();
    
    // Always use the requested hours for the recap period
    const messagesSince = new Date(now.getTime() - hours * 60 * 60 * 1000);
    
    // Get chat messages for summarization
    const chatMessages = await chatService.getMessagesSince(chatId, messagesSince, 200);
    let chatSummary = null;
    
    // Try to get AI summary if available and there are messages
    if (chatMessages.length > 0 && aiService.isAvailable()) {
      try {
        // Get previous recap summary if exists to avoid repetition in AI summary
        const previousSummary = lastRecapTime ? await chatService.getPreviousRecapSummary(chatId, lastRecapTime) : null;
        chatSummary = await aiService.summarizeChat(chatMessages, hours, previousSummary);
      } catch (error) {
        console.error('Error getting chat summary:', error);
      }
    }
    
    // Update last recap time AFTER getting the summary
    group.lastRecapTime = now;
    await group.save();
    
    // Use all activities from the requested time period (not filtered by last recap)
    const filteredActivities = activities;
    
    if (filteredActivities.length === 0 && !chatSummary) {
      return `📋 **Recap (Last ${hours} hours)**\n\nNo activity to report. Everything is quiet! 👻`;
    }
    
    // Group activities by type
    const grouped = {
      role_changes: [],
      ticket_awards: [],
      ticket_redemptions: [],
      rules: [],
      bans: [],
      pardons: [],
      actions: []
    };
    
    filteredActivities.forEach(activity => {
      let details = {};
      try {
        details = activity.details ? (typeof activity.details === 'string' ? JSON.parse(activity.details) : activity.details) : {};
      } catch (e) {
        console.error('Error parsing activity details:', e);
        details = {};
      }
      
      switch (activity.eventType) {
        case 'role_change':
          grouped.role_changes.push({
            user: activity.user?.name || 'Unknown',
            target: activity.targetUser?.name || 'Unknown',
            role: details.role || 'unknown',
            time: activity.createdAt
          });
          break;
        case 'ticket_awarded':
          grouped.ticket_awards.push({
            from: activity.user?.name || 'Unknown',
            to: activity.targetUser?.name || 'Unknown',
            amount: details.amount || 0,
            reason: details.reason || '',
            time: activity.createdAt
          });
          break;
        case 'ticket_redeemed':
          grouped.ticket_redemptions.push({
            user: activity.user?.name || 'Unknown',
            action: details.actionName || 'Unknown',
            cost: details.cost || 0,
            time: activity.createdAt
          });
          break;
        case 'rule_added':
        case 'rule_removed':
        case 'rule_edited':
          grouped.rules.push({
            type: activity.eventType,
            user: activity.user?.name || 'Unknown',
            ruleText: details.ruleText || '',
            ruleId: details.ruleId || null,
            time: activity.createdAt
          });
          break;
        case 'user_banned':
          grouped.bans.push({
            by: activity.user?.name || 'Unknown',
            user: activity.targetUser?.name || 'Unknown',
            reason: details.reason || '',
            time: activity.createdAt
          });
          break;
        case 'user_pardoned':
          grouped.pardons.push({
            by: activity.user?.name || 'Unknown',
            user: activity.targetUser?.name || 'Unknown',
            time: activity.createdAt
          });
          break;
        case 'action_created':
          grouped.actions.push({
            user: activity.user?.name || 'Unknown',
            actionName: details.actionName || 'Unknown',
            cost: details.cost || 0,
            time: activity.createdAt
          });
          break;
      }
    });
    
    // Build recap message - only show AI chat summary
    let recapMessage = `📋 **Kingdom Recap (Last ${hours} hours)**\n\n`;
    
    // Add conversational recap from AI
    if (chatSummary) {
      recapMessage += `💬 **What's Been Happening:**\n\n`;
      recapMessage += `${chatSummary}\n\n`;
      recapMessage += `\n_Use /recap <hours> to see activity from a different time period._`;
      return recapMessage.trim();
    }
    
    // If no chat summary, return simple message
    return `📋 **Recap (Last ${hours} hours)**\n\nNo activity to report. Everything is quiet! 👻`;
  } catch (error) {
    console.error('Error generating recap:', error);
    return `❌ Error generating recap: ${error.message}`;
  }
}

/**
 * Get personal recap (what happened since user was last active)
 */
async function personalRecap(context) {
  const { user, chatId } = context;
  
  // Block rainbeau1/caro from using recap command (check name and nickname)
  const blockedNames = ['rainbeau1', 'caro', 'peasant caro'];
  const userName = (user.name || '').toLowerCase();
  const userNickname = (user.nickname || '').toLowerCase();
  const isBlocked = blockedNames.some(blocked => 
    userName === blocked || 
    userName.includes(blocked) ||
    userNickname === blocked ||
    userNickname.includes(blocked)
  );
  
  if (isBlocked) {
    return "❌ You do not have permission to use this command.";
  }
  
  try {
    // Get user's last seen time
    const lastSeen = user.lastSeen || user.createdAt;
    
    // Get activities since last seen
    const activities = await activityService.getActivitiesSince(lastSeen, chatId);
    
    // Get chat messages since last seen
    const chatMessages = await chatService.getMessagesSince(chatId, lastSeen, 50);
    let chatSummary = null;
    
    // Try to get AI summary if available
    if (chatMessages.length > 0 && aiService.isAvailable()) {
      try {
        const hoursSince = Math.ceil((new Date() - lastSeen) / (1000 * 60 * 60));
        chatSummary = await aiService.summarizeChat(chatMessages, hoursSince);
      } catch (error) {
        console.error('Error getting chat summary:', error);
      }
    }
    
    if (activities.length === 0 && !chatSummary) {
      return `📋 **Your Personal Recap**\n\nNothing new since you were last active! You're all caught up! ✅`;
    }
    
    // Count by type
    const counts = {
      role_changes: 0,
      ticket_awards: 0,
      ticket_redemptions: 0,
      rules: 0,
      bans: 0,
      pardons: 0
    };
    
    activities.forEach(activity => {
      if (counts.hasOwnProperty(activity.eventType)) {
        counts[activity.eventType]++;
      } else if (activity.eventType.startsWith('rule_')) {
        counts.rules++;
      }
    });
    
    let message = `📋 **Your Personal Recap**\n\n`;
    message += `_Since ${lastSeen.toLocaleString()}:_\n\n`;
    
    // Add chat summary if available
    if (chatSummary) {
      message += `💬 **Chat Summary:**\n${chatSummary}\n\n`;
    }
    
    const parts = [];
    if (counts.role_changes > 0) parts.push(`${counts.role_changes} role change${counts.role_changes > 1 ? 's' : ''}`);
    if (counts.ticket_awards > 0) parts.push(`${counts.ticket_awards} ticket award${counts.ticket_awards > 1 ? 's' : ''}`);
    if (counts.ticket_redemptions > 0) parts.push(`${counts.ticket_redemptions} redemption${counts.ticket_redemptions > 1 ? 's' : ''}`);
    if (counts.rules > 0) parts.push(`${counts.rules} rule change${counts.rules > 1 ? 's' : ''}`);
    if (counts.bans > 0) parts.push(`${counts.bans} ban${counts.bans > 1 ? 's' : ''}`);
    if (counts.pardons > 0) parts.push(`${counts.pardons} pardon${counts.pardons > 1 ? 's' : ''}`);
    
    if (parts.length === 0) {
      return `📋 **Your Personal Recap**\n\nNothing new since you were last active! You're all caught up! ✅`;
    }
    
    message += parts.join(', ') + '\n\n';
    message += `Use /recap to see full details of recent activity.`;
    
    return message;
  } catch (error) {
    console.error('Error generating personal recap:', error);
    return `❌ Error generating personal recap: ${error.message}`;
  }
}

module.exports = {
  recap,
  personalRecap
};

