const MarketItem = require('../models/MarketItem');
const User = require('../models/User');
const ticketService = require('./ticketService');
const bombService = require('./bombService');
const shieldService = require('./shieldService');
const marketAttackService = require('./marketAttackService');
const protectionService = require('./protectionService');
const sequelize = require('../database/connection');
const TicketTransaction = require('../models/TicketTransaction');

// Market items configuration
const MARKET_ITEMS = {
  '🪩': { name: 'Disco Ball', cost: 40, description: 'Switch all inventory items with another person' },
  '🧨': { name: 'Dynamite', cost: 20, description: 'Wipes ALL tickets from a user' },
  '💣': { name: 'Market Bomb', cost: 5, description: 'Wipes 10 tickets from a user' },
  '🛡️': { name: 'Market Shield', cost: 30, description: 'Blocks dynamite or market bomb attacks' }
};

/**
 * Get all available market items
 */
function getMarketItems() {
  return MARKET_ITEMS;
}

/**
 * Get user's inventory
 */
async function getUserInventory(userId) {
  try {
    const items = await MarketItem.findAll({
      where: { userId },
      order: [['itemName', 'ASC']]
    });
    return items;
  } catch (error) {
    console.error('Error getting user inventory:', error);
    throw error;
  }
}

/**
 * Purchase a market item
 */
async function purchaseItem(userId, emoji) {
  try {
    const item = MARKET_ITEMS[emoji];
    if (!item) {
      throw new Error('Item not found in market');
    }

    const balance = await ticketService.getBalance(userId);
    if (balance < item.cost) {
      throw new Error(`Insufficient tickets. You have ${balance} 🎫, need ${item.cost} 🎫`);
    }

    // Deduct tickets
    await ticketService.awardTickets(
      userId,
      -item.cost,
      userId,
      `Purchased ${item.name} ${emoji} from market`
    );

    // Add item to inventory
    const [marketItem, created] = await MarketItem.findOrCreate({
      where: { userId, emoji },
      defaults: {
        userId,
        emoji,
        itemName: item.name,
        quantity: 1
      }
    });

    if (!created) {
      marketItem.quantity += 1;
      await marketItem.save();
    }

    return { item: marketItem, purchased: true };
  } catch (error) {
    console.error('Error purchasing item:', error);
    throw error;
  }
}

/**
 * Use disco ball to swap inventory with another user
 */
