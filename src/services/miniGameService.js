const { sendMessage } = require('../bot/telegramBot');
const ticketService = require('./ticketService');
const roleService = require('../services/roleService');
const bombService = require('./bombService');
const claudeService = require('./claudeService');

// Store active games
const activeGames = new Map(); // chatId -> { type, question, answer, messageId, startTime, questionNumber, totalQuestions, category, timer, guessedUsers }

/**
 * Start a trivia game with a specific category
 */
async function startTriviaGame(chatId, category = null) {
  try {
    // Fallback question sets if Claude is unavailable
    const fallbackQuestionSets = {
      popculture: [
        { question: "Which movie won the Academy Award for Best Picture in 2020?", answer: "parasite" },
        { question: "Who sang the hit song 'Blinding Lights'?", answer: "the weeknd" },
        { question: "What streaming service is 'Stranger Things' on?", answer: "netflix" }
      ],
      sports: [
        { question: "Which team won the Super Bowl in 2024?", answer: "kansas city chiefs" },
        { question: "How many players are on a basketball court at once for one team?", answer: "5" },
        { question: "What sport is played at Wimbledon?", answer: "tennis" }
      ],
      tech: [
        { question: "What does CPU stand for?", answer: "central processing unit" },
        { question: "Which company created the iPhone?", answer: "apple" },
        { question: "What programming language is known for its use in web development?", answer: "javascript" }
      ]
    };
    
    // If no category provided, return available categories
    if (!category) {
      return { categories: Object.keys(fallbackQuestionSets) };
    }
    
    const categoryLower = category.toLowerCase();
    
    if (!fallbackQuestionSets[categoryLower]) {
      throw new Error(`Invalid category. Available: ${Object.keys(fallbackQuestionSets).join(', ')}`);
    }
    
    // Start with question 1
    const questionNumber = 1;
    const totalQuestions = 5;
    const reward = 1; // 1 ticket per correct answer
    const timeoutSeconds = 120; // 120 seconds to answer
    
    // Try to generate question using Claude
    let trivia = null;
    if (claudeService.isAvailable()) {
      console.log(`Generating trivia question for category: ${categoryLower}`);
      trivia = await claudeService.generateTriviaQuestion(categoryLower);
    }
    
    // Fallback to hardcoded questions if Claude fails
    if (!trivia) {
      console.log('Claude unavailable or failed, using fallback questions');
      const questions = fallbackQuestionSets[categoryLower];
      trivia = questions[Math.floor(Math.random() * questions.length)];
    }
    
    const categoryDisplay = {
      popculture: 'Pop Culture',
      sports: 'Sports',
      tech: 'Technology'
    };
    
    const message = await sendMessage(chatId,
      `🎮 **Trivia Game - ${categoryDisplay[categoryLower]}** 🎮\n\n` +
      `**Question ${questionNumber}/${totalQuestions}:**\n${trivia.question}\n\n` +
      `⏰ ${timeoutSeconds} seconds to answer!\n` +
      `🎫 Correct answer = ${reward} ticket\n\n` +
      `Reply to this message with your answer!`
    );
    
    const gameData = {
      type: 'trivia',
      question: trivia.question,
      answer: trivia.answer.toLowerCase(),
      messageId: message.message_id,
      reward: reward,
      category: categoryLower,
      questionNumber: questionNumber,
      totalQuestions: totalQuestions,
      timeoutSeconds: timeoutSeconds,
      usedQuestions: [trivia.question], // Track used questions
      startTime: new Date(),
      timer: null
    };
    
    activeGames.set(chatId.toString(), gameData);
    
    // Auto-advance after timeoutSeconds
    gameData.timer = setTimeout(async () => {
      const currentGame = activeGames.get(chatId.toString());
      if (currentGame && currentGame.type === 'trivia' && currentGame.messageId === message.message_id) {
        // Time's up - move to next question or end game
        await advanceToNextQuestion(chatId, currentGame);
      }
    }, timeoutSeconds * 1000);
    
    return message;
  } catch (error) {
    console.error('Error starting trivia game:', error);
    throw error;
  }
}

/**
 * Advance to next question or end game
 * @param {boolean} answeredCorrectly - If true, skip the "time's up" message
 */
