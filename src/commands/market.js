const marketService = require('../services/marketService');
const ticketService = require('../services/ticketService');
const roleService = require('../services/roleService');
const { sendMessage } = require('../bot/telegramBot');
const { bot } = require('../bot/telegramBot');
const activityService = require('../services/activityService');

/**
 * Show market with interactive buttons
 */
async function showMarket(context) {
  const { chatId, user } = context;
  
  try {
    const items = marketService.getMarketItems();
    const balance = await ticketService.getBalance(user.id);
    
    let message = `🛒 <b>THE KINGDOM MARKET</b> 🛒\n\n`;
    message += `Your balance: <b>${balance} 🎫</b>\n\n`;
    message += `<b>Available Items:</b>\n\n`;
    
    // Create inline keyboard buttons
    const keyboard = [];
    const itemsArray = Object.entries(items);
    
    // Create buttons in rows of 2
    for (let i = 0; i < itemsArray.length; i += 2) {
      const row = [];
      const [emoji1, item1] = itemsArray[i];
      row.push({
        text: `${emoji1} ${item1.name} - ${item1.cost}🎫`,
        callback_data: `market_buy_${emoji1}`
      });
      
      if (i + 1 < itemsArray.length) {
        const [emoji2, item2] = itemsArray[i + 1];
        row.push({
          text: `${emoji2} ${item2.name} - ${item2.cost}🎫`,
          callback_data: `market_buy_${emoji2}`
        });
      }
      keyboard.push(row);
    }
    
    // Add inventory and close buttons
    keyboard.push([
      { text: '📦 My Inventory', callback_data: 'market_inventory' },
      { text: '❌ Close', callback_data: 'market_close' }
    ]);
    
    // Add description for each item
    message += itemsArray.map(([emoji, item]) => 
      `${emoji} <b>${item.name}</b> - ${item.cost} 🎫\n   ${item.description}\n`
    ).join('\n');
    
    return {
      text: message,
      options: {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    };
  } catch (error) {
    console.error('Error showing market:', error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Show user's inventory
 */
async function showInventory(context) {
  const { chatId, user } = context;
  
  try {
    const summary = await marketService.getInventorySummary(user.id);
    
    let message = `📦 <b>Your Inventory</b> 📦\n\n`;
    
    if (summary.items.length === 0 && summary.bombs === 0 && 
        summary.shields === 0 && summary.killShields === 0) {
      message += `Your inventory is empty!\n\n`;
      message += `Visit /market to buy items!`;
    } else {
      // Show market items
      if (summary.items.length > 0) {
        message += `<b>Market Items:</b>\n`;
        summary.items.forEach(item => {
          message += `${item.emoji} ${item.name} x${item.quantity}\n`;
        });
        message += `\n`;
      }
      
      // Show inventory items
      message += `<b>Inventory:</b>\n`;
      if (summary.bombs > 0) {
        message += `💣 Bombs: ${summary.bombs}\n`;
      }
      if (summary.shields > 0) {
        message += `🛡️ Shields: ${summary.shields}\n`;
      }
      if (summary.killShields > 0) {
        message += `⚔️ Kill Shields: ${summary.killShields}\n`;
      }
    }
    
    const keyboard = [
      [
        { text: '🛒 Back to Market', callback_data: 'market_show' },
        { text: '❌ Close', callback_data: 'market_close' }
      ]
    ];
    
    return {
      text: message,
      options: {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    };
  } catch (error) {
    console.error('Error showing inventory:', error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Handle callback queries from market buttons
 */
async function handleCallbackQuery(query, context) {
  const { data, message, from } = query;
  const chatId = message.chat.id;
  const userId = from.id.toString();
  
  try {
    // Get user
    const user = await roleService.getUserByMessengerId(userId);
    if (!user) {
      await bot.answerCallbackQuery(query.id, {
        text: 'User not found. Please send a message first.',
        show_alert: true
      });
      return;
    }
    
    const userContext = {
      ...context,
      user,
      chatId: chatId.toString()
    };
    
    if (data === 'market_show') {
      const result = await showMarket(userContext);
      await bot.editMessageText(result.text, {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: result.options.parse_mode,
        reply_markup: result.options.reply_markup
      });
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'market_inventory') {
      const result = await showInventory(userContext);
      await bot.editMessageText(result.text, {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: result.options.parse_mode,
        reply_markup: result.options.reply_markup
      });
      await bot.answerCallbackQuery(query.id);
    } else if (data === 'market_close') {
      await bot.deleteMessage(chatId, message.message_id);
      await bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('market_buy_')) {
      const emoji = data.replace('market_buy_', '');
      
      try {
        await marketService.purchaseItem(user.id, emoji);
        const balance = await ticketService.getBalance(user.id);
        const items = marketService.getMarketItems();
        const item = items[emoji];
        
        await bot.answerCallbackQuery(query.id, {
          text: `✅ Purchased ${item.name} ${emoji}!`,
          show_alert: false
        });
        
        // Refresh market display
        const result = await showMarket(userContext);
        await bot.editMessageText(result.text, {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: result.options.parse_mode,
          reply_markup: result.options.reply_markup
        });
      } catch (error) {
        await bot.answerCallbackQuery(query.id, {
          text: `❌ ${error.message}`,
          show_alert: true
        });
      }
    } else if (data.startsWith('market_usediscoball_')) {
      // This will be handled separately when user selects target
      await bot.answerCallbackQuery(query.id, {
        text: 'Please mention the user you want to swap with: /usediscoball @user',
        show_alert: true
      });
    }
  } catch (error) {
    console.error('Error handling callback query:', error);
    try {
      await bot.answerCallbackQuery(query.id, {
        text: `❌ Error: ${error.message}`,
        show_alert: true
      });
    } catch (e) {
      // Ignore errors answering callback
    }
  }
}

/**
 * Use disco ball command
 */
async function useDiscoBall(args, context) {
  const { senderId, user, message, chatId } = context;
  
  try {
    if (args.length === 0 && !message.reply_to_message) {
      return "❌ Usage: /usediscoball @user or reply to a message with /usediscoball";
    }
    
    let targetUserId = null;
    let targetUsername = null;
    
    if (message.reply_to_message && message.reply_to_message.from) {
      targetUserId = message.reply_to_message.from.id.toString();
      targetUsername = message.reply_to_message.from.username || 
                       message.reply_to_message.from.first_name ||
                       `User_${targetUserId}`;
    } else {
      const mention = args[0];
      const username = mention.startsWith('@') ? mention.substring(1) : mention;
      const targetUser = await roleService.getUserByName(username);
      if (!targetUser) {
        return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
      }
      targetUserId = targetUser.messengerId;
      targetUsername = targetUser.name;
    }
    
    const targetUser = await roleService.getUserByMessengerId(targetUserId);
    if (!targetUser) {
      return `❌ Target user not found.`;
    }
    
    if (targetUser.id === user.id) {
      return "❌ You can't swap inventory with yourself!";
    }
    
    const result = await marketService.useDiscoBall(user.id, targetUser.id);
    
    const userMention = `<a href="tg://user?id=${user.messengerId}">${user.name}</a>`;
    const targetMention = `<a href="tg://user?id=${targetUser.messengerId}">${targetUser.name}</a>`;
    
    const announcement = `🪩 <b>DISCO BALL ACTIVATED!</b> 🪩\n\n` +
      `${userMention} has swapped all inventory items with ${targetMention}!\n\n` +
      `<b>${user.name}'s new inventory:</b>\n` +
      `🎫 Tickets: ${result.userTickets}\n` +
      `💣 Bombs: ${result.userBombs}\n` +
      `🛡️ Shields: ${result.userShields}\n` +
      `⚔️ Kill Shields: ${result.userKillShields}\n\n` +
      `<b>${targetUser.name}'s new inventory:</b>\n` +
      `🎫 Tickets: ${result.targetTickets}\n` +
      `💣 Bombs: ${result.targetBombs}\n` +
      `🛡️ Shields: ${result.targetShields}\n` +
      `⚔️ Kill Shields: ${result.targetKillShields}`;
    
    await sendMessage(chatId, announcement, { parse_mode: 'HTML' });
    
    return `✅ Successfully swapped inventory with ${targetUser.name}!`;
  } catch (error) {
    console.error('Error using disco ball:', error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Use dynamite command
 */
async function useDynamite(args, context) {
  const { senderId, user, message, chatId } = context;
  
  try {
    if (args.length === 0 && !message.reply_to_message) {
      return "❌ Usage: /usedynamite @user <reason> or reply to a message with /usedynamite <reason>";
    }
    
    let targetUserId = null;
    let targetUsername = null;
    
    if (message.reply_to_message && message.reply_to_message.from) {
      targetUserId = message.reply_to_message.from.id.toString();
      targetUsername = message.reply_to_message.from.username || 
                       message.reply_to_message.from.first_name ||
                       `User_${targetUserId}`;
    } else {
      const mention = args[0];
      const username = mention.startsWith('@') ? mention.substring(1) : mention;
      const targetUser = await roleService.getUserByName(username);
      if (!targetUser) {
        return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
      }
      targetUserId = targetUser.messengerId;
      targetUsername = targetUser.name;
    }
    
    const targetUser = await roleService.getUserByMessengerId(targetUserId);
    if (!targetUser) {
      return `❌ Target user not found.`;
    }
    
    const reason = args.length > 1 ? args.slice(1).join(' ') : (args.length === 1 && !message.reply_to_message ? args[0] : 'No reason provided');
    
    const result = await marketService.useDynamite(user.id, targetUser.id, reason, chatId);
    
    // Log activity
    await activityService.logActivity('dynamite_used', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { 
        ticketsEliminated: result.ticketsEliminated || 0,
        reason 
      },
      chatId: chatId
    });
    
    const userMention = `<a href="tg://user?id=${user.messengerId}">${user.name}</a>`;
    const targetMention = `<a href="tg://user?id=${targetUser.messengerId}">${targetUser.name}</a>`;
    
    const announcement = `🧨 <b>DYNAMITE DETONATED!</b> 🧨\n\n` +
      `${userMention} used dynamite on ${targetMention}!\n` +
      `💥 Eliminated <b>ALL ${result.ticketsEliminated} 🎫</b>\n` +
      `${targetUser.name}'s new balance: <b>0 🎫</b>\n` +
      `${user.name}'s remaining dynamite: ${result.remainingDynamite} 🧨\n\n` +
      `🛡️ ${targetUser.name} can use /blockmarketattack within 2 minutes to block this attack!`;
    
    await sendMessage(chatId, announcement, { parse_mode: 'HTML' });
    
    return `✅ Dynamite used successfully!`;
  } catch (error) {
    console.error('Error using dynamite:', error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Use market bomb command
 */
async function useMarketBomb(args, context) {
  const { senderId, user, message, chatId } = context;
  
  try {
    if (args.length === 0 && !message.reply_to_message) {
      return "❌ Usage: /usemarketbomb @user <reason> or reply to a message with /usemarketbomb <reason>";
    }
    
    let targetUserId = null;
    let targetUsername = null;
    
    if (message.reply_to_message && message.reply_to_message.from) {
      targetUserId = message.reply_to_message.from.id.toString();
      targetUsername = message.reply_to_message.from.username || 
                       message.reply_to_message.from.first_name ||
                       `User_${targetUserId}`;
    } else {
      const mention = args[0];
      const username = mention.startsWith('@') ? mention.substring(1) : mention;
      const targetUser = await roleService.getUserByName(username);
      if (!targetUser) {
        return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found. They need to send a message in the chat first.`;
      }
      targetUserId = targetUser.messengerId;
      targetUsername = targetUser.name;
    }
    
    const targetUser = await roleService.getUserByMessengerId(targetUserId);
    if (!targetUser) {
      return `❌ Target user not found.`;
    }
    
    const reason = args.length > 1 ? args.slice(1).join(' ') : (args.length === 1 && !message.reply_to_message ? args[0] : 'No reason provided');
    
    const result = await marketService.useMarketBomb(user.id, targetUser.id, reason, chatId);
    
    // Log activity
    await activityService.logActivity('market_bomb_used', {
      userId: user.id,
      targetUserId: targetUser.id,
      details: { 
        ticketsEliminated: result.ticketsEliminated || 0,
        reason 
      },
      chatId: chatId
    });
    
    const userMention = `<a href="tg://user?id=${user.messengerId}">${user.name}</a>`;
    const targetMention = `<a href="tg://user?id=${targetUser.messengerId}">${targetUser.name}</a>`;
    
    const announcement = `💣 <b>MARKET BOMB DROPPED!</b> 💣\n\n` +
      `${userMention} used a market bomb on ${targetMention}!\n` +
      `💥 Eliminated <b>${result.ticketsEliminated} 🎫</b>\n` +
      `${targetUser.name}'s new balance: <b>${result.targetBalance} 🎫</b>\n` +
      `${user.name}'s remaining market bombs: ${result.remainingBombs} 💣\n\n` +
      `🛡️ ${targetUser.name} can use /blockmarketattack within 2 minutes to block this attack!`;
    
    await sendMessage(chatId, announcement, { parse_mode: 'HTML' });
    
    return `✅ Market bomb used successfully!`;
  } catch (error) {
    console.error('Error using market bomb:', error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Block market attack command
 */
async function blockMarketAttack(args, context) {
  const { senderId, user, message, chatId } = context;
  
  try {
    let targetUserId = null;
    
    if (message.reply_to_message && message.reply_to_message.from) {
      targetUserId = message.reply_to_message.from.id.toString();
    } else if (args.length > 0) {
      const mention = args[0];
      const username = mention.startsWith('@') ? mention.substring(1) : mention;
      const targetUser = await roleService.getUserByName(username);
      if (!targetUser) {
        return `❌ User ${mention.startsWith('@') ? '@' : ''}${username} not found.`;
      }
      targetUserId = targetUser.messengerId;
    } else {
      // Default to blocking attack on yourself
      targetUserId = user.messengerId;
    }
    
    const targetUser = await roleService.getUserByMessengerId(targetUserId);
    if (!targetUser) {
      return `❌ Target user not found.`;
    }
    
    const result = await marketService.blockMarketAttack(user.id, targetUser.id);
    
    const userMention = `<a href="tg://user?id=${user.messengerId}">${user.name}</a>`;
    const targetMention = `<a href="tg://user?id=${targetUser.messengerId}">${targetUser.name}</a>`;
    
    const announcement = `🛡️ <b>MARKET SHIELD ACTIVATED!</b> 🛡️\n\n` +
      `${userMention} blocked a ${result.attackType} attack on ${targetMention}!\n` +
      `✅ Restored <b>${result.ticketsRestored} 🎫</b>\n` +
      `${user.name}'s remaining market shields: ${result.remainingShields} 🛡️`;
    
    await sendMessage(chatId, announcement, { parse_mode: 'HTML' });
    
    return `✅ Successfully blocked the attack!`;
  } catch (error) {
    console.error('Error blocking market attack:', error);
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  showMarket,
  showInventory,
  handleCallbackQuery,
  useDiscoBall,
  useDynamite,
  useMarketBomb,
  blockMarketAttack
};

