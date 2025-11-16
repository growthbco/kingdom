const cron = require('node-cron');
const automatedRewardsService = require('./automatedRewardsService');
const randomDropService = require('./randomDropService');
const miniGameService = require('./miniGameService');
const Group = require('../models/Group');
const User = require('../models/User');

/**
 * Initialize all scheduled tasks
 */
function initializeScheduler() {
  console.log('Initializing scheduler service...');
  
  // Daily welfare at midnight EST (00:00 EST = 05:00 UTC)
  // Using cron: "0 5 * * *" for 5 AM UTC = midnight EST
  cron.schedule('0 5 * * *', async () => {
    console.log('Running daily welfare distribution...');
    try {
      await automatedRewardsService.distributeDailyWelfare();
      await automatedRewardsService.resetDailyCounters();
      await incrementDaysAsKing();
    } catch (error) {
      console.error('Error in daily welfare cron job:', error);
    }
  }, {
    timezone: 'America/New_York'
  });
  
  console.log('Daily welfare scheduled for midnight EST');
  
  // Random drops throughout the day
  // Schedule random drops at various times (every 3-6 hours)
  scheduleRandomDrops();
  console.log('Scheduler initialized');
}

/**
 * Schedule random drops throughout the day
 */
function scheduleRandomDrops() {
  // Random drops at various times: 8am, 12pm, 4pm, 8pm EST
  const dropTimes = ['8', '12', '16', '20'];
  
  dropTimes.forEach(hour => {
    cron.schedule(`0 ${hour} * * *`, async () => {
      console.log(`Running random drop at ${hour}:00 EST...`);
      try {
        await triggerRandomDrop();
      } catch (error) {
        console.error('Error in random drop cron job:', error);
      }
    }, {
      timezone: 'America/New_York'
    });
  });
  
  console.log('Random drops scheduled');
}

/**
 * Increment Days as King counter for all current Kings/Queens
 */
async function incrementDaysAsKing() {
  try {
    console.log('Incrementing Days as King counter...');
    const kingsAndQueens = await User.findAll({
      where: {
        role: {
          [require('sequelize').Op.in]: ['king', 'queen']
        }
      }
    });

    let updatedCount = 0;
    for (const monarch of kingsAndQueens) {
      monarch.daysAsKing = (monarch.daysAsKing || 0) + 1;
      await monarch.save();
      updatedCount++;
      console.log(`✅ ${monarch.name} (${monarch.role}): ${monarch.daysAsKing} days`);
    }

    if (updatedCount === 0) {
      console.log('No Kings/Queens found to update.');
    } else {
      console.log(`Updated Days as King for ${updatedCount} monarch(s).`);
    }
  } catch (error) {
    console.error('Error incrementing Days as King:', error);
  }
}

/**
 * Trigger a random drop (ticket rain, bounty, or mini-game)
 */
async function triggerRandomDrop() {
  try {
    // Get all active groups
    const groups = await Group.findAll({
      where: {
        type: 'main'
      }
    });
    
    if (groups.length === 0) {
      return;
    }
    
    // Pick a random group
    const group = groups[Math.floor(Math.random() * groups.length)];
    const chatId = group.messengerGroupId;
    
    // Randomly choose drop type
    const dropTypes = ['ticket_rain', 'bounty', 'trivia'];
    const dropType = dropTypes[Math.floor(Math.random() * dropTypes.length)];
    
    switch (dropType) {
      case 'ticket_rain':
        await randomDropService.createTicketRain(chatId);
        break;
      case 'bounty':
        await randomDropService.createBounty(chatId);
        break;
      case 'trivia':
        // Random category for scheduled trivia
        const categories = ['popculture', 'sports', 'tech'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        await miniGameService.startTriviaGame(chatId, randomCategory);
        break;
    }
    
    console.log(`Random ${dropType} triggered in chat ${chatId}`);
  } catch (error) {
    console.error('Error triggering random drop:', error);
  }
}

module.exports = {
  initializeScheduler
};