async function advanceToNextQuestion(chatId, game, answeredCorrectly = false) {
  try {
    // Clear the timer
    if (game.timer) {
      clearTimeout(game.timer);
    }
    
    // Time's up message (only if no one answered correctly)
    if (!answeredCorrectly) {
      await sendMessage(chatId,
        `⏰ **Time's up!**\n\n` +
        `The answer was: "${game.answer}"\n\n` +
        `Moving to next question...`
      );
    }
    
    // Check if we've reached max questions
    if (game.questionNumber >= game.totalQuestions) {
      // Game over
      activeGames.delete(chatId.toString());
      await sendMessage(chatId,
        `🏁 **Trivia Game Complete!** 🏁\n\n` +
        `All ${game.totalQuestions} questions have been asked.\n` +
        `Thanks for playing!`
      );
      return;
    }
    
    const nextQuestionNumber = game.questionNumber + 1;
    const categoryDisplay = {
      popculture: 'Pop Culture',
      sports: 'Sports',
      tech: 'Technology'
    };
    
    // Try to generate next question using Claude
    let nextTrivia = null;
    if (claudeService.isAvailable()) {
      console.log(`Generating next trivia question for category: ${game.category}`);
      nextTrivia = await claudeService.generateTriviaQuestion(game.category);
    }
    
    // Fallback to hardcoded questions if Claude fails
    if (!nextTrivia) {
      console.log('Claude unavailable or failed, using fallback questions');
      const fallbackQuestionSets = {
        popculture: [
          { question: "Which movie won the Academy Award for Best Picture in 2020?", answer: "parasite" },
          { question: "Who sang the hit song 'Blinding Lights'?", answer: "the weeknd" },
          { question: "What streaming service is 'Stranger Things' on?", answer: "netflix" }
        ],
        sports: [
          { question: "Which team won the Super Bowl in 2024?", answer: "kansas city chiefs" },
          { question: "How many players are on a basketball court at once for one team?", answer: "5" },
          { question: "What sport is played at Wimbledon?", answer: "tennis" }
        ],
        tech: [
          { question: "What does CPU stand for?", answer: "central processing unit" },
          { question: "Which company created the iPhone?", answer: "apple" },
          { question: "What programming language is known for its use in web development?", answer: "javascript" }
        ]
      };
      
      const questions = fallbackQuestionSets[game.category] || [];
      let availableQuestions = questions.filter(q => !game.usedQuestions.includes(q.question));
      if (availableQuestions.length === 0) {
        availableQuestions = questions;
        game.usedQuestions = [];
      }
      nextTrivia = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    }
    
    game.usedQuestions.push(nextTrivia.question);
    const timeoutSeconds = game.timeoutSeconds || 120;
    
    // Send next question
    const nextMessage = await sendMessage(chatId,
      `🎮 **Trivia Game - ${categoryDisplay[game.category]}** 🎮\n\n` +
      `**Question ${nextQuestionNumber}/${game.totalQuestions}:**\n${nextTrivia.question}\n\n` +
      `⏰ ${timeoutSeconds} seconds to answer!\n` +
      `🎫 Correct answer = ${game.reward} ticket\n\n` +
      `Reply to this message with your answer!`
    );
    
    // Update game data
    game.question = nextTrivia.question;
    game.answer = nextTrivia.answer.toLowerCase();
    game.messageId = nextMessage.message_id;
    game.questionNumber = nextQuestionNumber;
    game.startTime = new Date();
    
    // Set timer for next question
    game.timer = setTimeout(async () => {
      const currentGame = activeGames.get(chatId.toString());
      if (currentGame && currentGame.type === 'trivia' && currentGame.messageId === nextMessage.message_id) {
        await advanceToNextQuestion(chatId, currentGame);
      }
    }, timeoutSeconds * 1000);
    
    activeGames.set(chatId.toString(), game);
  } catch (error) {
    console.error('Error advancing to next question:', error);
    activeGames.delete(chatId.toString());
  }
}

/**
 * Handle trivia answer
 */
