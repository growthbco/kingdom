const Protection = require('../models/Protection');
const User = require('../models/User');

const PROTECTION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if a user is currently protected
 */
async function isProtected(userId) {
  try {
    const now = new Date();
    const protection = await Protection.findOne({
      where: {
        userId,
        isActive: true,
        expiresAt: {
          [require('sequelize').Op.gt]: now
        }
      },
      order: [['expiresAt', 'DESC']]
    });

    return protection !== null;
  } catch (error) {
    console.error('Error checking protection:', error);
    return false;
  }
}

/**
 * Get active protection for a user
 */
async function getActiveProtection(userId) {
  try {
    const now = new Date();
    const protection = await Protection.findOne({
      where: {
        userId,
        isActive: true,
        expiresAt: {
          [require('sequelize').Op.gt]: now
        }
      },
      order: [['expiresAt', 'DESC']]
    });
    
    return protection;
  } catch (error) {
    console.error('Error getting active protection:', error);
    return null;
  }
}

/**
 * Activate protection for a user (24 hours)
 */
async function activateProtection(userId, protectedByUserId) {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PROTECTION_DURATION_MS);

    // Deactivate any existing protections for this user
    await Protection.update(
      { isActive: false },
      {
        where: {
          userId,
          isActive: true
        }
      }
    );

    // Create new protection
    const protection = await Protection.create({
      userId,
      protectedBy: protectedByUserId,
      expiresAt,
      isActive: true
    });

    return protection;
  } catch (error) {
    console.error('Error activating protection:', error);
    throw error;
  }
}

/**
 * Deactivate protection for a user
 */
async function deactivateProtection(userId) {
  try {
    await Protection.update(
      { isActive: false },
      {
        where: {
          userId,
          isActive: true
        }
      }
    );
    return true;
  } catch (error) {
    console.error('Error deactivating protection:', error);
    throw error;
  }
}

/**
 * Clean up expired protections
 */
async function cleanupExpired() {
  try {
    const now = new Date();
    const result = await Protection.update(
      { isActive: false },
      {
        where: {
          isActive: true,
          expiresAt: {
            [require('sequelize').Op.lt]: now
          }
        }
      }
    );
    return result[0]; // Number of rows updated
  } catch (error) {
    console.error('Error cleaning up expired protections:', error);
    return 0;
  }
}

/**
 * Get remaining protection time in milliseconds
 */
async function getRemainingTime(userId) {
  try {
    const protection = await getActiveProtection(userId);
    if (!protection) {
      return 0;
    }

    const now = new Date();
    const remaining = protection.expiresAt.getTime() - now.getTime();
    return Math.max(0, remaining);
  } catch (error) {
    console.error('Error getting remaining protection time:', error);
    return 0;
  }
}

module.exports = {
  isProtected,
  getActiveProtection,
  activateProtection,
  deactivateProtection,
  cleanupExpired,
  getRemainingTime,
  PROTECTION_DURATION_MS
};

