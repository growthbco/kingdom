# The Kingdom - Telegram Bot

A Telegram group chat bot for managing "The Kingdom" game with role-based administration, ticket/prize tracking, dynamic rules management, and prison chat integration.

## Features

- **Role Management**: King/Queen, Enforcer, Lawyer, Peasant roles with permission-based commands
- **Ticket System**: Award and track tickets with full transaction logging
- **Rules Management**: Dynamic rules that can be added, edited, and removed
- **Redemption Actions**: Spend tickets on special actions (challenge king, skip rules, etc.)
- **Prison Integration**: Ban/pardon system with lawyer defense capabilities
- **Natural Language**: Supports both prefix commands and natural language queries

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your Telegram Bot Token:
```bash
cp .env.example .env
```

3. Get your Telegram Bot Token from @BotFather (see `docs/SETUP.md` for detailed instructions)

4. Run database migrations:
```bash
npm run migrate
```

5. Start the bot:
```bash
npm start
```

Or use the startup script:
```bash
./start-bot.sh
```

For development with auto-reload:
```bash
npm run dev
```

**Check bot status:**
```bash
./check-logs.sh
```

## Command Reference

### Admin Commands (Enforcer & King/Queen only)
- `/setking @user` or reply to message with `/setking` - Set user as King
- `/setqueen @user` or reply to message with `/setqueen` - Set user as Queen
- `/setenforcer @user` or reply to message with `/setenforcer` - Set user as Enforcer
- `/setpeasant @user` or reply to message with `/setpeasant` - Set user as Peasant
- `/award @user <amount> <reason>` or reply with `/award <amount> <reason>` - Award tickets
- `/addrule <rule text>` - Add a new rule
- `/removerule <rule id>` - Remove a rule
- `/editrule <rule id> <new text>` - Edit an existing rule
- `/addaction <name> <cost> <description>` - Create a new redemption action
- `/ban @user <reason>` or reply with `/ban <reason>` - Ban user to prison chat
- `/pardon @user` or reply with `/pardon` - Pardon user from prison

### Ticket Commands
- `/balance` or `/tickets` - View your ticket balance
- `/history` or `/history @user` or reply with `/history` - View ticket transaction history
- `/redeem <action name>` - Redeem tickets for an action

### Rules Commands
- `/rules` - List all active rules

### Redemption Commands
- `/actions` - List all available redemption actions

### Info Commands
- `/status` - Show current game status
- `/leaderboard` - Show top ticket holders
- `/help` - Show command reference
- `/myrole` - Show your current role

### Lawyer Commands
- `/defend @user <argument>` or reply with `/defend <argument>` - Defend a user (Lawyer only)

## Telegram-Specific Features

- **Reply to Messages**: Many commands work when you reply to a user's message (e.g., reply and type `/award 5` to award tickets)
- **Username Mentions**: Use `@username` to mention users in commands
- **Group Chat Support**: Works seamlessly in Telegram groups

## Natural Language Support

The bot also understands natural language queries:
- "Who is the king?"
- "How many tickets do I have?"
- "Give @user 5 tickets for being awesome"
- "What are the rules?"

## Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token from BotFather

Optional:
- `OPENAI_API_KEY` - OpenAI API key for chat summarization in `/recap` and `/catchup` commands. If not provided, recap will only show bot actions, not chat summaries.
- `DATABASE_URL` - Database connection string (defaults to SQLite: `sqlite:./database/kingdom.db`)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (default: development)

## Documentation

- [Telegram Bot Setup Guide](docs/SETUP.md)

## License

MIT