async function useDiscoBall(userId, targetUserId) {
  // Use a transaction to ensure all swaps happen atomically
  const transaction = await sequelize.transaction();
  
  try {
    console.log(`[Disco Ball] Starting swap between user ${userId} and target ${targetUserId}`);
    
    // Check if user has disco ball (within transaction)
    const discoBall = await MarketItem.findOne({
      where: { userId, emoji: '🪩' },
      transaction
    });

    if (!discoBall || discoBall.quantity < 1) {
      throw new Error('You don\'t have a disco ball!');
    }

    // Reload users within transaction to get fresh data
    const user = await User.findByPk(userId, { transaction });
    const targetUser = await User.findByPk(targetUserId, { transaction });

    if (!user || !targetUser) {
      throw new Error('User not found');
    }

    console.log(`[Disco Ball] User ${userId} has: ${user.bombs} bombs, ${user.shields} shields, ${user.killShields} kill shields`);
    console.log(`[Disco Ball] Target ${targetUserId} has: ${targetUser.bombs} bombs, ${targetUser.shields} shields, ${targetUser.killShields} kill shields`);

    // Get both users' inventories (within transaction)
    const userItems = await MarketItem.findAll({
      where: { userId },
      transaction
    });
    const targetItems = await MarketItem.findAll({
      where: { userId: targetUserId },
      transaction
    });

    console.log(`[Disco Ball] User has ${userItems.length} market items, Target has ${targetItems.length} market items`);

    // Store original values
    const userBombs = user.bombs || 0;
    const userShields = user.shields || 0;
    const userKillShields = user.killShields || 0;

    const targetBombs = targetUser.bombs || 0;
    const targetShields = targetUser.shields || 0;
    const targetKillShields = targetUser.killShields || 0;

    // Get ticket balances
    const userTicketBalance = await ticketService.getBalance(userId);
    const targetTicketBalance = await ticketService.getBalance(targetUserId);

    console.log(`[Disco Ball] User ${userId} has ${userTicketBalance} tickets, Target ${targetUserId} has ${targetTicketBalance} tickets`);

    // Swap tickets by creating transactions
    if (userTicketBalance !== targetTicketBalance) {
      const ticketDifference = targetTicketBalance - userTicketBalance;
      
      // Transfer tickets from target to user (if target has more)
      if (ticketDifference > 0) {
        // User gets target's tickets
        await TicketTransaction.create({
          userId,
          amount: ticketDifference,
          type: 'award',
          awardedBy: userId,
          reason: 'Disco ball swap - received tickets from swap'
        }, { transaction });
        
        // Target loses their tickets
        await TicketTransaction.create({
          userId: targetUserId,
          amount: -ticketDifference,
          type: 'redeem',
          awardedBy: userId,
          reason: 'Disco ball swap - transferred tickets to swap partner'
        }, { transaction });
      } else if (ticketDifference < 0) {
        // Target gets user's tickets
        await TicketTransaction.create({
          userId: targetUserId,
          amount: -ticketDifference, // This is positive since difference is negative
          type: 'award',
          awardedBy: targetUserId,
          reason: 'Disco ball swap - received tickets from swap'
        }, { transaction });
        
        // User loses their tickets
        await TicketTransaction.create({
          userId,
          amount: ticketDifference, // This is negative
          type: 'redeem',
          awardedBy: targetUserId,
          reason: 'Disco ball swap - transferred tickets to swap partner'
        }, { transaction });
      }
      
      console.log(`[Disco Ball] Swapped tickets - User now has ${targetTicketBalance}, Target now has ${userTicketBalance}`);
    }

    // Swap bombs
    user.bombs = targetBombs;
    targetUser.bombs = userBombs;

    // Swap shields
    user.shields = targetShields;
    targetUser.shields = userShields;

    // Swap kill shields
    user.killShields = targetKillShields;
    targetUser.killShields = userKillShields;

    // Save user changes (within transaction)
    await user.save({ transaction });
    await targetUser.save({ transaction });

    console.log(`[Disco Ball] Swapped user stats - User now has: ${user.bombs} bombs, ${user.shields} shields, ${user.killShields} kill shields`);

    // Swap market items (excluding disco ball)
    // Store item data before deletion
    const userItemsData = userItems
      .filter(item => item.emoji !== '🪩')
      .map(item => ({
        emoji: item.emoji,
        itemName: item.itemName,
        quantity: item.quantity
      }));
    
    const targetItemsData = targetItems
      .filter(item => item.emoji !== '🪩')
      .map(item => ({
        emoji: item.emoji,
        itemName: item.itemName,
        quantity: item.quantity
      }));

    console.log(`[Disco Ball] User has ${userItemsData.length} items to swap, Target has ${targetItemsData.length} items to swap`);

    // Delete user's items (except disco ball) - within transaction
    for (const item of userItems) {
      if (item.emoji !== '🪩') {
        await item.destroy({ transaction });
      }
    }

    // Delete target's items (except disco ball) - within transaction
    for (const item of targetItems) {
      if (item.emoji !== '🪩') {
        await item.destroy({ transaction });
      }
    }

    // Create copies of target's items for user (except disco ball) - within transaction
    for (const itemData of targetItemsData) {
      await MarketItem.create({
        userId,
        emoji: itemData.emoji,
        itemName: itemData.itemName,
        quantity: itemData.quantity
      }, { transaction });
      console.log(`[Disco Ball] Created ${itemData.quantity}x ${itemData.emoji} for user ${userId}`);
    }

    // Create copies of user's items for target (except disco ball) - within transaction
    for (const itemData of userItemsData) {
      await MarketItem.create({
        userId: targetUserId,
        emoji: itemData.emoji,
        itemName: itemData.itemName,
        quantity: itemData.quantity
      }, { transaction });
      console.log(`[Disco Ball] Created ${itemData.quantity}x ${itemData.emoji} for target ${targetUserId}`);
    }

    // Use one disco ball - within transaction
    discoBall.quantity -= 1;
    if (discoBall.quantity <= 0) {
      await discoBall.destroy({ transaction });
    } else {
      await discoBall.save({ transaction });
    }

    // Commit transaction
    await transaction.commit();
    
    console.log(`[Disco Ball] Swap completed successfully`);

    // Reload users to get final state
    await user.reload();
    await targetUser.reload();

    // Get final ticket balances after swap
    const finalUserTickets = await ticketService.getBalance(userId);
    const finalTargetTickets = await ticketService.getBalance(targetUserId);

    return {
      success: true,
      userBombs: user.bombs,
      userShields: user.shields,
      userKillShields: user.killShields,
      userTickets: finalUserTickets,
      targetBombs: targetUser.bombs,
      targetShields: targetUser.shields,
      targetKillShields: targetUser.killShields,
      targetTickets: finalTargetTickets
    };
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('[Disco Ball] Error using disco ball:', error);
    console.error('[Disco Ball] Transaction rolled back');
    throw error;
  }
}

