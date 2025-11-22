const sequelize = require('./connection');
const User = require('../models/User');
const ticketService = require('../services/ticketService');

async function awardEveryoneTickets() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    const users = await User.findAll();
    console.log(`Found ${users.length} users`);
    
    let awarded = 0;
    let failed = 0;
    
    for (const user of users) {
      try {
        await ticketService.awardTickets(
          user.id,
          10,
          user.id, // Self-awarded
          'Universal ticket award - 10 tickets for all users'
        );
        awarded++;
        console.log(`✅ Awarded 10 tickets to ${user.name}`);
      } catch (error) {
        console.error(`❌ Error awarding tickets to ${user.name}:`, error.message);
        failed++;
      }
    }
    
    console.log('\n✅ Completed!');
    console.log(`Awarded: ${awarded} users`);
    if (failed > 0) {
      console.log(`Failed: ${failed} users`);
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

awardEveryoneTickets();


