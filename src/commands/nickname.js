const userService = require('../services/userService');
const roleService = require('../services/roleService');
const User = require('../models/User');

/**
 * Set nickname for yourself or another user (admin only for others)
 */
async function setNickname(args, context) {
  const { user, message } = context;
  
  // Check if setting nickname for someone else (admin only)
  let targetUser = user;
  let nicknameArg = args.join(' ');
  
  if (args.length > 1) {
    // Format: /nickname user nickname or /nickname @user nickname
    const canAdmin = await roleService.canPerformAdminAction(user.id);
    if (!canAdmin) {
      return "❌ Only Enforcer and King/Queen can set nicknames for others.";
    }
    
    const mention = args[0];
    const username = mention.startsWith('@') ? mention.substring(1) : mention;
    const foundUser = await roleService.getUserByName(username);
    if (!foundUser) {
      return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found.`;
    }
    targetUser = foundUser;
    nicknameArg = args.slice(1).join(' ');
  }
  
  if (!nicknameArg || nicknameArg.trim() === '') {
    return "❌ Usage: /nickname <nickname> or /nickname user <nickname>\nUse /nickname clear to remove your nickname.";
  }
  
  try {
    const updatedUser = await userService.setNickname(targetUser.id, nicknameArg);
    const displayName = userService.getDisplayName(updatedUser);
    
    if (nicknameArg.toLowerCase() === 'clear') {
      return `✅ Nickname cleared! You'll now be displayed as "${updatedUser.name}".`;
    }
    
    if (targetUser.id === user.id) {
      return `✅ Your nickname has been set to "${nicknameArg}"!\nYou'll now be displayed as "${nicknameArg}" instead of "${updatedUser.name}".`;
    } else {
      return `✅ ${updatedUser.name}'s nickname has been set to "${nicknameArg}"!`;
    }
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Show current nickname
 */
async function showNickname(context) {
  const { user } = context;
  const displayName = userService.getDisplayName(user);
  
  if (user.nickname) {
    return `📝 **Your Nickname:**\n"${user.nickname}"\n\nYour real name: ${user.name}\nDisplay name: ${user.nickname}\n\nUse /nickname clear to remove it.`;
  } else {
    return `📝 **Your Nickname:**\nNone set\n\nYour display name: ${user.name}\n\nUse /nickname <name> to set a nickname!`;
  }
}

module.exports = {
  setNickname,
  showNickname
};

