# GitHub + Railway Setup Guide

Follow these steps to deploy your bot to Railway (runs 24/7):

## Step 1: Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Repository settings:
   - **Name:** `the-kingdom-bot` (or any name you want)
   - **Description:** "Telegram bot for The Kingdom game"
   - **Visibility:** Private (recommended) or Public
   - **DO NOT** check "Initialize with README" (we already have code)
4. Click **"Create repository"**

## Step 2: Push Code to GitHub

After creating the repo, GitHub will show you commands. Run these in your terminal:

```bash
cd "/Users/garysanchez/Desktop/Cursor Projects/The Kingdom"

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/the-kingdom-bot.git

# Push code
git branch -M main
git push -u origin main
```

**Or if you prefer SSH:**
```bash
git remote add origin git@github.com:YOUR_USERNAME/the-kingdom-bot.git
git branch -M main
git push -u origin main
```

## Step 3: Set Up Railway

1. Go to [railway.app](https://railway.app) and sign up (use GitHub to sign in - it's easier!)
2. Click **"New Project"**
3. Click **"Deploy from GitHub repo"**
4. Select your `the-kingdom-bot` repository
5. Railway will start deploying automatically

## Step 4: Add Environment Variables

1. In Railway, click on your project
2. Click on the service (your bot)
3. Go to **"Variables"** tab
4. Add these environment variables:

```
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
```

If you're using AI features, also add:
```
OPENAI_API_KEY=your-openai-key (optional)
ANTHROPIC_API_KEY=your-claude-key (optional)
```

5. Railway will automatically redeploy when you add variables

## Step 5: Verify It's Running

1. Check Railway dashboard - should show "Deployed" status
2. Go to **"Logs"** tab to see bot output
3. Test in Telegram - send `/help` to your bot

## That's It! 🎉

Your bot is now running 24/7 on Railway. Every time you push code to GitHub, Railway will automatically redeploy.

## Updating Your Bot

When you make changes:

```bash
git add .
git commit -m "Your update message"
git push
```

Railway will automatically redeploy!

## Railway Pricing

- **Free Trial:** $5 credit to start
- **After trial:** ~$5/month for a small bot like this
- **Pay-as-you-go:** Only pay for what you use

## Need Help?

- Railway logs: Check the "Logs" tab in Railway dashboard
- GitHub issues: Check your repo on GitHub
- Local testing: Still works on your laptop with `./start-bot.sh`







