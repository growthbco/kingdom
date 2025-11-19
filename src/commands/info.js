const User = require('../models/User');
const Rule = require('../models/Rule');
const RedemptionAction = require('../models/RedemptionAction');
const ActivityLog = require('../models/ActivityLog');
const Group = require('../models/Group');
const ticketService = require('../services/ticketService');
const bombService = require('../services/bombService');
const shieldService = require('../services/shieldService');
const roleService = require('../services/roleService');
const userService = require('../services/userService');
const { createChatInviteLink } = require('../bot/telegramBot');
const { Op } = require('sequelize');

/**
 * Show game status
 */
async function status(context) {
  try {
    const king = await User.findOne({ where: { role: 'king' } });
    const queen = await User.findOne({ where: { role: 'queen' } });
    const enforcer = await User.findOne({ where: { role: 'enforcer' } });
    const lawyers = await User.findAll({ where: { role: 'lawyer' } });
    const guards = await User.findAll({ where: { role: 'guard' } });
    const prosecutors = await User.findAll({ where: { role: 'prosecutor' } });
    const activeRules = await Rule.count({ where: { isActive: true } });
    const totalUsers = await User.count();
    const prisonCount = await User.count({ where: { isInPrison: true } });
    
    let message = "👑 **Kingdom Status**\n\n";
    
    if (king) {
      message += `👑 King: ${king.name}\n`;
    } else {
      message += `👑 King: *None*\n`;
    }
    
    if (queen) {
      message += `👑 Queen: ${queen.name}\n`;
    } else {
      message += `👑 Queen: *None*\n`;
    }
    
    if (enforcer) {
      message += `⚖️ Enforcer: ${enforcer.name}\n`;
    } else {
      message += `⚖️ Enforcer: *None*\n`;
    }
    
    if (lawyers.length > 0) {
      message += `⚖️ Lawyers: ${lawyers.map(l => l.name).join(', ')}\n`;
    }
    
    if (guards.length > 0) {
      message += `🛡️ Guards: ${guards.map(g => g.name).join(', ')}\n`;
    }
    
    if (prosecutors.length > 0) {
      message += `⚖️ Prosecutors: ${prosecutors.map(p => p.name).join(', ')}\n`;
    }
    
    message += `\n📜 Active Rules: ${activeRules}\n`;
    message += `👥 Total Members: ${totalUsers}\n`;
    message += `🔒 In Prison: ${prisonCount}`;
    
    return message;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Show all role assignments
 */
async function roles(context) {
  try {
    const users = await User.findAll({
      order: [
        ['role', 'ASC'],
        ['name', 'ASC']
      ]
    });
    
    if (users.length === 0) {
      return "👥 No users registered yet.";
    }
    
    // Group users by role
    const roleGroups = {
      king: [],
      queen: [],
      enforcer: [],
      lawyer: [],
      guard: [],
      prosecutor: [],
      peasant: []
    };
    
    users.forEach(user => {
      if (roleGroups[user.role]) {
        roleGroups[user.role].push(user);
      }
    });
    
    let message = "👥 **Role Assignments**\n\n";
    
    const roleEmojis = {
      king: '👑',
      queen: '👑',
      enforcer: '⚖️',
      lawyer: '⚖️',
      guard: '🛡️',
      prosecutor: '⚖️',
      peasant: '👤'
    };
    
    const roleNames = {
      king: 'King',
      queen: 'Queen',
      enforcer: 'Enforcer',
      lawyer: 'Lawyers',
      guard: 'Guards',
      prosecutor: 'Prosecutors',
      peasant: 'Peasants'
    };
    
    // Show roles in order of importance
    const roleOrder = ['king', 'queen', 'enforcer', 'lawyer', 'guard', 'prosecutor', 'peasant'];
    
    roleOrder.forEach(role => {
      const roleUsers = roleGroups[role];
      if (roleUsers.length > 0) {
        const emoji = roleEmojis[role];
        const name = roleNames[role];
        message += `${emoji} **${name}** (${roleUsers.length}):\n`;
        
        roleUsers.forEach(user => {
          const displayName = userService.getDisplayName(user);
          let userLine = `   • ${displayName}`;
          if (user.isInPrison) {
            userLine += ` 🔒`;
          }
          message += userLine + '\n';
        });
        message += '\n';
      }
    });
    
    return message.trim();
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Show leaderboard - shows all users with their tickets and bombs
 */
async function leaderboard(context) {
  try {
    // Get all users
    const users = await User.findAll({
      order: [['name', 'ASC']]
    });
    
    if (users.length === 0) {
      return "🏆 No users found!";
    }
    
    // Get balances for all users
    const balances = await Promise.all(
      users.map(async (user) => {
        const ticketBalance = await ticketService.getBalance(user.id);
        const bombCount = await bombService.getBombCount(user.id);
        const shieldCount = await shieldService.getShieldCount(user.id);
        return {
          user,
          tickets: ticketBalance,
          bombs: bombCount,
          shields: shieldCount
        };
      })
    );
    
    // Sort by tickets (descending), then by bombs (descending), then by shields (descending)
    balances.sort((a, b) => {
      if (b.tickets !== a.tickets) {
        return b.tickets - a.tickets;
      }
      if (b.bombs !== a.bombs) {
        return b.bombs - a.bombs;
      }
      return b.shields - a.shields;
    });
    
    let message = "🏆 Kingdom Leaderboard\n\n";
    
    balances.forEach((item, idx) => {
      const displayName = userService.getDisplayName(item.user);
      const parts = [`${displayName}: ${item.tickets} 🎫`];
      if (item.bombs > 0) parts.push(`${item.bombs} 💣`);
      if (item.shields > 0) parts.push(`${item.shields} 🛡️`);
      message += `${idx + 1}. ${parts.join(' and ')}\n`;
    });
    
    return message.trim();
  } catch (error) {
    console.error('Error in leaderboard:', error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Show available actions
 */
async function actions(context) {
  try {
    const actions = await RedemptionAction.findAll({
      where: { isActive: true },
      order: [['ticketCost', 'ASC']]
    });
    
    if (actions.length === 0) {
      return "❌ No actions available.";
    }
    
    let message = "🎯 **Available Redemption Actions**\n\n";
    
    actions.forEach((action, idx) => {
      message += `${idx + 1}. **${action.actionName}** - ${action.ticketCost} 🎫\n`;
      message += `   ${action.description}\n\n`;
    });
    
    message += "Use /redeem <action name> to redeem.";
    
    return message.trim();
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Show help
 */
function help() {
  return `📖 **Kingdom Bot Commands**\n\n` +
    `**👑 Admin** (Enforcer & King/Queen only):\n` +
    `/setrole <role> @user - Set user role (roles: king, enforcer, guard, lawyer, prosecutor, peasant)\n` +
    `/setking user - Set King (shortcut)\n` +
    `/setenforcer user - Set Enforcer (shortcut)\n` +
    `/setguard user - Set Guard (shortcut)\n` +
    `/setpeasant user - Set Peasant (shortcut)\n` +
    `/award user <amount> <reason> - Award tickets (or /award user <amount> 💣 <reason> for bombs)\n` +
    `/deduct user <amount> <reason> - Deduct/remove tickets from a user (admin only)\n` +
    `/awardbomb user <amount> <reason> - Award bombs\n` +
    `/awardshield user <amount> <reason> - Award shields\n` +
    `/ban user <reason> - Ban to jail (admin only, free)\n` +
    `/jail user <reason> - Send to jail (admin only, user loses 10 tickets)\n` +
    `/remove user - Remove user from chat (admin only)\n` +
    `/add user - Add user back to chat\n` +
    `/invite - Create temporary invite link for Kingdom Reborn (1 hour, admin only)\n\n` +
    `**🎫 Tickets:**\n` +
    `/balance - Your balance\n` +
    `/history [user] - Transaction history\n` +
    `/redeem <action> - Redeem tickets\n` +
    `/spend <amount> <reason> - Spend tickets\n` +
    `/give user <amount> - Gift tickets to another user (max 10/day)\n\n` +
    `**⚔️ Assassination:**\n` +
    `/assassinate - Assassinate the King/Queen (costs 100 tickets, guards have 60s to block)\n` +
    `/block - Block an assassination attempt (Guards only, rewards 25 tickets)\n\n` +
    `**🎮 Games:**\n` +
    `/trivia <category> - Start a trivia game (Admin only)\n` +
    `  Categories: popculture, sports, tech\n` +
    `/stoptrivia - Stop active trivia game (Admin only)\n\n` +
    `**💣 Bombs:**\n` +
    `/bomb user <reason> - Use bomb (eliminates up to 5 tickets)\n\n` +
    `**🛡️ Shields:**\n` +
    `/shield - Check your shield count\n` +
    `/blockbomb - Block a recent bomb attack (must be used within 2 minutes)\n` +
    `Shields can block bomb attacks and restore your tickets if used within 2 minutes\n\n` +
    `**📜 Rules:**\n` +
    `/rules - List all rules\n\n` +
    `**🎯 Actions:**\n` +
    `/actions - List redeemable actions\n\n` +
    `**ℹ️ Info:**\n` +
    `/status - Game status\n` +
    `/roles - All role assignments\n` +
    `/leaderboard - Top ticket holders\n` +
    `/timesinjail - Times in jail leaderboard\n` +
    `/myrole - Your role\n` +
    `/daysasking - Days as King/Queen counter\n` +
    `/nickname [name] - Set your nickname\n\n` +
    `**📋 Recap:**\n` +
    `/recap [hours] - Activity recap (default: 24h)\n` +
    `/catchup - Your personal recap`;
}

/**
 * Show user's role
 */
async function myRole(context) {
  const { user } = context;
  
  const roleEmoji = {
    king: '👑',
    queen: '👑',
    enforcer: '⚖️',
    lawyer: '⚖️',
    peasant: '👤'
  };
  
  const roleName = {
    king: 'King',
    queen: 'Queen',
    enforcer: 'Enforcer',
    lawyer: 'Lawyer',
    peasant: 'Peasant'
  };
  
  const emoji = roleEmoji[user.role] || '👤';
  const name = roleName[user.role] || user.role;
  
  let message = `${emoji} Your role: **${name}**\n`;
  
  if (user.isInPrison) {
    message += `🔒 Status: In Prison`;
  }
  
  return message;
}

/**
 * Show Days as King/Queen status
 */
async function daysAsKing(context) {
  try {
    const kingsAndQueens = await User.findAll({
      where: {
        role: {
          [Op.in]: ['king', 'queen']
        }
      },
      order: [['daysAsKing', 'DESC']]
    });

    if (kingsAndQueens.length === 0) {
      return `👑 **Days as King/Queen**\n\nNo current Kings or Queens.`;
    }

    let message = `👑 **Days as King/Queen**\n\n`;
    
    for (const monarch of kingsAndQueens) {
      const roleDisplay = monarch.role === 'king' ? 'King' : 'Queen';
      const becameKingDate = monarch.becameKingAt 
        ? new Date(monarch.becameKingAt).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          })
        : 'Unknown';
      
      // Calculate time in reign (days, hours, minutes)
      let timeInReign = 'Unknown';
      if (monarch.becameKingAt) {
        const now = new Date();
        const becameKing = new Date(monarch.becameKingAt);
        const diffMs = now - becameKing;
        
        if (diffMs > 0) {
          const totalMinutes = Math.floor(diffMs / (1000 * 60));
          const totalHours = Math.floor(totalMinutes / 60);
          const totalDays = Math.floor(totalHours / 24);
          
          const days = totalDays;
          const hours = totalHours % 24;
          const minutes = totalMinutes % 60;
          
          const parts = [];
          if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
          if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
          if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
          
          timeInReign = parts.length > 0 ? parts.join(', ') : 'Less than a minute';
        }
      }
      
      message += `**${monarch.name}** (${roleDisplay})\n`;
      message += `📅 Time in reign: **${timeInReign}**\n`;
      message += `🕐 Became ${roleDisplay}: ${becameKingDate}\n\n`;
    }

    return message.trim();
  } catch (error) {
    console.error('Error getting Days as King:', error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Show times in jail leaderboard
 * Includes both /ban and /jail commands
 */
async function timesInJail(context) {
  try {
    // Get all jail and ban events (they're essentially the same thing)
    const jailEvents = await ActivityLog.findAll({
      where: {
        eventType: {
          [Op.in]: ['user_jailed_tickets', 'user_banned']
        }
      },
      include: [
        { model: User, as: 'targetUser', attributes: ['id', 'name', 'nickname'], required: true }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (jailEvents.length === 0) {
      return `🔒 **Times in Jail Leaderboard**\n\nNo one has been jailed or banned yet!`;
    }

    // Group by user and count occurrences, also collect reasons
    const jailStats = new Map();
    
    for (const event of jailEvents) {
      const userId = event.targetUserId;
      
      if (!jailStats.has(userId)) {
        jailStats.set(userId, {
          user: event.targetUser,
          count: 0,
          reasons: []
        });
      }
      
      const stats = jailStats.get(userId);
      stats.count++;
      
      // Extract reason from details
      if (event.details) {
        try {
          const details = JSON.parse(event.details);
          if (details.reason && details.reason.trim()) {
            stats.reasons.push(details.reason.trim());
          }
        } catch (e) {
          // If details can't be parsed, skip
        }
      }
    }

    // Convert to array and sort by count (descending)
    const leaderboard = Array.from(jailStats.values())
      .sort((a, b) => b.count - a.count);

    let message = `🔒 **Times in Jail Leaderboard**\n\n`;
    
    leaderboard.forEach((item, idx) => {
      const displayName = userService.getDisplayName(item.user);
      message += `${idx + 1}. **${displayName}**: ${item.count} time${item.count !== 1 ? 's' : ''}\n`;
      
      // Show reasons (limit to last 5 to avoid message being too long)
      if (item.reasons.length > 0) {
        const recentReasons = item.reasons.slice(-5).reverse(); // Most recent first
        const reasonsText = recentReasons.length === item.reasons.length
          ? recentReasons.join(', ')
          : `${recentReasons.join(', ')} (and ${item.reasons.length - recentReasons.length} more)`;
        
        message += `   📝 Reasons: ${reasonsText}\n`;
      }
      message += `\n`;
    });

    return message.trim();
  } catch (error) {
    console.error('Error getting times in jail:', error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Create a temporary invite link for Kingdom Reborn chat (1 hour expiration)
 * Admin only
 */
async function createInviteLink(context) {
  try {
    const { user } = context;
    
    // Check permissions - only admins can create invite links
    const canAdmin = await roleService.canPerformAdminAction(user.id);
    if (!canAdmin) {
      return "❌ Only Enforcer and King/Queen can create invite links.";
    }
    
    // Find the Kingdom Reborn chat
    const kingdomRebornGroup = await Group.findOne({
      where: {
        groupName: {
          [Op.like]: '%kingdom%reborn%'
        }
      }
    });
    
    if (!kingdomRebornGroup) {
      return "❌ Kingdom Reborn chat not found in database.";
    }
    
    const chatId = kingdomRebornGroup.messengerGroupId;
    
    // Calculate expiration time (1 hour from now)
    const expireDate = Math.floor(Date.now() / 1000) + 3600; // Current time + 1 hour in seconds
    
    // Create the invite link
    try {
      const invite = await createChatInviteLink(chatId, {
        name: `Temporary invite - ${user.name}`,
        expire_date: expireDate,
        member_limit: 1, // Only allow 1 person to join via this link
        creates_join_request: false
      });
      
      if (invite && invite.invite_link) {
        const expirationTime = new Date(expireDate * 1000).toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        return `🔗 **Temporary Invite Link Created**\n\n` +
               `**Chat:** ${kingdomRebornGroup.groupName}\n` +
               `**Link:** ${invite.invite_link}\n` +
               `**Expires:** ${expirationTime} (1 hour from now)\n` +
               `**Uses:** 1 person maximum\n\n` +
               `⚠️ This link will expire in 1 hour.`;
      } else {
        return "❌ Failed to create invite link. Please try again.";
      }
    } catch (error) {
      console.error('Error creating invite link:', error);
      if (error.message && error.message.includes('not enough rights')) {
        return "❌ Bot is not an admin in Kingdom Reborn chat. Please make the bot an admin first.";
      }
      return `❌ Error creating invite link: ${error.message}`;
    }
  } catch (error) {
    console.error('Error in createInviteLink:', error);
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  status,
  leaderboard,
  actions,
  help,
  myRole,
  roles,
  daysAsKing,
  timesInJail,
  createInviteLink
};

