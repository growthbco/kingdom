const User = require('../models/User');

/**
 * Get user's current shield count
 */
async function getShieldCount(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.shields || 0;
  } catch (error) {
    console.error('Error getting shield count:', error);
    throw error;
  }
}

/**
 * Award shields to a user
 */
async function awardShield(userId, amount, awardedBy, reason) {
  try {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.shields = (user.shields || 0) + amount;
    await user.save();

    return user;
  } catch (error) {
    console.error('Error awarding shield:', error);
    throw error;
  }
}

/**
 * Use a shield to block a bomb attack (automatically called when bomb is used)
 * Returns true if shield was used, false if no shield available
 */
async function useShield(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if ((user.shields || 0) < 1) {
      return false;
    }

    // Remove one shield
    user.shields = (user.shields || 0) - 1;
    await user.save();

    return true;
  } catch (error) {
    console.error('Error using shield:', error);
    throw error;
  }
}

/**
 * Get user's current kill shield count
 */
async function getKillShieldCount(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.killShields || 0;
  } catch (error) {
    console.error('Error getting kill shield count:', error);
    throw error;
  }
}

/**
 * Award kill shields to a user
 */
async function awardKillShield(userId, amount, awardedBy, reason) {
  try {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.killShields = (user.killShields || 0) + amount;
    await user.save();

    return user;
  } catch (error) {
    console.error('Error awarding kill shield:', error);
    throw error;
  }
}

/**
 * Use a kill shield to block a kill attempt
 * Returns true if kill shield was used, false if no kill shield available
 */
async function useKillShield(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if ((user.killShields || 0) < 1) {
      return false;
    }

    // Remove one kill shield
    user.killShields = (user.killShields || 0) - 1;
    await user.save();

    return true;
  } catch (error) {
    console.error('Error using kill shield:', error);
    throw error;
  }
}

module.exports = {
  getShieldCount,
  awardShield,
  useShield,
  getKillShieldCount,
  awardKillShield,
  useKillShield
};


