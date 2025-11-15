const TicketTransaction = require('../models/TicketTransaction');
const User = require('../models/User');
const RedemptionAction = require('../models/RedemptionAction');

/**
 * Get user's current ticket balance
 */
async function getBalance(userId) {
  try {
    const transactions = await TicketTransaction.findAll({
      where: { userId }
    });

    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error;
  }
}

/**
 * Award tickets to a user (or subtract if negative)
 */
async function awardTickets(userId, amount, awardedBy, reason) {
  try {
    if (amount === 0) {
      throw new Error('Amount cannot be zero');
    }

    // Determine transaction type based on amount
    const transactionType = amount > 0 ? 'award' : 'redeem';

    const transaction = await TicketTransaction.create({
      userId,
      amount,
      type: transactionType,
      awardedBy,
      reason
    });

    return transaction;
  } catch (error) {
    console.error('Error awarding tickets:', error);
    throw error;
  }
}

/**
 * Redeem tickets for an action
 */
async function redeemTickets(userId, actionId) {
  try {
    const action = await RedemptionAction.findByPk(actionId);
    if (!action) {
      throw new Error('Action not found');
    }

    if (!action.isActive) {
      throw new Error('Action is not active');
    }

    const balance = await getBalance(userId);
    if (balance < action.ticketCost) {
      throw new Error(`Insufficient tickets. You have ${balance}, need ${action.ticketCost}`);
    }

    const transaction = await TicketTransaction.create({
      userId,
      amount: -action.ticketCost,
      type: 'redeem',
      actionId,
      reason: `Redeemed: ${action.actionName}`
    });

    return { transaction, action };
  } catch (error) {
    console.error('Error redeeming tickets:', error);
    throw error;
  }
}

/**
 * Get transaction history for a user
 */
async function getHistory(userId, limit = 10) {
  try {
    return await TicketTransaction.findAll({
      where: { userId },
      include: [
        { model: User, as: 'awarder', attributes: ['name', 'messengerId'] },
        { model: RedemptionAction, as: 'action', attributes: ['actionName', 'ticketCost'] }
      ],
      order: [['timestamp', 'DESC']],
      limit
    });
  } catch (error) {
    console.error('Error getting history:', error);
    throw error;
  }
}

/**
 * Get leaderboard of top ticket holders
 */
async function getLeaderboard(limit = 10) {
  try {
    const users = await User.findAll();
    const balances = await Promise.all(
      users.map(async (user) => ({
        user,
        balance: await getBalance(user.id)
      }))
    );

    return balances
      .filter(item => item.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw error;
  }
}

module.exports = {
  getBalance,
  awardTickets,
  redeemTickets,
  getHistory,
  getLeaderboard
};

