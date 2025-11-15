const sequelize = require('./connection');
const User = require('../models/User');
const TicketTransaction = require('../models/TicketTransaction');
const ticketService = require('../services/ticketService');

async function resetAllTicketsTo10() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection established.');
    
    console.log('Fetching all users...');
    const users = await User.findAll();
    console.log(`Found ${users.length} users.`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const user of users) {
      try {
        // Get current balance
        const currentBalance = await ticketService.getBalance(user.id);
        
        // Calculate difference needed
        const targetBalance = 10;
        const difference = targetBalance - currentBalance;
        
        if (difference === 0) {
          console.log(`User ${user.name} already has ${currentBalance} tickets - skipping`);
          skipped++;
          continue;
        }
        
        // Award the difference (can be negative to subtract)
        await ticketService.awardTickets(
          user.id,
          difference,
          user.id,
          `Balance reset to ${targetBalance} tickets`
        );
        
        const newBalance = await ticketService.getBalance(user.id);
        console.log(`✅ ${user.name}: ${currentBalance} → ${newBalance} tickets`);
        updated++;
      } catch (error) {
        console.error(`Error resetting tickets for user ${user.name}:`, error.message);
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Updated: ${updated} users`);
    console.log(`Skipped: ${skipped} users (already at 10)`);
    console.log(`Total: ${users.length} users`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting tickets:', error);
    process.exit(1);
  }
}

resetAllTicketsTo10();


