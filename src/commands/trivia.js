const miniGameService = require('../services/miniGameService');
const roleService = require('../services/roleService');
const { sendMessage } = require('../bot/telegramBot');

/**
 * Start a trivia game (Admin only)
 */
async function trivia(args, context) {
  const { user, message } = context;
  const chatId = message.chat.id.toString();
  
  try {
    // Check admin permissions
    const canAdmin = await roleService.canPerformAdminAction(user.id);
    if (!canAdmin) {
      return "❌ Only Enforcer and King/Queen can start trivia games!";
    }
    
    // Check if there's already an active game
    const activeGame = miniGameService.getActiveGame(chatId);
    if (activeGame) {
      return "❌ There is already an active game in progress. Use /stoptrivia to cancel it first.";
    }
    
    // Check if category was provided
    if (args.length === 0) {
      return `🎮 **Choose a Trivia Category:**\n\n` +
        `Available categories:\n` +
        `• **popculture** - Movies, music, TV shows, celebrities\n` +
        `• **sports** - Sports trivia and facts\n` +
        `• **tech** - Technology, programming, computers\n\n` +
        `Usage: /trivia <category>\n` +
        `Example: /trivia popculture`;
    }
    
    const category = args[0].toLowerCase();
    const validCategories = ['popculture', 'sports', 'tech'];
    
    if (!validCategories.includes(category)) {
      return `❌ Invalid category! Available categories:\n` +
        `• popculture\n` +
        `• sports\n` +
        `• tech\n\n` +
        `Usage: /trivia <category>`;
    }
    
    // Start the trivia game with selected category
    await miniGameService.startTriviaGame(chatId, category);
    
    const categoryDisplay = {
      popculture: 'Pop Culture',
      sports: 'Sports',
      tech: 'Technology'
    };
    
    return `✅ Trivia game started! Category: **${categoryDisplay[category]}**\nCheck the chat for the question.`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Stop/cancel an active trivia game (Admin only)
 */
async function stopTrivia(context) {
  const { user, message } = context;
  const chatId = message.chat.id.toString();
  
  try {
    // Check admin permissions
    const canAdmin = await roleService.canPerformAdminAction(user.id);
    if (!canAdmin) {
      return "❌ Only Enforcer and King/Queen can stop trivia games!";
    }
    
    // Check if there's an active game
    const activeGame = miniGameService.getActiveGame(chatId);
    if (!activeGame || activeGame.type !== 'trivia') {
      return "❌ There is no active trivia game to stop.";
    }
    
    // Stop the game
    miniGameService.stopGame(chatId);
    
    // Notify chat
    await sendMessage(chatId, `⏹️ **Trivia game cancelled by ${user.name}**\n\nThe game has been stopped.`);
    
    return "✅ Trivia game stopped.";
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  trivia,
  stopTrivia
};

