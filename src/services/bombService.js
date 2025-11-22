const User = require('../models/User');
const MarketItem = require('../models/MarketItem');
const ticketService = require('./ticketService');
const TicketTransaction = require('../models/TicketTransaction');
const bombAttackService = require('./bombAttackService');
const protectionService = require('./protectionService');

/**
 * Get user's current bomb count (includes both regular and market bombs)
 */
async function getBombCount(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const regularBombs = user.bombs || 0;
    
    // Also check for market bombs
    const marketBomb = await MarketItem.findOne({
      where: { userId, emoji: '💣' }
    });
    const marketBombs = marketBomb ? marketBomb.quantity : 0;
    
    return regularBombs + marketBombs;
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
 * Checks both regular bombs (User.bombs) and market bombs (MarketItem)
 */
async function useBomb(userId, targetUserId, reason, chatId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Check if target is protected
    const isTargetProtected = await protectionService.isProtected(targetUserId);
    if (isTargetProtected) {
      throw new Error(`${targetUser.name} is protected by a cloak of protection and cannot be attacked!`);
    }

    // Check for regular bombs first
    const regularBombs = user.bombs || 0;
    // Check for market bombs
    const marketBomb = await MarketItem.findOne({
      where: { userId, emoji: '💣' }
    });
    const marketBombs = marketBomb ? marketBomb.quantity : 0;

    const totalBombs = regularBombs + marketBombs;

    if (totalBombs < 1) {
      throw new Error('You don\'t have any bombs!');
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

    // Record the attack for potential shield blocking (2 minute window)
    bombAttackService.recordAttack(
      targetUserId,
      userId,
      ticketsToEliminate,
      reason || `Bomb used by ${user.name}`,
      chatId || null
    );

    // Use a bomb - prefer market bombs first, then regular bombs
    let remainingBombs = regularBombs;
    if (marketBombs > 0) {
      // Use market bomb
      marketBomb.quantity -= 1;
      if (marketBomb.quantity <= 0) {
        await marketBomb.destroy();
      } else {
        await marketBomb.save();
      }
      remainingBombs = regularBombs + (marketBomb.quantity || 0);
    } else {
      // Use regular bomb
      user.bombs = regularBombs - 1;
      await user.save();
      remainingBombs = user.bombs;
    }

    return {
      blocked: false,
      ticketsEliminated: ticketsToEliminate,
      targetBalance: targetBalance - ticketsToEliminate,
      remainingBombs: remainingBombs,
      shieldUsed: false
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








