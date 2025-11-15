#!/bin/bash
# Start script for The Kingdom Bot (using PM2)

cd "$(dirname "$0")"

echo "🚀 Starting The Kingdom Bot with PM2..."

# Stop any existing PM2 instance
npx pm2 stop kingdom-bot 2>/dev/null
npx pm2 delete kingdom-bot 2>/dev/null

# Start the bot with PM2
npx pm2 start ecosystem.config.js

# Wait a moment for it to start
sleep 3

# Check if it's running
if npx pm2 list | grep -q "kingdom-bot.*online"; then
    echo "✅ Bot started successfully!"
    echo "📋 PM2 Status:"
    npx pm2 list | grep kingdom-bot
    echo ""
    echo "📝 View logs: npx pm2 logs kingdom-bot"
    echo "🛑 Stop bot: npx pm2 stop kingdom-bot"
    echo "🔄 Restart bot: npx pm2 restart kingdom-bot"
    echo ""
    echo "Bot is now LIVE and will continue running even when you close your laptop!"
    echo ""
    echo "💡 To save PM2 configuration: npx pm2 save"
    echo "💡 To auto-start on system boot: npx pm2 startup"
else
    echo "❌ Bot failed to start. Check logs:"
    npx pm2 logs kingdom-bot --lines 20
    exit 1
fi



