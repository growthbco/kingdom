const User = require('../models/User');
const ticketService = require('./ticketService');
const TicketTransaction = require('../models/TicketTransaction');

/**
 * Get user's current bomb count
 */
async function getBombCount(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.bombs || 0;
  } catch (error) {
    console.error('Error getting bomb count:', error);
    throw error;
  }
}

/**
 * Award bombs to a user
 */
async function awardBomb(userId, amount, awardedBy, reason) {
  try {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.bombs = (user.bombs || 0) + amount;
    await user.save();

    return user;
  } catch (error) {
    console.error('Error awarding bomb:', error);
    throw error;
  }
}

/**
 * Use a bomb on a target user (eliminates up to 5 tickets)
 */
async function useBomb(userId, targetUserId, reason) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if ((user.bombs || 0) < 1) {
      throw new Error('You don\'t have any bombs!');
    }

    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Get target's current ticket balance
    const targetBalance = await ticketService.getBalance(targetUserId);
    
    // Eliminate up to 5 tickets
    const ticketsToEliminate = Math.min(5, targetBalance);
    
    if (ticketsToEliminate === 0) {
      throw new Error(`${targetUser.name} has no tickets to eliminate!`);
    }

    // Subtract tickets from target
    await ticketService.awardTickets(
      targetUserId,
      -ticketsToEliminate,
      userId,
      reason || `Bomb used by ${user.name}`
    );

    // Remove one bomb from user
    user.bombs = (user.bombs || 0) - 1;
    await user.save();

    return {
      ticketsEliminated: ticketsToEliminate,
      targetBalance: targetBalance - ticketsToEliminate,
      remainingBombs: user.bombs
    };
  } catch (error) {
    console.error('Error using bomb:', error);
    throw error;
  }
}

module.exports = {
  getBombCount,
  awardBomb,
  useBomb
};





