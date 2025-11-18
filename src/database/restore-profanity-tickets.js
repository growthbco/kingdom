const sequelize = require('./connection');
const { Op } = require('sequelize');
const TicketTransaction = require('../models/TicketTransaction');
const User = require('../models/User');

// Set up relationships
TicketTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
TicketTransaction.belongsTo(User, { foreignKey: 'awardedBy', as: 'awarder' });

/**
 * Restore all tickets that were removed due to profanity penalties
 */
async function restoreProfanityTickets() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Find all transactions where tickets were deducted for profanity
    const profanityTransactions = await TicketTransaction.findAll({
      where: {
        amount: {
          [Op.lt]: 0 // Negative amounts (deductions)
        },
        reason: {
          [Op.like]: '%profanity%'
        }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'messengerId']
        }
      ],
      order: [['timestamp', 'ASC']]
    });

    console.log(`\nFound ${profanityTransactions.length} profanity-related ticket deductions.`);

    if (profanityTransactions.length === 0) {
      console.log('No profanity-related ticket deductions found. Nothing to restore.');
      return;
    }

    // Group by user to show summary
    const userSummary = {};
    let totalTicketsToRestore = 0;

    profanityTransactions.forEach(tx => {
      const userId = tx.userId;
      if (!userSummary[userId]) {
        userSummary[userId] = {
          user: tx.user,
          transactions: [],
          totalDeducted: 0
        };
      }
      userSummary[userId].transactions.push(tx);
      userSummary[userId].totalDeducted += Math.abs(tx.amount); // Convert negative to positive
      totalTicketsToRestore += Math.abs(tx.amount);
    });

    // Display summary
    console.log('\n=== Summary of Profanity Ticket Deductions ===');
    console.log(`Total users affected: ${Object.keys(userSummary).length}`);
    console.log(`Total tickets to restore: ${totalTicketsToRestore}\n`);

    Object.values(userSummary).forEach(({ user, transactions, totalDeducted }) => {
      console.log(`  ${user.name} (ID: ${user.id}): ${totalDeducted} tickets from ${transactions.length} transaction(s)`);
    });

    // Ask for confirmation (in a real script, you might want to add a prompt)
    console.log('\n=== Restoring Tickets ===');

    let restoredCount = 0;
    let restoredTickets = 0;

    // Restore tickets for each transaction
    for (const tx of profanityTransactions) {
      const restoreAmount = Math.abs(tx.amount); // Convert negative to positive
      
      // Create a new transaction to restore the tickets
      await TicketTransaction.create({
        userId: tx.userId,
        amount: restoreAmount,
        type: 'award',
        awardedBy: null, // System restoration
        reason: `Restored: ${tx.reason} (Original transaction ID: ${tx.id})`
      });

      restoredCount++;
      restoredTickets += restoreAmount;

      const user = await User.findByPk(tx.userId);
      console.log(`  ✓ Restored ${restoreAmount} tickets to ${user.name} (Transaction ID: ${tx.id})`);
    }

    console.log(`\n=== Restoration Complete ===`);
    console.log(`Transactions processed: ${restoredCount}`);
    console.log(`Total tickets restored: ${restoredTickets}`);

    // Verify balances
    console.log('\n=== Verifying Balances ===');
    for (const userId of Object.keys(userSummary)) {
      const user = await User.findByPk(userId);
      const allTransactions = await TicketTransaction.findAll({
        where: { userId }
      });
      const balance = allTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      console.log(`  ${user.name}: ${balance} tickets`);
    }

    console.log('\n✅ All profanity-related tickets have been restored!');
    
  } catch (error) {
    console.error('❌ Error restoring tickets:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
if (require.main === module) {
  restoreProfanityTickets()
    .then(() => {
      console.log('\nScript completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nScript failed:', error);
      process.exit(1);
    });
}

module.exports = { restoreProfanityTickets };

