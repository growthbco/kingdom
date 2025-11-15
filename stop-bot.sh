#!/bin/bash
# Stop script for The Kingdom Bot (using PM2)

cd "$(dirname "$0")"

echo "🛑 Stopping The Kingdom Bot..."

npx pm2 stop kingdom-bot

if [ $? -eq 0 ]; then
    echo "✅ Bot stopped successfully!"
    echo ""
    echo "To start again: ./start-bot.sh"
    echo "To delete from PM2: npx pm2 delete kingdom-bot"
else
    echo "❌ Failed to stop bot. It may not be running."
    exit 1
fi

