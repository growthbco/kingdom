const User = require('../models/User');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');

/**
 * Check if there are any admins (enforcer, king, or queen)
 */
async function hasAnyAdmins() {
  try {
    const adminCount = await User.count({
      where: {
        role: {
          [Op.in]: ['enforcer', 'king', 'queen']
        }
      }
    });
    return adminCount > 0;
  } catch (error) {
    console.error('Error checking for admins:', error);
    return false;
  }
}

/**
 * Check if a user has permission to perform admin actions
 * Only Enforcer and King/Queen can perform admin actions
 * Exception: If no admins exist, anyone can set the first admin (bootstrap)
 */
async function canPerformAdminAction(userId) {
  try {
    const hasAdmins = await hasAnyAdmins();
    
    // If no admins exist, allow anyone to bootstrap
    if (!hasAdmins) {
      return true;
    }
    
    const user = await User.findByPk(userId);
    if (!user) return false;
    
    return user.role === 'enforcer' || user.role === 'king' || user.role === 'queen';
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
}

/**
 * Check if a user has a specific role
 */
async function hasRole(userId, role) {
  try {
    const user = await User.findByPk(userId);
    if (!user) return false;
    return user.role === role;
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
}

/**
 * Get user by Messenger ID
 */
async function getUserByMessengerId(messengerId) {
  try {
    return await User.findOne({ where: { messengerId } });
  } catch (error) {
    console.error('Error getting user by messenger ID:', error);
    return null;
  }
}

/**
 * Get user by name (username or display name)
 * Searches case-insensitively and supports partial matches
 */
async function getUserByName(name) {
  try {
    const lowerName = name.toLowerCase();
    // First try exact match (case-insensitive)
    let user = await User.findOne({
      where: Sequelize.where(
        Sequelize.fn('LOWER', Sequelize.col('name')),
        lowerName
      )
    });
    
    // If no exact match, try case-insensitive partial match
    if (!user) {
      user = await User.findOne({
        where: Sequelize.where(
          Sequelize.fn('LOWER', Sequelize.col('name')),
          {
            [Op.like]: `%${lowerName}%`
          }
        )
      });
    }
    
    return user;
  } catch (error) {
    console.error('Error getting user by name:', error);
    return null;
  }
}

/**
 * Create or update user
 */
async function createOrUpdateUser(messengerId, name, groupId) {
  try {
    const [user, created] = await User.findOrCreate({
      where: { messengerId },
      defaults: {
        name,
        role: 'peasant',
        currentGroupId: groupId
      }
    });

    if (!created && user.currentGroupId !== groupId) {
      user.currentGroupId = groupId;
      await user.save();
    }

    if (!created && user.name !== name) {
      user.name = name;
      await user.save();
    }

    return user;
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
}

/**
 * Set user role
 */
async function setUserRole(userId, role) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const validRoles = ['king', 'queen', 'peasant', 'enforcer', 'lawyer', 'guard', 'prosecutor', 'master'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    const previousRole = user.role;
    const isBecomingKing = (role === 'king' || role === 'queen') && (previousRole !== 'king' && previousRole !== 'queen');
    const isLosingKing = (previousRole === 'king' || previousRole === 'queen') && (role !== 'king' && role !== 'queen');

    // If becoming King/Queen, set becameKingAt and reset daysAsKing
    if (isBecomingKing) {
      user.becameKingAt = new Date();
      user.daysAsKing = 0;
    }

    // If losing King/Queen status, reset becameKingAt (but keep daysAsKing for history)
    if (isLosingKing) {
      user.becameKingAt = null;
    }

    user.role = role;
    await user.save();
    return user;
  } catch (error) {
    console.error('Error setting user role:', error);
    throw error;
  }
}

module.exports = {
  canPerformAdminAction,
  hasRole,
  getUserByMessengerId,
  getUserByName,
  createOrUpdateUser,
  setUserRole,
  hasAnyAdmins
};