async function handleTriviaAnswer(chatId, userId, username, answer) {
  try {
    const game = activeGames.get(chatId.toString());
    
    if (!game || game.type !== 'trivia') {
      return { success: false, message: null };
    }
    
    const answerLower = answer.toLowerCase().trim();
    
    if (answerLower === game.answer) {
      // Correct answer!
      const user = await roleService.getUserByMessengerId(userId.toString());
      if (user) {
        // Clear the timer since someone answered correctly
        if (game.timer) {
          clearTimeout(game.timer);
        }
        
        // Award tickets
        await ticketService.awardTickets(user.id, game.reward, user.id, `Trivia game win - Question ${game.questionNumber}`);
        
        // Get new balance
        const newBalance = await ticketService.getBalance(user.id);
        
        // Check if we've reached max questions
        if (game.questionNumber >= game.totalQuestions) {
          // Game over - last question
          activeGames.delete(chatId.toString());
          
          await sendMessage(chatId,
            `🎉 **${username} got it right!** 🎉\n\n` +
            `✅ **Correct answer:** "${game.answer}"\n` +
            `🎫 **Reward:** +${game.reward} ticket${game.reward !== 1 ? 's' : ''}\n` +
            `💰 **${username}'s balance:** ${newBalance} tickets\n\n` +
            `🏁 **Trivia Game Complete!** 🏁\n` +
            `All ${game.totalQuestions} questions have been asked.\n` +
            `Thanks for playing!`
          );
          
          return { 
            success: true, 
            message: `✅ **Correct!** You won ${game.reward} ticket${game.reward !== 1 ? 's' : ''}! Your new balance: ${newBalance} tickets` 
          };
        }
        
        // Send announcement to chat
        await sendMessage(chatId,
          `🎉 **${username} got it right!** 🎉\n\n` +
          `✅ **Correct answer:** "${game.answer}"\n` +
          `🎫 **Reward:** +${game.reward} ticket${game.reward !== 1 ? 's' : ''}\n` +
          `💰 **${username}'s balance:** ${newBalance} tickets\n\n` +
          `Moving to next question...`
        );
        
        // Advance to next question (without time's up message)
        await advanceToNextQuestion(chatId, game, true);
        
        return { 
          success: true, 
          message: `✅ **Correct!** You won ${game.reward} ticket${game.reward !== 1 ? 's' : ''}! Your new balance: ${newBalance} tickets` 
        };
      }
      
      return { success: false, message: "❌ Error: User not found" };
    }
    
    // Wrong answer - provide feedback
    return { 
      success: false, 
      message: `❌ **Incorrect answer.** Try again!` 
    };
  } catch (error) {
    console.error('Error handling trivia answer:', error);
    return { success: false, message: `❌ Error: ${error.message}` };
  }
}

/**
 * Get active game for a chat
 */
function getActiveGame(chatId) {
  const chatIdStr = chatId.toString();
  const game = activeGames.get(chatIdStr);
  console.log(`[getActiveGame] Chat: ${chatIdStr}, Found game: ${!!game}, Type: ${game?.type}, MessageId: ${game?.messageId}`);
  console.log(`[getActiveGame] All active games:`, Array.from(activeGames.keys()));
  return game || null;
}

/**
 * Stop/cancel an active game
 */
function stopGame(chatId) {
  const key = chatId.toString();
  const game = activeGames.get(key);
  if (game) {
    // Clear timer if exists
    if (game.timer) {
      clearTimeout(game.timer);
    }
    activeGames.delete(key);
    return true;
  }
  return false;
}

/**
 * Start a number guessing game (1-50)
 * Winner gets a bomb
 */
async function startNumberGuessGame(chatId) {
  try {
    const targetNumber = Math.floor(Math.random() * 50) + 1; // Random number 1-50
    
    const message = await sendMessage(chatId,
      `💣 **Bomb Guessing Game!** 💣\n\n` +
      `🎯 Guess the number between **1-50**!\n\n` +
      `💣 **Prize:** 1 bomb for the winner!\n` +
      `⚠️ **5 guesses per user**\n` +
      `⏳ Game continues until someone wins!\n\n` +
      `Reply to this message with your number guess!`
    );
    
    const gameData = {
      type: 'number_guess',
      targetNumber: targetNumber,
      messageId: message.message_id,
      startTime: new Date(),
      userGuesses: new Map(), // Track how many guesses each user has made (userId -> count)
      guessedNumbers: new Set() // Track which numbers have been guessed
    };
    
    const chatIdStr = chatId.toString();
    activeGames.set(chatIdStr, gameData);
    console.log(`[Number Guess] Game started in chat ${chatIdStr}, Message ID: ${message.message_id}, Target: ${targetNumber}`);
    
    return message;
  } catch (error) {
    console.error('Error starting number guess game:', error);
    throw error;
  }
}

/**
 * Handle number guess
 */
