const User = require('../models/User');
const Rule = require('../models/Rule');
const RedemptionAction = require('../models/RedemptionAction');
const ticketService = require('../services/ticketService');
const bombService = require('../services/bombService');
const roleService = require('../services/roleService');
const userService = require('../services/userService');

/**
 * Show game status
 */
async function status(context) {
  try {
    const king = await User.findOne({ where: { role: 'king' } });
    const queen = await User.findOne({ where: { role: 'queen' } });
    const enforcer = await User.findOne({ where: { role: 'enforcer' } });
    const lawyers = await User.findAll({ where: { role: 'lawyer' } });
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
      peasant: '👤'
    };
    
    const roleNames = {
      king: 'King',
      queen: 'Queen',
      enforcer: 'Enforcer',
      lawyer: 'Lawyers',
      peasant: 'Peasants'
    };
    
    // Show roles in order of importance
    const roleOrder = ['king', 'queen', 'enforcer', 'lawyer', 'peasant'];
    
    roleOrder.forEach(role => {
      const roleUsers = roleGroups[role];
      if (roleUsers.length > 0) {
        const emoji = roleEmojis[role];
        const name = roleNames[role];
        message += `${emoji} **${name}** (${roleUsers.length}):\n`;
        
        roleUsers.forEach(user => {
          let userLine = `   • ${user.name}`;
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
        return {
          user,
          tickets: ticketBalance,
          bombs: bombCount
        };
      })
    );
    
    // Sort by tickets (descending), then by bombs (descending)
    balances.sort((a, b) => {
      if (b.tickets !== a.tickets) {
        return b.tickets - a.tickets;
      }
      return b.bombs - a.bombs;
    });
    
    let message = "🏆 **Kingdom Leaderboard**\n\n";
    
    balances.forEach((item, idx) => {
      const displayName = userService.getDisplayName(item.user);
      const parts = [];
      
      if (item.tickets > 0) {
        parts.push(`${item.tickets} 🎫`);
      } else {
        parts.push(`0 🎫`);
      }
      
      if (item.bombs > 0) {
        parts.push(`${item.bombs} 💣`);
      } else {
        parts.push(`0 💣`);
      }
      
      message += `${idx + 1}. ${displayName}: ${parts.join(' and ')}\n`;
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
    `/setking user - Set King\n` +
    `/setqueen user - Set Queen\n` +
    `/setenforcer user - Set Enforcer\n` +
    `/setguard user - Set Guard\n` +
    `/setpeasant user - Set Peasant\n` +
    `/award user <amount> <reason> - Award tickets (or /award user <amount> 💣 <reason> for bombs)\n` +
    `/awardbomb user <amount> <reason> - Award bombs\n` +
    `/ban user <reason> - Ban to jail (admin only, free)\n` +
    `/jail user <reason> - Send to jail (admin only, costs 5 tickets)\n` +
    `/pardon user - Pardon from jail\n` +
    `/addrule <text> - Add rule\n` +
    `/removerule <id> - Remove rule\n` +
    `/editrule <id> <text> - Edit rule\n` +
    `/addaction <name> <cost> <desc> - Create action\n` +
    `/setjailchat - Set jail chat\n` +
    `/removejailchat - Remove jail chat\n` +
    `/remove user - Remove user from jail chat (jail chat only)\n\n` +
    `**🎫 Tickets:**\n` +
    `/balance - Your balance\n` +
    `/history [user] - Transaction history\n` +
    `/redeem <action> - Redeem tickets\n` +
    `/spend <amount> <reason> - Spend tickets\n` +
    `/give user <amount> - Gift tickets to another user (max 10/day)\n` +
    `/pay user <amount> <service> - Pay for services (e.g., lawyers)\n\n` +
    `**⚔️ Assassination:**\n` +
    `/assassinate - Assassinate the King/Queen (costs 100 tickets, guards have 60s to block)\n` +
    `/block - Block an assassination attempt (Guards only, rewards 25 tickets)\n\n` +
    `**🎮 Games:**\n` +
    `/trivia <category> - Start a trivia game (King/Queen only)\n` +
    `  Categories: popculture, sports, tech\n` +
    `/stoptrivia - Stop active trivia game (King/Queen only)\n\n` +
    `**💣 Bombs:**\n` +
    `/bomb user <reason> - Use bomb (eliminates up to 5 tickets)\n\n` +
    `**📜 Rules:**\n` +
    `/rules - List all rules\n\n` +
    `**🎯 Actions:**\n` +
    `/actions - List redeemable actions\n\n` +
    `**ℹ️ Info:**\n` +
    `/status - Game status\n` +
    `/roles - All role assignments\n` +
    `/leaderboard - Top ticket holders\n` +
    `/myrole - Your role\n` +
    `/daysasking - Days as King/Queen counter\n` +
    `/nickname [name] - Set your nickname\n\n` +
    `**📋 Recap:**\n` +
    `/recap [hours] - Activity recap (default: 24h)\n` +
    `/catchup - Your personal recap\n\n` +
    `_Note: Lawyers can be paid using /give command. Legal cases are handled manually._`;
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
          [require('sequelize').Op.in]: ['king', 'queen']
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

module.exports = {
  status,
  leaderboard,
  actions,
  help,
  myRole,
  roles,
  daysAsKing
};

