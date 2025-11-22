const { sendMessage } = require('../bot/telegramBot');
const ticketService = require('./ticketService');
const roleService = require('../services/roleService');

// Store active drops
const activeDrops = new Map(); // chatId -> { type, messageId, winners, maxWinners, reward }

/**
 * Create a ticket rain event
 */
async function createTicketRain(chatId) {
  try {
    const message = await sendMessage(chatId, 
      `💰 **TICKET RAIN!** 💰\n\n` +
      `First 3 people to react with 🎫 get 5 tickets each!\n\n` +
      `React to this message now!`
    );
    
    activeDrops.set(chatId.toString(), {
      type: 'ticket_rain',
      messageId: message.message_id,
      winners: [],
      maxWinners: 3,
      reward: 5,
      startTime: new Date()
    });
    
    // Auto-expire after 5 minutes
    setTimeout(() => {
      const drop = activeDrops.get(chatId.toString());
      if (drop && drop.type === 'ticket_rain' && drop.messageId === message.message_id) {
        activeDrops.delete(chatId.toString());
      }
    }, 5 * 60 * 1000);
    
    return message;
  } catch (error) {
    console.error('Error creating ticket rain:', error);
    throw error;
  }
}

/**
 * Create a bounty/riddle event
 */
async function createBounty(chatId) {
  try {
    const riddles = [
      { question: "What has keys but no locks, space but no room, and you can enter but not go inside?", answer: "keyboard" },
      { question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "echo" },
      { question: "The more you take, the more you leave behind. What am I?", answer: "footsteps" },
      { question: "What has a head, a tail, is brown, and has no legs?", answer: "penny" },
      { question: "What gets wetter the more it dries?", answer: "towel" }
    ];
    
    const riddle = riddles[Math.floor(Math.random() * riddles.length)];
    
    const message = await sendMessage(chatId,
      `🎯 **BOUNTY!** 🎯\n\n` +
      `First person to answer correctly gets 10 tickets!\n\n` +
      `**Riddle:** ${riddle.question}\n\n` +
      `Reply to this message with your answer!`
    );
    
    activeDrops.set(chatId.toString(), {
      type: 'bounty',
      messageId: message.message_id,
      winners: [],
      maxWinners: 1,
      reward: 10,
      riddleAnswer: riddle.answer.toLowerCase(),
      startTime: new Date()
    });
    
    // Auto-expire after 10 minutes
    setTimeout(() => {
      const drop = activeDrops.get(chatId.toString());
      if (drop && drop.type === 'bounty' && drop.messageId === message.message_id) {
        activeDrops.delete(chatId.toString());
        sendMessage(chatId, `⏰ Bounty expired! The answer was: "${riddle.answer}"`);
      }
    }, 10 * 60 * 1000);
    
    return message;
  } catch (error) {
    console.error('Error creating bounty:', error);
    throw error;
  }
}

/**
 * Handle reaction to ticket rain
 */
async function handleTicketRainReaction(chatId, userId, username) {
  try {
    const drop = activeDrops.get(chatId.toString());
    
    if (!drop || drop.type !== 'ticket_rain') {
      return false;
    }
    
    if (drop.winners.length >= drop.maxWinners) {
      return false; // Already full
    }
    
    if (drop.winners.includes(userId.toString())) {
      return false; // Already won
    }
    
    // Add winner
    drop.winners.push(userId.toString());
    
    // Award tickets
    const user = await roleService.getUserByMessengerId(userId.toString());
    if (user) {
      await ticketService.awardTickets(user.id, drop.reward, user.id, 'Ticket Rain reward');
      
      await sendMessage(chatId, 
        `🎉 ${username} won ${drop.reward} tickets from the Ticket Rain! ` +
        `(${drop.winners.length}/${drop.maxWinners} winners)`
      );
      
      // If all winners collected, remove drop
      if (drop.winners.length >= drop.maxWinners) {
        activeDrops.delete(chatId.toString());
        await sendMessage(chatId, `💰 Ticket Rain complete! All ${drop.maxWinners} winners have been rewarded!`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error handling ticket rain reaction:', error);
    return false;
  }
}

/**
 * Handle bounty answer
 */
async function handleBountyAnswer(chatId, userId, username, answer) {
  try {
    const drop = activeDrops.get(chatId.toString());
    
    if (!drop || drop.type !== 'bounty') {
      return false;
    }
    
    if (drop.winners.length >= drop.maxWinners) {
      return false; // Already won
    }
    
    const answerLower = answer.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const riddleAnswerLower = drop.riddleAnswer.toLowerCase().trim().replace(/[^\w\s]/g, '');
    
    if (answerLower === riddleAnswerLower) {
      // Correct answer!
      drop.winners.push(userId.toString());
      
      // Get or create user
      let user = await roleService.getUserByMessengerId(userId.toString());
      if (!user) {
        // User not found, create them
        user = await roleService.createOrUpdateUser(
          userId.toString(),
          username,
          chatId.toString()
        );
      }
      
      if (user) {
        try {
          await ticketService.awardTickets(user.id, drop.reward, user.id, 'Bounty reward');
          const newBalance = await ticketService.getBalance(user.id);
          
          await sendMessage(chatId,
            `🎉 **${username} solved the bounty!** 🎉\n\n` +
            `✅ Correct answer: "${drop.riddleAnswer}"\n` +
            `🎫 Reward: +${drop.reward} tickets!\n` +
            `💰 ${username}'s balance: ${newBalance} tickets`
          );
          
          activeDrops.delete(chatId.toString());
          return true;
        } catch (ticketError) {
          console.error('Error awarding tickets for bounty:', ticketError);
          await sendMessage(chatId,
            `🎉 **${username} solved the bounty!** 🎉\n\n` +
            `✅ Correct answer: "${drop.riddleAnswer}"\n` +
            `⚠️ Error awarding tickets: ${ticketError.message}\n` +
            `Please contact an admin to manually award ${drop.reward} tickets.`
          );
          activeDrops.delete(chatId.toString());
          return true;
        }
      } else {
        console.error(`Could not find or create user for ${username} (${userId})`);
        return false;
      }
    }
    
    return false; // Wrong answer
  } catch (error) {
    console.error('Error handling bounty answer:', error);
    console.error('Error stack:', error.stack);
    return false;
  }
}

/**
 * Get active drop for a chat
 */
function getActiveDrop(chatId) {
  return activeDrops.get(chatId.toString()) || null;
}

module.exports = {
  createTicketRain,
  createBounty,
  handleTicketRainReaction,
  handleBountyAnswer,
  getActiveDrop
};

