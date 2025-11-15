const DailyActivity = require('../models/DailyActivity');
const User = require('../models/User');
const ticketService = require('./ticketService');
const { sendMessage } = require('../bot/telegramBot');
const { Op } = require('sequelize');
const Group = require('../models/Group');

/**
 * Get or create daily activity record for a user
 */
async function getOrCreateDailyActivity(userId, chatId, date) {
  const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
  
  let activity = await DailyActivity.findOne({
    where: {
      userId,
      chatId: chatId.toString(),
      date: dateStr
    }
  });
  
  if (!activity) {
    activity = await DailyActivity.create({
      userId,
      chatId: chatId.toString(),
      date: dateStr,
      messageCount: 0,
      memeCount: 0,
      firstMessageOfDay: false,
      dailyWelfareReceived: false,
      activityRewardsGiven: 0
    });
  }
  
  return activity;
}

/**
 * Track a message sent by a user
 */
async function trackMessage(userId, chatId, isMeme = false) {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    const activity = await getOrCreateDailyActivity(userId, chatId, dateStr);
    
    // Check if this is first message of day
    const isFirstMessage = !activity.firstMessageOfDay;
    
    activity.messageCount += 1;
    activity.lastMessageTimestamp = today;
    
    if (isFirstMessage) {
      activity.firstMessageOfDay = true;
    }
    
    if (isMeme) {
      activity.memeCount += 1;
    }
    
    await activity.save();
    
    return { activity, isFirstMessage };
  } catch (error) {
    console.error('Error tracking message:', error);
    return { activity: null, isFirstMessage: false };
  }
}

/**
 * Award activity rewards to a user
 */
async function awardActivityRewards(userId, chatId) {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    const activity = await getOrCreateDailyActivity(userId, chatId, dateStr);
    let totalAwarded = 0;
    const reasons = [];
    
    // First message of day: 2 tickets
    if (activity.firstMessageOfDay && activity.messageCount === 1) {
      await ticketService.awardTickets(userId, 2, userId, 'First message of day');
      totalAwarded += 2;
      reasons.push('First message of day (+2)');
    }
    
    // Every 10 messages: 1 ticket (max 5/day = 50 messages)
    const messageRewards = Math.floor(activity.messageCount / 10);
    const maxMessageRewards = 5;
    const messageRewardsToGive = Math.min(messageRewards, maxMessageRewards) - Math.floor(activity.activityRewardsGiven / 2);
    
    if (messageRewardsToGive > 0) {
      await ticketService.awardTickets(userId, messageRewardsToGive, userId, `Every 10 messages (${activity.messageCount} messages)`);
      totalAwarded += messageRewardsToGive;
      reasons.push(`Message milestone (+${messageRewardsToGive})`);
    }
    
    // Memes: 1 ticket per meme (max 3/day)
    const memeRewardsToGive = Math.min(activity.memeCount, 3) - Math.floor(activity.activityRewardsGiven / 3);
    
    if (memeRewardsToGive > 0) {
      await ticketService.awardTickets(userId, memeRewardsToGive, userId, `Meme posts (${activity.memeCount} memes)`);
      totalAwarded += memeRewardsToGive;
      reasons.push(`Meme posts (+${memeRewardsToGive})`);
    }
    
    if (totalAwarded > 0) {
      activity.activityRewardsGiven += totalAwarded;
      await activity.save();
    }
    
    return { totalAwarded, reasons };
  } catch (error) {
    console.error('Error awarding activity rewards:', error);
    return { totalAwarded: 0, reasons: [] };
  }
}

/**
 * Distribute daily welfare to all users
 */
async function distributeDailyWelfare() {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    // Get all users
    const users = await User.findAll();
    const results = [];
    
    for (const user of users) {
      try {
        // Skip if already received today
        const activity = await DailyActivity.findOne({
          where: {
            userId: user.id,
            date: dateStr,
            dailyWelfareReceived: true
          }
        });
        
        if (activity) {
          continue; // Already received
        }
        
        // Determine welfare amount based on role and prison status
        let welfareAmount = 0;
        let reason = '';
        
        if (user.isInPrison) {
          welfareAmount = 2;
          reason = 'Daily welfare (Prisoner)';
        } else if (['king', 'queen', 'enforcer', 'lawyer', 'prosecutor'].includes(user.role)) {
          welfareAmount = 7;
          reason = 'Daily welfare (Official)';
        } else {
          welfareAmount = 5;
          reason = 'Daily welfare (Peasant)';
        }
        
        // Award tickets
        await ticketService.awardTickets(user.id, welfareAmount, user.id, reason);
        
        // Mark as received (try to get a group ID, or use a default)
        // Get all groups this user might be in, or use a default
        const userGroups = await Group.findAll({
          where: {
            messengerGroupId: { [Op.ne]: null }
          },
          limit: 1
        });
        
        const groupId = userGroups.length > 0 ? userGroups[0].messengerGroupId : 'global';
        const userActivity = await getOrCreateDailyActivity(user.id, groupId, dateStr);
        userActivity.dailyWelfareReceived = true;
        await userActivity.save();
        
        results.push({
          userId: user.id,
          username: user.name,
          amount: welfareAmount,
          role: user.role,
          isInPrison: user.isInPrison
        });
        
        // Notify user if they have a group chat
        if (user.currentGroupId) {
          try {
            await sendMessage(user.currentGroupId, `💰 Daily welfare received: ${welfareAmount} tickets! ${reason}`);
          } catch (error) {
            // User might not be in chat anymore, that's okay
            console.log(`Could not notify ${user.name} about welfare: ${error.message}`);
          }
        }
      } catch (error) {
        console.error(`Error distributing welfare to user ${user.id}:`, error);
      }
    }
    
    console.log(`Daily welfare distributed to ${results.length} users`);
    return results;
  } catch (error) {
    console.error('Error distributing daily welfare:', error);
    throw error;
  }
}

/**
 * Reset daily counters (called at midnight)
 */
async function resetDailyCounters() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Reset all activities from yesterday (they'll be recreated as needed)
    // Actually, we keep historical data, just create new records for today
    
    console.log('Daily counters reset for new day');
    return true;
  } catch (error) {
    console.error('Error resetting daily counters:', error);
    throw error;
  }
}

module.exports = {
  trackMessage,
  awardActivityRewards,
  distributeDailyWelfare,
  resetDailyCounters,
  getOrCreateDailyActivity
};

