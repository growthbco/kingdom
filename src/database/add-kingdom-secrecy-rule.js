const sequelize = require('./connection');
const Rule = require('../models/Rule');

async function addKingdomSecrecyRule() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Check if rule already exists
    const existingRule = await Rule.findOne({
      where: {
        ruleText: "You cannot mention or talk about The Kingdom outside of The Kingdom",
        isActive: true
      }
    });

    if (existingRule) {
      console.log('✅ Rule already exists in database.');
      process.exit(0);
    }

    // Add the new rule
    const rule = await Rule.create({
      ruleText: "You cannot mention or talk about The Kingdom outside of The Kingdom",
      category: "Behavior",
      isActive: true,
      createdBy: null
    });

    console.log('✅ Successfully added rule:');
    console.log(`   ID: ${rule.id}`);
    console.log(`   Text: ${rule.ruleText}`);
    console.log(`   Category: ${rule.category}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding rule:', error);
    process.exit(1);
  }
}

addKingdomSecrecyRule();

