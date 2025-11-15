#!/bin/bash
# Simple script to check bot logs

echo "=== Bot Status ==="
if pgrep -f "node src/server.js" > /dev/null; then
    echo "✅ Bot is running (PID: $(pgrep -f 'node src/server.js'))"
else
    echo "❌ Bot is NOT running"
fi

echo ""
echo "=== Recent Logs (last 30 lines) ==="
if [ -f "bot.log" ]; then
    tail -30 bot.log
else
    echo "No log file found. Bot may not have started yet."
fi

echo ""
echo "=== To watch logs in real-time, run: ==="
echo "tail -f bot.log"



