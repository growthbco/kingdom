const User = require('../models/User');

/**
 * Get display name for a user (nickname if set, otherwise name)
 */
function getDisplayName(user) {
  return user.nickname || user.name;
}

/**
 * Set nickname for a user
 */
async function setNickname(userId, nickname) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // If nickname is empty or "clear", remove it
    if (!nickname || nickname.trim().toLowerCase() === 'clear') {
      user.nickname = null;
    } else {
      user.nickname = nickname.trim();
    }
    
    await user.save();
    return user;
  } catch (error) {
    console.error('Error setting nickname:', error);
    throw error;
  }
}

module.exports = {
  getDisplayName,
  setNickname
};





