const ruleService = require('../services/ruleService');
const roleService = require('../services/roleService');
const activityService = require('../services/activityService');

/**
 * List all active rules
 */
async function list(context) {
  try {
    const rules = await ruleService.getActiveRules();
    
    if (rules.length === 0) {
      return "📜 No active rules.";
    }
    
    // Group by category
    const byCategory = {};
    rules.forEach(rule => {
      const cat = rule.category || 'General';
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push(rule);
    });
    
    let message = "📜 Active Rules:\n\n";
    
    for (const [category, categoryRules] of Object.entries(byCategory)) {
      message += `**${category}:**\n`;
      categoryRules.forEach((rule, idx) => {
        message += `${idx + 1}. ${rule.ruleText}\n`;
      });
      message += "\n";
    }
    
    return message.trim();
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  list
};

