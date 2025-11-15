# Deployment Guide - Keep Bot Running 24/7

To keep your bot running all the time, you need to deploy it to a cloud server. Here are the best options:

## Option 1: Railway (Easiest - Recommended) 🚂

**Cost:** Free tier available, then ~$5/month  
**Setup Time:** 5 minutes  
**Best for:** Quick deployment, automatic deployments from GitHub

### Steps:
1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select this repository
4. Add environment variables:
   - `TELEGRAM_BOT_TOKEN` (your bot token)
   - `OPENAI_API_KEY` (if using OpenAI)
   - `ANTHROPIC_API_KEY` (if using Claude)
5. Railway will automatically deploy and keep it running 24/7

---

## Option 2: Render (Free Tier Available) 🎨

**Cost:** Free tier (sleeps after 15 min inactivity), $7/month for always-on  
**Setup Time:** 10 minutes  
**Best for:** Free option, simple setup

### Steps:
1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start` (or `pm2 start ecosystem.config.js`)
   - **Environment:** Node
5. Add environment variables (same as Railway)
6. Deploy!

---

## Option 3: DigitalOcean Droplet (Most Control) 💧

**Cost:** $6/month  
**Setup Time:** 20 minutes  
**Best for:** Full control, learning experience

### Steps:
1. Create account at [digitalocean.com](https://digitalocean.com)
2. Create a Droplet:
   - Choose Ubuntu 22.04
   - $6/month plan (1GB RAM is enough)
   - Add your SSH key
3. SSH into your server:
   ```bash
   ssh root@your-server-ip
   ```
4. Install Node.js:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
5. Install Git:
   ```bash
   sudo apt-get install git
   ```
6. Clone your repo (or upload files):
   ```bash
   git clone https://github.com/yourusername/your-repo.git
   cd your-repo
   ```
7. Install dependencies:
   ```bash
   npm install
   ```
8. Create `.env` file:
   ```bash
   nano .env
   # Add your environment variables
   ```
9. Set up PM2 to auto-start:
   ```bash
   npm install -g pm2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   # Follow the instructions it gives you
   ```
10. Your bot is now running 24/7!

---

## Option 4: Heroku (Simple but Limited) 🟣

**Cost:** Free tier discontinued, paid plans start at $5/month  
**Setup Time:** 10 minutes

### Steps:
1. Install Heroku CLI: `brew install heroku/brew/heroku`
2. Login: `heroku login`
3. Create app: `heroku create your-bot-name`
4. Set environment variables:
   ```bash
   heroku config:set TELEGRAM_BOT_TOKEN=your-token
   heroku config:set OPENAI_API_KEY=your-key
   ```
5. Deploy: `git push heroku main`
6. Scale: `heroku ps:scale web=1`

---

## Quick Comparison

| Service | Cost | Setup | Always-On Free? | Best For |
|---------|------|-------|------------------|----------|
| **Railway** | $5/mo | ⭐⭐⭐⭐⭐ | No | Easiest setup |
| **Render** | Free/$7 | ⭐⭐⭐⭐ | $7/mo | Free tier available |
| **DigitalOcean** | $6/mo | ⭐⭐⭐ | No | Full control |
| **Heroku** | $5/mo | ⭐⭐⭐⭐ | No | Simple deployment |

---

## Environment Variables Needed

Make sure to set these on your hosting platform:

```env
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
OPENAI_API_KEY=your-openai-key (optional)
ANTHROPIC_API_KEY=your-claude-key (optional)
NODE_ENV=production
```

---

## After Deployment

1. **Test the bot:** Send `/help` in your Telegram group
2. **Monitor logs:** Use your platform's log viewer or SSH in and run `pm2 logs`
3. **Update code:** Push to GitHub, most platforms auto-deploy

---

## Recommended: Railway

For the easiest setup, I recommend **Railway**. It's designed for exactly this use case and handles everything automatically.

Need help with a specific platform? Let me know!

