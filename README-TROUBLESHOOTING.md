# Troubleshooting Guide

## How to Check Logs

### Quick Check
```bash
./check-logs.sh
```

### View Recent Logs
```bash
tail -30 bot.log
```

### Watch Logs in Real-Time
```bash
tail -f bot.log
```
Then send a command in Telegram and watch what happens.

### Check if Bot is Running
```bash
ps aux | grep "node src/server.js" | grep -v grep
```

## Common Issues

### Bot Not Responding to Commands

1. **Check if bot is running:**
   ```bash
   ./check-logs.sh
   ```

2. **Make sure bot is admin in your Telegram group:**
   - Open group settings
   - Go to Administrators
   - Add bot as admin
   - Give it permission to read messages

3. **Check logs when you send a command:**
   - Run `tail -f bot.log` in terminal
   - Send `/help` in Telegram
   - You should see logs like:
     ```
     [timestamp] Message from YourName (12345) in chat -123456789: /help
     [timestamp] Sending response to chat -123456789
     ```

4. **Restart bot if needed:**
   ```bash
   pkill -f "node src/server.js"
   npm start > bot.log 2>&1 &
   ```

### "409 Conflict" Error

This means multiple bot instances are running. Fix it:

```bash
# Kill all instances
pkill -9 -f "node.*server.js"

# Wait a few seconds
sleep 3

# Start fresh
npm start > bot.log 2>&1 &
```

### Bot Crashes on Startup

1. Check `.env` file has correct token
2. Check database permissions
3. Check logs: `tail -50 bot.log`

## Testing Commands

Try these in order:

1. `/help` - Simplest command, should always work
2. `/status` - Shows game status
3. `/myrole` - Shows your role

If `/help` doesn't work, the bot isn't receiving messages (check admin permissions).

## Getting Help

When reporting issues, include:
- Output of `./check-logs.sh`
- Last 20 lines of logs: `tail -20 bot.log`
- What command you tried
- Whether bot is admin in the group







