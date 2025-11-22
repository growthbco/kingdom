const User = require('../models/User');
const ticketService = require('../services/ticketService');
const bombService = require('../services/bombService');
const shieldService = require('../services/shieldService');
const marketService = require('../services/marketService');
const roleService = require('../services/roleService');
const userService = require('../services/userService');
const { Sequelize } = require('sequelize');

/**
 * Show Master of the Iron Code status (Gary's tracking)
 */
async function masterStatus(context) {
  try {
    // Find Gary (garysanc)
    const gary = await User.findOne({
      where: Sequelize.where(
        Sequelize.fn('LOWER', Sequelize.col('name')),
        'garysanc'
      )
    });
    
    if (!gary) {
      return "❌ Master of the Iron Code not found in the database.";
    }
    
    // Get all of Gary's stats
    const tickets = await ticketService.getBalance(gary.id);
    const bombs = await bombService.getBombCount(gary.id);
    const shields = await shieldService.getShieldCount(gary.id);
    const killShields = await shieldService.getKillShieldCount(gary.id);
    const inventory = await marketService.getUserInventory(gary.id);
    const displayName = userService.getDisplayName(gary);
    
    let message = `⚔️ **MASTER OF THE IRON CODE** ⚔️\n\n`;
    message += `**${displayName}**\n`;
    message += `Role: ${gary.role.charAt(0).toUpperCase() + gary.role.slice(1)}\n\n`;
    
    message += `**💰 Tickets:** ${tickets} 🎫\n\n`;
    
    message += `**💣 Bombs:** ${bombs}\n`;
    message += `**🛡️ Shields:** ${shields}\n`;
    message += `**⚔️ Kill Shields:** ${killShields}\n\n`;
    
    if (inventory && inventory.length > 0) {
      message += `**🛒 Market Items:**\n`;
      inventory.forEach(item => {
        if (item.quantity > 1) {
          message += `${item.emoji} ${item.itemName} x${item.quantity}\n`;
        } else {
          message += `${item.emoji} ${item.itemName}\n`;
        }
      });
    } else {
      message += `**🛒 Market Items:** None\n`;
    }
    
    return message;
  } catch (error) {
    console.error('Error getting master status:', error);
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  masterStatus
};

