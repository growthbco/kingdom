/**
 * Script to update/add new rules to the database
 * This adds new rules without removing existing ones
 */

const sequelize = require('./connection');
const Rule = require('../models/Rule');
const defaultRules = require('../config/defaultRules');

async function updateRules() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection established.');

    console.log('Loading new rules...');
    
    // Get existing rules to avoid duplicates
    const existingRules = await Rule.findAll({
      where: { isActive: true }
    });
    
    const existingRuleTexts = new Set(existingRules.map(r => r.ruleText.toLowerCase().trim()));
    
    // Add new rules that don't already exist
    let added = 0;
    let skipped = 0;
    
    for (const ruleData of defaultRules) {
      const normalizedText = ruleData.ruleText.toLowerCase().trim();
      
      if (!existingRuleTexts.has(normalizedText)) {
        await Rule.create({
          ruleText: ruleData.ruleText,
          category: ruleData.category,
          isActive: true
        });
        added++;
        console.log(`✅ Added: ${ruleData.ruleText}`);
      } else {
        skipped++;
        console.log(`⏭️  Skipped (already exists): ${ruleData.ruleText}`);
      }
    }
    
    console.log(`\n📋 Summary:`);
    console.log(`   Added: ${added} new rules`);
    console.log(`   Skipped: ${skipped} existing rules`);
    console.log(`   Total active rules: ${existingRules.length + added}`);
    
    await sequelize.close();
    console.log('\n✅ Rules update complete!');
  } catch (error) {
    console.error('❌ Error updating rules:', error);
    process.exit(1);
  }
}

updateRules();