/**
 * Get user's inventory summary (for display)
 */
async function getInventorySummary(userId) {
  try {
    const items = await getUserInventory(userId);
    const user = await User.findByPk(userId);
    
    const summary = {
      items: items.map(item => ({
        emoji: item.emoji,
        name: item.itemName,
        quantity: item.quantity
      })),
      bombs: user.bombs || 0,
      shields: user.shields || 0,
      killShields: user.killShields || 0
    };

    return summary;
  } catch (error) {
    console.error('Error getting inventory summary:', error);
    throw error;
  }
}

/**
 * Use dynamite on a target user (wipes all tickets)
 */
async function useDynamite(userId, targetUserId, reason, chatId) {
  try {
    // Check if user has dynamite
    const dynamite = await MarketItem.findOne({
      where: { userId, emoji: '🧨' }
    });

    if (!dynamite || dynamite.quantity < 1) {
      throw new Error('You don\'t have any dynamite!');
    }

    const user = await User.findByPk(userId);
    const targetUser = await User.findByPk(targetUserId);

    if (!user || !targetUser) {
      throw new Error('User not found');
    }

    if (targetUser.id === user.id) {
      throw new Error('You can\'t use dynamite on yourself!');
    }

    // Check if target is protected
    const isTargetProtected = await protectionService.isProtected(targetUserId);
    if (isTargetProtected) {
      throw new Error(`${targetUser.name} is protected by a cloak of protection and cannot be attacked!`);
    }

    // Get target's current ticket balance
    const targetBalance = await ticketService.getBalance(targetUserId);
    
    if (targetBalance === 0) {
      throw new Error(`${targetUser.name} has no tickets to eliminate!`);
    }

    // Record attack for potential shield blocking
    marketAttackService.recordAttack(
      targetUserId,
      userId,
      'dynamite',
      targetBalance,
      reason || `Dynamite used by ${user.name}`,
      chatId || null
    );

    // Wipe all tickets
    await ticketService.awardTickets(
      targetUserId,
      -targetBalance,
      userId,
      reason || `Dynamite used by ${user.name}`
    );

    // Use one dynamite
    dynamite.quantity -= 1;
    if (dynamite.quantity <= 0) {
      await dynamite.destroy();
    } else {
      await dynamite.save();
    }

    return {
      blocked: false,
      ticketsEliminated: targetBalance,
      targetBalance: 0,
      remainingDynamite: dynamite.quantity || 0
    };
  } catch (error) {
    console.error('Error using dynamite:', error);
    throw error;
  }
}

