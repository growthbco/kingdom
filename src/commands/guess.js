const miniGameService = require('../services/miniGameService');
const roleService = require('../services/roleService');
const { sendMessage } = require('../bot/telegramBot');

/**
 * Start a number guessing game (1-50)
 * Winner gets a bomb
 */
async function startGuess(context) {
  const { user, message } = context;
  const chatId = message.chat.id.toString();
  
  try {
    // Check if user is King or Queen
    if (user.role !== 'king' && user.role !== 'queen') {
      return "❌ Only the King/Queen can start guessing games!";
    }
    
    // Check if there's already an active game
    const activeGame = miniGameService.getActiveGame(chatId);
    if (activeGame) {
      return "❌ There is already an active game in progress. Please wait for it to finish.";
    }
    
    // Start the number guessing game
    await miniGameService.startNumberGuessGame(chatId);
    
    return `✅ Number guessing game started! Check the chat for details.`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  startGuess
};