async function handleNumberGuess(chatId, userId, username, guess) {
  try {
    const game = activeGames.get(chatId.toString());
    
    console.log(`[Number Guess Handler] Chat: ${chatId}, Game exists: ${!!game}, Type: ${game?.type}`);
    
    if (!game || game.type !== 'number_guess') {
      console.log(`[Number Guess Handler] No active game found or wrong type`);
      return { success: false, message: null };
    }
    
    // Parse guess
    const guessNum = parseInt(guess.trim());
    if (isNaN(guessNum) || guessNum < 1 || guessNum > 50) {
      return { 
        success: false, 
        message: `❌ Invalid guess! Please enter a number between 1-50.` 
      };
    }
    
    // Check if this number was already guessed
    if (game.guessedNumbers.has(guessNum)) {
      return { 
        success: false, 
        message: `❌ Number ${guessNum} has already been guessed! Please pick a different number.` 
      };
    }
    
    // Check how many guesses the user has made
    const userIdStr = userId.toString();
    const userGuessCount = game.userGuesses.get(userIdStr) || 0;
    
    if (userGuessCount >= 5) {
      return { 
        success: false, 
        message: `❌ You've used all 5 guesses! Better luck next time.` 
      };
    }
    
    // Increment user's guess count and mark number as guessed
    game.userGuesses.set(userIdStr, userGuessCount + 1);
    game.guessedNumbers.add(guessNum);
    
    const remainingGuesses = 5 - (userGuessCount + 1);
    
    if (guessNum === game.targetNumber) {
      // Winner!
      console.log(`[Number Guess] Winner detected! User: ${username}, UserId: ${userId}`);
      
      // Try to get user by messenger ID first
      let user = await roleService.getUserByMessengerId(userId.toString());
      
      // If not found, create or update user
      if (!user) {
        console.log(`[Number Guess] User not found by messengerId, creating/updating user...`);
        user = await roleService.createOrUpdateUser(
          userId.toString(),
          username,
          chatId.toString()
        );
      }
      
      if (user) {
        try {
          console.log(`[Number Guess] Awarding bomb to user ${user.id} (${user.name})`);
          
          // Award bomb
          await bombService.awardBomb(user.id, 1, user.id, 'Won number guessing game');
          const bombCount = await bombService.getBombCount(user.id);
          
          console.log(`[Number Guess] Bomb awarded successfully! New count: ${bombCount}`);
          
          // End game
          activeGames.delete(chatId.toString());
          
          await sendMessage(chatId,
            `🎉 **${username} WINS!** 🎉\n\n` +
            `✅ **Correct number:** ${game.targetNumber}\n` +
            `💣 **Prize:** 1 bomb awarded!\n` +
            `💣 **${username}'s bomb count:** ${bombCount}\n\n` +
            `Game over! Thanks for playing!`
          );
          
          return { 
            success: true, 
            message: `🎉 **YOU WIN!** The number was ${game.targetNumber}! You won 1 💣! Your bomb count: ${bombCount}` 
          };
        } catch (bombError) {
          console.error(`[Number Guess] Error awarding bomb:`, bombError);
          console.error(`[Number Guess] Error stack:`, bombError.stack);
          
          // End game anyway
          activeGames.delete(chatId.toString());
          
          await sendMessage(chatId,
            `🎉 **${username} WINS!** 🎉\n\n` +
            `✅ **Correct number:** ${game.targetNumber}\n` +
            `⚠️ **Error awarding bomb:** ${bombError.message}\n\n` +
            `Please contact an admin to manually award the bomb.`
          );
          
          return { 
            success: true, 
            message: `🎉 **YOU WIN!** The number was ${game.targetNumber}! There was an error awarding the bomb - please contact an admin.` 
          };
        }
      }
      
      console.error(`[Number Guess] Could not find or create user for ${username} (${userId})`);
      return { success: false, message: "❌ Error: Could not find or create user" };
    }
    
    // Wrong guess - no hints, just confirm it was wrong
    const guessText = remainingGuesses > 0 
      ? `❌ **Wrong guess!** Number ${guessNum} is not correct. You have ${remainingGuesses} guess${remainingGuesses !== 1 ? 'es' : ''} remaining.`
      : `❌ **Wrong guess!** Number ${guessNum} is not correct. You've used all 5 guesses!`;
    
    return { 
      success: false, 
      message: guessText
    };
  } catch (error) {
    console.error('Error handling number guess:', error);
    return { success: false, message: `❌ Error: ${error.message}` };
  }
}

/**
 * End number guess game (time's up)
 */
async function endNumberGuessGame(chatId, game, hasWinner) {
  try {
    if (game.timer) {
      clearTimeout(game.timer);
    }
    
    if (!hasWinner) {
      await sendMessage(chatId,
        `⏰ **Time's up!**\n\n` +
        `The number was: **${game.targetNumber}**\n` +
        `No one guessed correctly. Better luck next time!`
      );
    }
    
    activeGames.delete(chatId.toString());
  } catch (error) {
    console.error('Error ending number guess game:', error);
    activeGames.delete(chatId.toString());
  }
}

module.exports = {
  startTriviaGame,
  handleTriviaAnswer,
  startNumberGuessGame,
  handleNumberGuess,
  getActiveGame,
  stopGame
};

