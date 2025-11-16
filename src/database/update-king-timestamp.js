const User = require('../models/User');
const sequelize = require('./connection');

/**
 * Update the becameKingAt timestamp for the current king/queen
 * Usage: node src/database/update-king-timestamp.js
 */
async function updateKingTimestamp() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Find current king or queen
    const monarch = await User.findOne({
      where: {
        role: {
          [require('sequelize').Op.in]: ['king', 'queen']
        }
      }
    });

    if (!monarch) {
      console.log('❌ No current King or Queen found.');
      process.exit(0);
    }

    // Set to Thursday, November 13, 2025 at 3:00 PM EST
    // EST is UTC-5, so 3PM EST = 8PM UTC (20:00 UTC)
    const becameKingDate = new Date('2025-11-13T20:00:00.000Z');
    
    console.log(`\n👑 Found ${monarch.role === 'king' ? 'King' : 'Queen'}: ${monarch.name}`);
    console.log(`📅 Current becameKingAt: ${monarch.becameKingAt || 'null'}`);
    console.log(`📅 Setting becameKingAt to: ${becameKingDate.toISOString()}`);
    console.log(`   (${becameKingDate.toLocaleString('en-US', {timeZone: 'America/New_York', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'})})`);

    monarch.becameKingAt = becameKingDate;
    await monarch.save();

    console.log(`\n✅ Successfully updated ${monarch.name}'s becameKingAt timestamp!`);
    
    // Calculate and show time in reign
    const now = new Date();
    const diffMs = now - becameKingDate;
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);
    
    const days = totalDays;
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    
    const timeInReign = parts.length > 0 ? parts.join(', ') : 'Less than a minute';
    console.log(`\n⏰ Time in reign: ${timeInReign}`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating king timestamp:', error);
    await sequelize.close();
    process.exit(1);
  }
}

updateKingTimestamp();

