const adminCommands = require('../commands/admin');
const ticketCommands = require('../commands/tickets');
const ruleCommands = require('../commands/rules');
const prisonCommands = require('../commands/prison');
const infoCommands = require('../commands/info');
const recapCommands = require('../commands/recap');
const nicknameCommands = require('../commands/nickname');
const bombCommands = require('../commands/bombs');
const assassinationCommands = require('../commands/assassination');
const triviaCommands = require('../commands/trivia');

/**
 * Route parsed message to appropriate command handler
 */
async function routeCommand(parsed, context) {
  const { type, command, intent, args, originalText } = parsed;
  const { senderId, groupId, user } = context;

  try {
    // Handle prefix commands
    if (type === 'command') {
      return await handlePrefixCommand(command, args, context);
    }
    
    // Handle natural language intents
    if (type === 'intent') {
      return await handleIntent(intent, originalText, context);
    }
    
    // Unknown command - only show error for actual commands (starting with /)
    if (originalText && originalText.startsWith('/')) {
      return `Unknown command: ${originalText.split(' ')[0]}. Type /help for a list of commands.`;
    }
    // For natural language that wasn't understood, only respond if it was a direct question/command-like
    // Don't respond to random chat messages
    return null;
  } catch (error) {
    console.error('Error routing command:', error);
    return `Error: ${error.message}`;
  }
}

/**
 * Handle prefix commands
 */
async function handlePrefixCommand(command, args, context) {
  const { senderId, groupId, user } = context;

  switch (command) {
    // Admin commands
    case 'setking':
    case 'setqueen':
    case 'setenforcer':
    case 'setguard':
    case 'setpeasant':
      return await adminCommands.setRole(command, args, context);
    
    case 'award':
      return await ticketCommands.award(args, context);
    
    case 'awardbomb':
      return await bombCommands.awardBomb(args, context);
    
    case 'bomb':
    case 'usebomb':
      return await bombCommands.useBomb(args, context);
    
    case 'addrule':
      return await ruleCommands.add(args, context);
    
    case 'removerule':
      return await ruleCommands.remove(args, context);
    
    case 'editrule':
      return await ruleCommands.edit(args, context);
    
    case 'addaction':
      return await adminCommands.addAction(args, context);
    
    case 'ban':
      return await prisonCommands.ban(args, context);
    
    case 'jail':
    case 'sendtojail':
      return await prisonCommands.jail(args, context);
    
    case 'pardon':
      return await prisonCommands.pardon(args, context);
    
    case 'setjailchat':
      return await prisonCommands.setJailChat(context);
    
    case 'removejailchat':
    case 'unsetjailchat':
      return await prisonCommands.removeJailChat(context);
    
    case 'remove':
      return await prisonCommands.remove(args, context);
    
    // Ticket commands
    case 'balance':
    case 'tickets':
      return await ticketCommands.balance(context);
    
    case 'history':
      return await ticketCommands.history(args, context);
    
    case 'redeem':
      return await ticketCommands.redeem(args, context);
    
    case 'spend':
    case 'use':
      return await ticketCommands.spend(args, context);
    
    case 'give':
    case 'gift':
      return await ticketCommands.give(args, context);
    
    case 'pay':
      return await ticketCommands.pay(args, context);
    
    // Assassination commands
    case 'assassinate':
    case 'hit':
      return await assassinationCommands.assassinate(args, context);
    
    case 'block':
      return await assassinationCommands.block(context);
    
    // Trivia commands (King/Queen only)
    case 'trivia':
      return await triviaCommands.trivia(args, context);
    
    case 'stoptrivia':
    case 'stoptrivia':
      return await triviaCommands.stopTrivia(context);
    
    // Rule commands
    case 'rules':
      return await ruleCommands.list(context);
    
    // Action commands
    case 'actions':
      return await infoCommands.actions(context);
    
    // Info commands
    case 'status':
      return await infoCommands.status(context);
    
    case 'leaderboard':
      return await infoCommands.leaderboard(context);
    
    case 'help':
      return await infoCommands.help();
    
    case 'myrole':
      return await infoCommands.myRole(context);
    
    case 'roles':
      return await infoCommands.roles(context);
    
    case 'daysasking':
    case 'reign':
      return await infoCommands.daysAsKing(context);
    
    // Recap commands
    case 'recap':
      return await recapCommands.recap(args, context);
    
    case 'catchup':
    case 'summary':
      return await recapCommands.personalRecap(context);
    
    // Nickname commands
    case 'nickname':
    case 'nick':
      if (args.length === 0) {
        return await nicknameCommands.showNickname(context);
      }
      return await nicknameCommands.setNickname(args, context);
    
    default:
      return `Unknown command: /${command}. Type /help for a list of commands.`;
  }
}

/**
 * Handle natural language intents
 */
async function handleIntent(intent, originalText, context) {
  switch (intent) {
    case 'award':
      return await ticketCommands.awardFromNaturalLanguage(originalText, context);
    
    case 'balance':
      return await ticketCommands.balance(context);
    
    case 'rules':
      return await ruleCommands.list(context);
    
    case 'actions':
      return await infoCommands.actions(context);
    
    case 'status':
      return await infoCommands.status(context);
    
    case 'leaderboard':
      return await infoCommands.leaderboard(context);
    
    case 'help':
      return await infoCommands.help();
    
    default:
      return "I didn't understand that. Type /help for a list of commands.";
  }
}

module.exports = {
  routeCommand
};

