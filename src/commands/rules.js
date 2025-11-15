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

/**
 * Add a new rule
 */
async function add(args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can add rules.";
  }
  
  if (args.length === 0) {
    return "❌ Usage: /addrule <rule text>";
  }
  
  const ruleText = args.join(' ');
  const category = 'General'; // Could be extracted from args if needed
  
  try {
    const rule = await ruleService.addRule(ruleText, category, user.id);
    
    // Log activity
    await activityService.logActivity('rule_added', {
      userId: user.id,
      details: { ruleText: rule.ruleText, ruleId: rule.id },
      chatId: message.chat.id.toString()
    });
    
    return `✅ Rule added!\n[${rule.id}] ${rule.ruleText}`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Remove a rule
 */
async function remove(args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can remove rules.";
  }
  
  if (args.length === 0) {
    return "❌ Usage: /removerule <rule id>";
  }
  
  const ruleId = parseInt(args[0]);
  if (isNaN(ruleId)) {
    return "❌ Rule ID must be a number.";
  }
  
  try {
    const rule = await ruleService.removeRule(ruleId);
    
    // Log activity
    await activityService.logActivity('rule_removed', {
      userId: user.id,
      details: { ruleText: rule.ruleText, ruleId: rule.id },
      chatId: message.chat.id.toString()
    });
    
    return `✅ Rule removed:\n[${rule.id}] ${rule.ruleText}`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Edit a rule
 */
async function edit(args, context) {
  const { senderId, user, message } = context;
  
  // Check permissions
  const canAdmin = await roleService.canPerformAdminAction(user.id);
  if (!canAdmin) {
    return "❌ Only Enforcer and King/Queen can edit rules.";
  }
  
  if (args.length < 2) {
    return "❌ Usage: /editrule <rule id> <new text>";
  }
  
  const ruleId = parseInt(args[0]);
  if (isNaN(ruleId)) {
    return "❌ Rule ID must be a number.";
  }
  
  const newText = args.slice(1).join(' ');
  
  try {
    const rule = await ruleService.editRule(ruleId, newText);
    
    // Log activity
    await activityService.logActivity('rule_edited', {
      userId: user.id,
      details: { ruleText: rule.ruleText, ruleId: rule.id },
      chatId: message.chat.id.toString()
    });
    
    return `✅ Rule updated!\n[${rule.id}] ${rule.ruleText}`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  list,
  add,
  remove,
  edit
};

