const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const { Op } = require('sequelize');

// Ensure associations are set up
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ActivityLog.belongsTo(User, { foreignKey: 'targetUserId', as: 'targetUser' });

/**
 * Log an activity event
 */
async function logActivity(eventType, options = {}) {
  try {
    const {
      userId = null,
      targetUserId = null,
      details = null,
      chatId = null
    } = options;

    return await ActivityLog.create({
      eventType,
      userId,
      targetUserId,
      details: details ? JSON.stringify(details) : null,
      chatId
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - activity logging shouldn't break main functionality
  }
}

/**
 * Get recent activities for recap
 */
async function getRecentActivities(chatId = null, hours = 24, limit = 50) {
  try {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const where = {
      createdAt: {
        [Op.gte]: since
      }
    };

    if (chatId) {
      where.chatId = chatId;
    }

    return await ActivityLog.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['name', 'role'], required: false },
        { model: User, as: 'targetUser', attributes: ['name', 'role'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit
    });
  } catch (error) {
    console.error('Error getting recent activities:', error);
    return [];
  }
}

/**
 * Get activities since a specific time
 */
async function getActivitiesSince(since, chatId = null) {
  try {
    const where = {
      createdAt: {
        [Op.gte]: since
      }
    };

    if (chatId) {
      where.chatId = chatId;
    }

    return await ActivityLog.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['name', 'role'], required: false },
        { model: User, as: 'targetUser', attributes: ['name', 'role'], required: false }
      ],
      order: [['createdAt', 'ASC']]
    });
  } catch (error) {
    console.error('Error getting activities since:', error);
    return [];
  }
}

module.exports = {
  logActivity,
  getRecentActivities,
  getActivitiesSince
};