/**
 * Use market bomb on a target user (wipes 10 tickets)
 */
async function useMarketBomb(userId, targetUserId, reason, chatId) {
  try {
    // Check if user has market bomb
    const marketBomb = await MarketItem.findOne({
      where: { userId, emoji: '💣' }
    });

    if (!marketBomb || marketBomb.quantity < 1) {
      throw new Error('You don\'t have any market bombs!');
    }

    const user = await User.findByPk(userId);
    const targetUser = await User.findByPk(targetUserId);

    if (!user || !targetUser) {
      throw new Error('User not found');
    }

    if (targetUser.id === user.id) {
      throw new Error('You can\'t bomb yourself!');
    }

    // Check if target is protected
    const isTargetProtected = await protectionService.isProtected(targetUserId);
    if (isTargetProtected) {
      throw new Error(`${targetUser.name} is protected by a cloak of protection and cannot be attacked!`);
    }

    // Get target's current ticket balance
    const targetBalance = await ticketService.getBalance(targetUserId);
    
    // Eliminate up to 10 tickets
    const ticketsToEliminate = Math.min(10, targetBalance);
    
    if (ticketsToEliminate === 0) {
      throw new Error(`${targetUser.name} has no tickets to eliminate!`);
    }

    // Record attack for potential shield blocking
    marketAttackService.recordAttack(
      targetUserId,
      userId,
      'bomb',
      ticketsToEliminate,
      reason || `Market bomb used by ${user.name}`,
      chatId || null
    );

    // Subtract tickets from target
    await ticketService.awardTickets(
      targetUserId,
      -ticketsToEliminate,
      userId,
      reason || `Market bomb used by ${user.name}`
    );

    // Use one market bomb
    marketBomb.quantity -= 1;
    if (marketBomb.quantity <= 0) {
      await marketBomb.destroy();
    } else {
      await marketBomb.save();
    }

    return {
      blocked: false,
      ticketsEliminated: ticketsToEliminate,
      targetBalance: targetBalance - ticketsToEliminate,
      remainingBombs: marketBomb.quantity || 0
    };
  } catch (error) {
    console.error('Error using market bomb:', error);
    throw error;
  }
}

/**
 * Block a market attack (dynamite or bomb) using market shield
 */
async function blockMarketAttack(userId, targetUserId) {
  try {
    // Check if user has market shield
    const marketShield = await MarketItem.findOne({
      where: { userId, emoji: '🛡️' }
    });

    if (!marketShield || marketShield.quantity < 1) {
      throw new Error('You don\'t have any market shields!');
    }

    // Check if there's a recent attack
    const attack = marketAttackService.getRecentAttack(targetUserId);
    if (!attack) {
      throw new Error('No recent attack found to block!');
    }

    // Get target user
    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Restore tickets
    await ticketService.awardTickets(
      targetUserId,
      attack.ticketsLost,
      userId,
      `Market shield blocked ${attack.attackType} attack`
    );

    // Remove attack from tracking
    marketAttackService.blockAttack(targetUserId);

    // Use one market shield
    marketShield.quantity -= 1;
    if (marketShield.quantity <= 0) {
      await marketShield.destroy();
    } else {
      await marketShield.save();
    }

    return {
      success: true,
      attackType: attack.attackType,
      ticketsRestored: attack.ticketsLost,
      remainingShields: marketShield.quantity || 0
    };
  } catch (error) {
    console.error('Error blocking market attack:', error);
    throw error;
  }
}

module.exports = {
  getMarketItems,
  getUserInventory,
  purchaseItem,
  useDiscoBall,
  getInventorySummary,
  useDynamite,
  useMarketBomb,
  blockMarketAttack
};

