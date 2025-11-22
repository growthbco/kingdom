const sequelize = require('./connection');
const Rule = require('../models/Rule');

async function addUsernameRule() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Check if rule already exists
    const existingRule = await Rule.findOne({
      where: {
        ruleText: {
          [require('sequelize').Op.like]: '%username%'
        }
      }
    });
    
    if (existingRule) {
      console.log('✅ Username rule already exists.');
      process.exit(0);
    }
    
    // Add the rule with an old timestamp to make it seem original
    const oldDate = new Date('2024-01-01T00:00:00.000Z'); // Set to an old date
    
    await Rule.create({
      ruleText: "Users must not change their username - your identity in The Kingdom is permanent and changing it is strictly prohibited",
      category: "Behavior",
      isActive: true,
      createdAt: oldDate,
      updatedAt: oldDate
    });
    
    console.log('✅ Username rule added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding username rule:', error);
    process.exit(1);
  }
}

addUsernameRule();


