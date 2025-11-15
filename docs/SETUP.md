# Telegram Bot Setup Guide

This guide will walk you through setting up your Telegram bot for The Kingdom game.

## Prerequisites

- A Telegram account
- Node.js installed (v14 or higher)
- Basic command line knowledge

## Step 1: Create Your Bot with BotFather

1. Open Telegram and search for **@BotFather**
2. Start a conversation with BotFather
3. Send the command: `/newbot`
4. BotFather will ask for a name for your bot (e.g., "The Kingdom Bot")
5. BotFather will ask for a username (must end in `bot`, e.g., "kingdom_game_bot")
6. BotFather will give you a **Bot Token** - it looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
7. **Copy and save this token** - you'll need it for your `.env` file

## Step 2: Configure Your Bot

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your bot token:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   DATABASE_URL=sqlite:./database/kingdom.db
   PORT=3000
   NODE_ENV=development
   ```

3. Replace `your_bot_token_here` with the token from BotFather

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Initialize Database

Run the migration script to create the database and load default rules/actions:

```bash
npm run migrate
```

You should see:
```
Database connection established.
Database schema synchronized.
Loaded 7 default rules.
Loaded 6 default actions.
Migration completed successfully!
```

## Step 5: Start the Bot

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

You should see:
```
Database connection established.
Telegram bot is running and polling for messages...
Bot username: @your_bot_username
```

## Step 6: Add Bot to Your Group

1. Open Telegram and create a new group (or use an existing one)
2. Click on the group name to open group settings
3. Click "Add Members"
4. Search for your bot by username (e.g., `@kingdom_game_bot`)
5. Add the bot to the group
6. **Important**: Make the bot an admin so it can read all messages
   - Go to group settings → Administrators
   - Add your bot as an admin
   - Give it permission to "Delete Messages" (optional but recommended)

## Step 7: Test the Bot

Send a message in your group:
- `/help` - Should show command list
- `/status` - Should show game status
- `/rules` - Should show default rules

## Command Usage Tips

### Reply to Messages
Many commands work better when you reply to a user's message:
- Reply to someone and type `/award 5 Great job!` to award tickets
- Reply to someone and type `/setking` to make them king
- Reply to someone and type `/ban Breaking rules` to ban them

### Using Mentions
You can also use @username mentions:
- `/award @username 5 Great job!`
- `/setking @username`
- `/ban @username Breaking rules`

## Troubleshooting

### Bot Not Responding

1. **Check if bot is running**: Look at your terminal for errors
2. **Verify bot token**: Make sure `TELEGRAM_BOT_TOKEN` in `.env` is correct
3. **Check bot permissions**: Make sure bot is admin in the group
4. **Check bot is added**: Make sure bot is actually in the group

### Database Errors

- Make sure database directory exists: `mkdir -p database`
- Check file permissions for SQLite database
- Try deleting `database/kingdom.db` and running `npm run migrate` again

### Permission Errors

- Make sure only Enforcer and King/Queen can use admin commands
- Set roles first: `/setenforcer @yourself` then `/setking @someone`

### Bot Token Issues

- Token should look like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
- No spaces before or after the token
- Get a new token from @BotFather if needed: `/token` command

## Advanced Configuration

### Using PostgreSQL (Recommended for Production)

1. Set up a PostgreSQL database (Heroku Postgres, Railway Postgres, etc.)
2. Update `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   ```
3. The bot will automatically use PostgreSQL instead of SQLite

### Running in Production

For production deployment:

1. **Use environment variables** - Never commit `.env` file
2. **Use PostgreSQL** - SQLite is fine for development but PostgreSQL is better for production
3. **Set NODE_ENV**: `NODE_ENV=production`
4. **Consider webhooks**: For high-traffic bots, consider switching from polling to webhooks

### Webhook Setup (Optional, for Production)

If you want to use webhooks instead of polling:

1. Set up HTTPS endpoint (required by Telegram)
2. Update `src/bot/telegramBot.js` to use webhook mode:
   ```javascript
   const bot = new TelegramBot(BOT_TOKEN, { webhook: { port: PORT } });
   bot.setWebHook('https://your-domain.com/webhook');
   ```

### Customizing Default Rules and Actions

Edit these files before running migrations:
- `src/config/defaultRules.js`
- `src/config/defaultActions.js`

Or add/remove them after setup using admin commands.

## Security Notes

1. **Never share your bot token** - Keep `.env` file private
2. **Don't commit `.env`** - It's already in `.gitignore`
3. **Use strong tokens** - Telegram tokens are already secure, but don't share them
4. **Limit admin access** - Only trusted users should be Enforcer/King/Queen

## Next Steps

After setup:

1. Set your first Enforcer: `/setenforcer @yourself` (reply to your own message or mention yourself)
2. Set your first King/Queen: `/setking @someone` (reply to their message)
3. Start awarding tickets: Reply to someone and type `/award 5 Welcome bonus`
4. Customize rules: `/addrule Your custom rule here`
5. Check status: `/status` to see current game state

## Getting Help

- Check bot logs in your terminal for error messages
- Verify all commands with `/help`
- Make sure bot has admin permissions in group
- Test commands in a private chat with the bot first

Enjoy playing The Kingdom! 👑
