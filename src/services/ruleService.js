const Rule = require('../models/Rule');

/**
 * Get all active rules
 */
async function getActiveRules() {
  try {
    return await Rule.findAll({
      where: { isActive: true },
      order: [['category', 'ASC'], ['createdAt', 'ASC']]
    });
  } catch (error) {
    console.error('Error getting active rules:', error);
    throw error;
  }
}

/**
 * Add a new rule
 */
async function addRule(ruleText, category, createdBy) {
  try {
    return await Rule.create({
      ruleText,
      category: category || 'General',
      isActive: true,
      createdBy
    });
  } catch (error) {
    console.error('Error adding rule:', error);
    throw error;
  }
}

/**
 * Remove a rule (deactivate)
 */
async function removeRule(ruleId) {
  try {
    const rule = await Rule.findByPk(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    rule.isActive = false;
    await rule.save();
    return rule;
  } catch (error) {
    console.error('Error removing rule:', error);
    throw error;
  }
}

/**
 * Edit a rule
 */
async function editRule(ruleId, newText) {
  try {
    const rule = await Rule.findByPk(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    rule.ruleText = newText;
    await rule.save();
    return rule;
  } catch (error) {
    console.error('Error editing rule:', error);
    throw error;
  }
}

module.exports = {
  getActiveRules,
  addRule,
  removeRule,
  editRule
};



