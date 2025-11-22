const sequelize = require('./connection');
const User = require('../models/User');
const MarketItem = require('../models/MarketItem');
const TicketTransaction = require('../models/TicketTransaction');
const { Sequelize, Op } = require('sequelize');

async function combineNicos() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Find both Nico users
    const nicoHIMos = await User.findOne({ where: { name: 'NicoHIMos' } });
    const nico = await User.findOne({ where: { name: 'Nico' } });
    
    if (!nicoHIMos || !nico) {
      console.error('❌ Could not find both Nico users');
      process.exit(1);
    }
    
    console.log(`\n📊 Current Status:`);
    console.log(`NicoHIMos (ID ${nicoHIMos.id}):`);
    console.log(`  Tickets: ${await getTicketBalance(nicoHIMos.id)}`);
    console.log(`  Bombs: ${nicoHIMos.bombs}`);
    console.log(`  Shields: ${nicoHIMos.shields}`);
    console.log(`  Kill Shields: ${nicoHIMos.killShields}`);
    
    console.log(`\nNico (ID ${nico.id}):`);
    console.log(`  Tickets: ${await getTicketBalance(nico.id)}`);
    console.log(`  Bombs: ${nico.bombs}`);
    console.log(`  Shields: ${nico.shields}`);
    console.log(`  Kill Shields: ${nico.killShields}`);
    
    // Transfer tickets from NicoHIMos to Nico
    const nicoHIMosTickets = await getTicketBalance(nicoHIMos.id);
    if (nicoHIMosTickets > 0) {
      await TicketTransaction.create({
        userId: nico.id,
        amount: nicoHIMosTickets,
        type: 'award',
        awardedBy: nico.id,
        reason: `Combined accounts: transferred from NicoHIMos`
      });
      console.log(`\n✅ Transferred ${nicoHIMosTickets} tickets from NicoHIMos to Nico`);
    }
    
    // Transfer bombs, shields, kill shields
    nico.bombs += nicoHIMos.bombs;
    nico.shields += nicoHIMos.shields;
    nico.killShields += nicoHIMos.killShields;
    await nico.save();
    console.log(`✅ Combined inventory: Bombs=${nico.bombs}, Shields=${nico.shields}, Kill Shields=${nico.killShields}`);
    
    // Transfer market items
    const nicoHIMosItems = await MarketItem.findAll({ where: { userId: nicoHIMos.id } });
    for (const item of nicoHIMosItems) {
      const existingItem = await MarketItem.findOne({
        where: { userId: nico.id, emoji: item.emoji }
      });
      
      if (existingItem) {
        existingItem.quantity += item.quantity;
        await existingItem.save();
        console.log(`✅ Combined ${item.emoji} ${item.itemName}: ${existingItem.quantity} total`);
      } else {
        await MarketItem.create({
          userId: nico.id,
          emoji: item.emoji,
          itemName: item.itemName,
          quantity: item.quantity
        });
        console.log(`✅ Transferred ${item.emoji} ${item.itemName} x${item.quantity}`);
      }
      
      await item.destroy();
    }
    
    // Delete NicoHIMos account (or mark as inactive)
    // We'll keep the user record but update the leaderboard to exclude it
    console.log(`\n✅ Combined all items from NicoHIMos into Nico`);
    console.log(`\n📊 Final Status:`);
    console.log(`Nico (ID ${nico.id}):`);
    console.log(`  Tickets: ${await getTicketBalance(nico.id)}`);
    console.log(`  Bombs: ${nico.bombs}`);
    console.log(`  Shields: ${nico.shields}`);
    console.log(`  Kill Shields: ${nico.killShields}`);
    const finalItems = await MarketItem.findAll({ where: { userId: nico.id } });
    console.log(`  Market Items: ${finalItems.map(i => `${i.emoji} x${i.quantity}`).join(', ') || 'None'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

async function getTicketBalance(userId) {
  const transactions = await TicketTransaction.findAll({ where: { userId } });
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

combineNicos();


