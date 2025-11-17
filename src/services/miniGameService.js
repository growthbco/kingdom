const { sendMessage } = require('../bot/telegramBot');
const ticketService = require('./ticketService');
const roleService = require('../services/roleService');
const bombService = require('./bombService');

// Store active games
const activeGames = new Map(); // chatId -> { type, question, answer, messageId, startTime, questionNumber, totalQuestions, category, timer, guessedUsers }

/**
 * Start a trivia game with a specific category
 */
async function startTriviaGame(chatId, category = null) {
  try {
    const questionSets = {
      popculture: [
        { question: "Which movie won the Academy Award for Best Picture in 2020?", answer: "parasite" },
        { question: "Who sang the hit song 'Blinding Lights'?", answer: "the weeknd" },
        { question: "What streaming service is 'Stranger Things' on?", answer: "netflix" },
        { question: "Which rapper released the album 'DAMN.'?", answer: "kendrick lamar" },
        { question: "What is the name of the main character in 'Breaking Bad'?", answer: "walter white" },
        { question: "Which Marvel movie was the first to gross over $2 billion worldwide?", answer: "avengers endgame" },
        { question: "Who played the Joker in 'The Dark Knight'?", answer: "heath ledger" },
        { question: "What year did TikTok launch globally?", answer: "2018" },
        { question: "Which TV show features the character Eleven?", answer: "stranger things" },
        { question: "What is the highest-grossing film of all time?", answer: "avatar" }
      ],
      sports: [
        { question: "Which team won the Super Bowl in 2024?", answer: "kansas city chiefs" },
        { question: "How many players are on a basketball court at once for one team?", answer: "5" },
        { question: "What sport is played at Wimbledon?", answer: "tennis" },
        { question: "Which country won the FIFA World Cup in 2022?", answer: "argentina" },
        { question: "What is the maximum score in a single frame of bowling?", answer: "300" },
        { question: "Which NBA player is known as 'King James'?", answer: "lebron james" },
        { question: "How many innings are in a standard baseball game?", answer: "9" },
        { question: "What is the name of the trophy awarded to the winner of the Stanley Cup?", answer: "stanley cup" },
        { question: "Which sport uses a shuttlecock?", answer: "badminton" },
        { question: "How many players are on a soccer team on the field at once?", answer: "11" }
      ],
      tech: [
        { question: "What does CPU stand for?", answer: "central processing unit" },
        { question: "Which company created the iPhone?", answer: "apple" },
        { question: "What programming language is known for its use in web development and was created by Brendan Eich?", answer: "javascript" },
        { question: "What does HTML stand for?", answer: "hypertext markup language" },
        { question: "Which social media platform was originally called 'TheFacebook'?", answer: "facebook" },
        { question: "What is the name of Google's mobile operating system?", answer: "android" },
        { question: "What does API stand for?", answer: "application programming interface" },
        { question: "Which company owns GitHub?", answer: "microsoft" },
        { question: "What is the name of Amazon's cloud computing platform?", answer: "aws" },
        { question: "What does VPN stand for?", answer: "virtual private network" }
      ]
    };
    
    // If no category provided, return available categories
    if (!category) {
      return { categories: Object.keys(questionSets) };
    }
    
    const categoryLower = category.toLowerCase();
    const questions = questionSets[categoryLower];
    
    if (!questions) {
      throw new Error(`Invalid category. Available: ${Object.keys(questionSets).join(', ')}`);
    }
    
    // Start with question 1
    const questionNumber = 1;
    const totalQuestions = 5;
    const reward = 1; // 1 ticket per correct answer
    
    // Get random question
    const trivia = questions[Math.floor(Math.random() * questions.length)];
    
    const categoryDisplay = {
      popculture: 'Pop Culture',
      sports: 'Sports',
      tech: 'Technology'
    };
    
    const message = await sendMessage(chatId,
      `🎮 **Trivia Game - ${categoryDisplay[categoryLower]}** 🎮\n\n` +
      `**Question ${questionNumber}/${totalQuestions}:**\n${trivia.question}\n\n` +
      `⏰ 15 seconds to answer!\n` +
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
      questions: questions, // Store all questions for this category
      usedQuestions: [trivia.question], // Track used questions
      startTime: new Date(),
      timer: null
    };
    
    activeGames.set(chatId.toString(), gameData);
    
    // Auto-advance after 15 seconds
    gameData.timer = setTimeout(async () => {
      const currentGame = activeGames.get(chatId.toString());
      if (currentGame && currentGame.type === 'trivia' && currentGame.messageId === message.message_id) {
        // Time's up - move to next question or end game
        await advanceToNextQuestion(chatId, currentGame);
      }
    }, 15 * 1000); // 15 seconds
    
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
    
    // Get next question (avoid duplicates)
    let availableQuestions = game.questions.filter(q => !game.usedQuestions.includes(q.question));
    if (availableQuestions.length === 0) {
      // All questions used, reset
      availableQuestions = game.questions;
      game.usedQuestions = [];
    }
    
    const nextTrivia = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    game.usedQuestions.push(nextTrivia.question);
    
    const nextQuestionNumber = game.questionNumber + 1;
    const categoryDisplay = {
      popculture: 'Pop Culture',
      sports: 'Sports',
      tech: 'Technology'
    };
    
    // Send next question
    const nextMessage = await sendMessage(chatId,
      `🎮 **Trivia Game - ${categoryDisplay[game.category]}** 🎮\n\n` +
      `**Question ${nextQuestionNumber}/${game.totalQuestions}:**\n${nextTrivia.question}\n\n` +
      `⏰ 15 seconds to answer!\n` +
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
    }, 15 * 1000); // 15 seconds
    
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
  return activeGames.get(chatId.toString()) || null;
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
    const timeLimit = 60; // 60 seconds
    
    const message = await sendMessage(chatId,
      `💣 **Bomb Guessing Game!** 💣\n\n` +
      `🎯 Guess the number between **1-50**!\n\n` +
      `⏰ **60 seconds** to guess\n` +
      `💣 **Prize:** 1 bomb for the winner!\n` +
      `⚠️ **5 guesses per user**\n\n` +
      `Reply to this message with your number guess!`
    );
    
    const gameData = {
      type: 'number_guess',
      targetNumber: targetNumber,
      messageId: message.message_id,
      startTime: new Date(),
      userGuesses: new Map(), // Track how many guesses each user has made (userId -> count)
      guessedNumbers: new Set(), // Track which numbers have been guessed
      timer: null
    };
    
    activeGames.set(chatId.toString(), gameData);
    
    // Auto-end after 60 seconds
    gameData.timer = setTimeout(async () => {
      const currentGame = activeGames.get(chatId.toString());
      if (currentGame && currentGame.type === 'number_guess' && currentGame.messageId === message.message_id) {
        await endNumberGuessGame(chatId, currentGame, false);
      }
    }, timeLimit * 1000);
    
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
      const user = await roleService.getUserByMessengerId(userId.toString());
      if (user) {
        // Clear timer
        if (game.timer) {
          clearTimeout(game.timer);
        }
        
        // Award bomb
        await bombService.awardBomb(user.id, 1, user.id, 'Won number guessing game');
        const bombCount = await bombService.getBombCount(user.id);
        
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
      }
      
      return { success: false, message: "❌ Error: User not found" };
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

