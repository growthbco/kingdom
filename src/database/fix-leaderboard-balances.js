const sequelize = require('./connection');
const User = require('../models/User');
const ticketService = require('../services/ticketService');
const bombService = require('../services/bombService');
const userService = require('../services/userService');
require('dotenv').config();

/**
 * Fix leaderboard balances to match expected values
 */
async function fixLeaderboardBalances() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Expected balances by display name
    const expectedBalances = {
      'King G': { tickets: 70, bombs: 0 },
      'The Knights Watch': { tickets: 66, bombs: 0 },
      'Peasant Claire': { tickets: 54, bombs: 1 },
      'Prosecutor Courtney': { tickets: 52, bombs: 0 },
      'JarelisM10': { tickets: 46, bombs: 0 },
      'Lawyer J': { tickets: 36, bombs: 1 },
      'Zoe': { tickets: 32, bombs: 0 },
      'Dana': { tickets: 31, bombs: 0 },
      'Rene': { tickets: 24, bombs: 0 },
      'Nico': { tickets: 23, bombs: 0 },
      'Justin': { tickets: 10, bombs: 1 }, // Note: might be Justy
      'Justy': { tickets: 9, bombs: 0 },
      'Kingofthechat_bot': { tickets: 0, bombs: 0 },
      // Users not in expected leaderboard should be set to 0
      'Peasant Caro': { tickets: 0, bombs: 0 }
    };

    // Get all users
    const users = await User.findAll();

    console.log('\n=== Adjusting Ticket Balances ===\n');

    for (const user of users) {
      const displayName = userService.getDisplayName(user);
      const expected = expectedBalances[displayName];

      if (!expected) {
        // Check if it's "Justin" but user is "Justy"
        if (displayName === 'Justy' && expectedBalances['Justin']) {
          // Skip - we'll handle Justy separately
          continue;
        }
        console.log(`⚠️  No expected balance for: ${displayName} (${user.name})`);
        continue;
      }

      const currentTickets = await ticketService.getBalance(user.id);
      const currentBombs = await bombService.getBombCount(user.id);

      const ticketDiff = expected.tickets - currentTickets;
      const bombDiff = expected.bombs - currentBombs;

      if (ticketDiff !== 0) {
        console.log(`${displayName}: Adjusting tickets from ${currentTickets} to ${expected.tickets} (diff: ${ticketDiff > 0 ? '+' : ''}${ticketDiff})`);
        await ticketService.awardTickets(
          user.id,
          ticketDiff,
          null, // System adjustment
          `Balance correction to match expected leaderboard`
        );
      }

      if (bombDiff !== 0) {
        console.log(`${displayName}: Adjusting bombs from ${currentBombs} to ${expected.bombs} (diff: ${bombDiff > 0 ? '+' : ''}${bombDiff})`);
        // Update bomb count directly
        user.bombs = expected.bombs;
        await user.save();
      }

      if (ticketDiff === 0 && bombDiff === 0) {
        console.log(`${displayName}: Already correct (${currentTickets} 🎫, ${currentBombs} 💣)`);
      }
    }

    // Handle "Justin" - check if it's actually "Justy" or a different user
    if (expectedBalances['Justin']) {
      const justinUser = users.find(u => {
        const displayName = userService.getDisplayName(u);
        return displayName.toLowerCase().includes('justin') || u.name.toLowerCase().includes('justin');
      });

      if (justinUser) {
        const displayName = userService.getDisplayName(justinUser);
        const currentTickets = await ticketService.getBalance(justinUser.id);
        const currentBombs = await bombService.getBombCount(justinUser.id);
        const ticketDiff = expectedBalances['Justin'].tickets - currentTickets;
        const bombDiff = expectedBalances['Justin'].bombs - currentBombs;

        if (ticketDiff !== 0 || bombDiff !== 0) {
          console.log(`\n${displayName} (Justin): Adjusting tickets from ${currentTickets} to ${expectedBalances['Justin'].tickets}`);
          if (ticketDiff !== 0) {
            await ticketService.awardTickets(
              justinUser.id,
              ticketDiff,
              null,
              `Balance correction to match expected leaderboard`
            );
          }
          if (bombDiff !== 0) {
            justinUser.bombs = expectedBalances['Justin'].bombs;
            await justinUser.save();
          }
        }
      } else {
        console.log('\n⚠️  User "Justin" not found. May need to be created or might be "Justy".');
      }
    }

    console.log('\n=== Verification ===\n');
    // Verify balances
    const allUsers = await User.findAll();
    const balances = await Promise.all(allUsers.map(async (u) => ({
      user: u,
      tickets: await ticketService.getBalance(u.id),
      bombs: await bombService.getBombCount(u.id)
    })));

    balances.sort((a, b) => b.tickets !== a.tickets ? b.tickets - a.tickets : b.bombs - a.bombs);

    balances.forEach((item, idx) => {
      const displayName = userService.getDisplayName(item.user);
      const expected = expectedBalances[displayName];
      const match = expected && expected.tickets === item.tickets && expected.bombs === item.bombs;
      const status = match ? '✅' : '⚠️';
      console.log(`${status} ${idx + 1}. ${displayName}: ${item.tickets} 🎫 and ${item.bombs} 💣${expected ? ` (expected: ${expected.tickets} 🎫, ${expected.bombs} 💣)` : ''}`);
    });

    console.log('\n✅ Balance adjustment complete!');

  } catch (error) {
    console.error('❌ Error fixing balances:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
if (require.main === module) {
  fixLeaderboardBalances()
    .then(() => {
      console.log('\nScript completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nScript failed:', error);
      process.exit(1);
    });
}

module.exports = { fixLeaderboardBalances };

