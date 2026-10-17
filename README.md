# 🤖 Auto-Approval-Bot (Telegram Auto Request Approval Bot for Vercel)

A production-ready Telegram Auto Request Approval Bot built with **TypeScript**, **grammY**, and **MongoDB Atlas**, optimized for **serverless deployment on Vercel** (no expensive VPS required).

---

## ✨ Features

- ⚡ **Auto-Approve Join Requests**: Automatically approves new member requests to private channels or groups the moment they arrive via Telegram's `chat_join_request` API.
- 🎛️ **Toggleable Auto-Approval**: Easily enable or disable auto-approval per channel from the admin panel. When disabled, the invite links still work and requests are kept pending for manual review.
- 🔗 **Smart Link Generator**:
  - **Bot Deep Links**: Generates clean, short links formatted like `https://t.me/BotUsername?start=inv_bcibiv`. When clicked, users start the bot in private, get registered in the database, and receive the channel invite button.
  - **Direct Invite Links**: Generates native Telegram channel invite links with join requests enabled (`creates_join_request: true`).
- 👑 **In-Bot Admin Dashboard (`/admin`)**:
  - **Analytics**: Real-time stats on registered users, active channels, total join requests, approved count, and pending count.
  - **Channel Manager**: Add channels by ID or by forwarding a message, check bot permissions, and toggle auto-approval.
  - **Welcome Message Customizer**: Set custom welcome messages per channel.
  - **Link Center**: Generate and copy channel links instantly.
  - **Broadcast Tool**: Broadcast announcements to all bot users.
- 📋 **Audit Log Channel**: Real-time notifications sent to your dedicated Telegram log channel for every new user, join request, auto-approval, and admin configuration change.
- ⚡ **Auto-Updated Command Menu**: Bot automatically registers its command list (`/start`, `/help`, `/admin`) directly with Telegram's menu button upon webhook setup or via the admin dashboard button.
- ☁️ **Serverless on Vercel**: Uses webhooks and connection-pooled MongoDB Atlas. Runs 24/7 on Vercel's free tier with zero maintenance.

---

## 🚀 Quick Setup & Deployment Guide

### Step 1: Create Your Bot on Telegram

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot`, choose a name and a username (must end in `bot`, e.g. `MyJoinApproveBot`).
3. Copy the **HTTP API Token** (e.g. `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`).

---

### Step 2: Get a Free MongoDB Atlas Database

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up for a free account.
2. Create a free **M0 Sandbox** cluster (100% free, no credit card required).
3. Under **Database Access**, create a database user (e.g., `botadmin` and set a password).
4. Under **Network Access**, click **Add IP Address** and select **Allow Access from Anywhere (`0.0.0.0/0`)** (required for serverless platforms like Vercel).
5. Click **Connect** -> **Drivers (Node.js)** and copy your connection string:
   ```
   mongodb+srv://botadmin:<password>@cluster0.abcde.mongodb.net/auto_approve_bot?retryWrites=true&w=majority
   ```
   *(Replace `<password>` with your database password).*

---

### Step 3: Get Your Telegram User ID

1. In Telegram, start [@userinfobot](https://t.me/userinfobot) or [@MissRose_bot](https://t.me/MissRose_bot) (send `/id`).
2. Copy your numeric User ID (e.g. `987654321`).

---

### Step 4: Deploy to Vercel

#### Method A: Deploy via GitHub (Recommended)

1. Initialize git and push this repository to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/tg-auto-request-accept-bot.git
   git push -u origin main
   ```
2. Log into [Vercel](https://vercel.com/) and click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. In the **Environment Variables** section, add:
   - `BOT_TOKEN`: Your bot token from @BotFather.
   - `MONGODB_URI`: Your MongoDB connection string from Step 2.
   - `ADMIN_IDS`: Your Telegram User ID from Step 3 (comma-separated for multiple admins).
   - `APP_URL`: *(Leave empty for now or set after deployment)*.
   - `WEBHOOK_SECRET`: *(Optional)* Any random secret string (e.g. `my_secret_token_123`).
5. Click **Deploy**.
6. Once deployed, copy your Vercel deployment domain (e.g. `https://your-bot-name.vercel.app`).
7. Update the `APP_URL` environment variable in Vercel project settings with your URL, then redeploy.

#### Method B: Deploy via Vercel CLI

```bash
npm install -g vercel
vercel
```
Follow the prompts, set the environment variables when prompted, and deploy!

---

### Step 5: Activate the Telegram Webhook (1-Click)

Once deployed, open your web browser and navigate to:
```text
https://your-bot-name.vercel.app/api/set-webhook
```

You will see a JSON response confirming:
```json
{
  "ok": true,
  "message": "Webhook has been successfully configured!",
  "webhookUrl": "https://your-bot-name.vercel.app/api/webhook"
}
```

---

## 🛠️ Bot Configuration in Telegram

### 1. Add Bot to your Channel(s)
1. Open your Telegram Channel or Supergroup.
2. Go to **Channel Settings** -> **Administrators** -> **Add Administrator**.
3. Search for your bot username and add it.
4. **Important Permissions**:
   - Turn ON **"Invite Users via Link"** (or **"Add Users"**).
   - Turn ON **"Manage Chat"**.
5. Ensure your channel has join requests enabled (or use the invite links generated by the bot).

### 2. Set Up a Log Channel (Optional but Recommended)
1. Create a private Telegram channel (e.g. `My Bot Logs`).
2. Add your bot as an **Administrator** with **"Send Messages"** permission.
3. Open your bot in private chat and send `/admin`.
4. Click **📋 Log Channel** -> **Set / Change Log Channel**.
5. Forward a message from your log channel or enter its channel ID (e.g. `-1001234567890`).

### 3. Add Channel via Admin Dashboard
1. In your bot private chat, send `/admin`.
2. Click **📢 Manage Channels** -> **➕ Add New Channel**.
3. Forward any post from your channel or send its Channel ID.
4. The bot will automatically verify its administrator rights, generate your **Bot Deep Link** and **Channel Invite Link**, and enable auto-approval!

---

## 📖 Deep-Link Format Explained

The bot automatically generates clean, professional short links in the format:
```text
https://t.me/BotUsername?start=inv_bcibiv
```
- Starts with `inv_`
- Followed by random alphanumeric characters (A-Z, a-z, 0-9)
- No hyphens (`-`) for clean aesthetic appearance

### Why use Bot Deep-Links instead of direct channel links?
1. **Telegram Privacy Barrier**: By default, Telegram prohibits bots from sending private messages or broadcasting to users who have never started the bot.
2. **Audience Retention**: When users click your deep-link, they start the bot in private. The bot registers them in your database, presents the channel join request button, and can send them welcome messages and future broadcasts.
3. **Tracking**: The bot tracks which link the user came from and logs the entry in your Log Channel.

*(If you prefer direct channel join links without the bot start step, the bot also generates direct `https://t.me/+...` join-request links!)*

---

## 💻 Local Development (Optional)

You can also run the bot locally on your computer in polling mode:

1. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
2. Build and start the bot:
   ```bash
   npm run build
   npm start
   ```

---

## 📁 Project Structure

```
├── api/
│   ├── webhook.ts            # Vercel serverless webhook endpoint
│   ├── set-webhook.ts        # 1-click webhook registration endpoint
│   └── health.ts             # Health check & DB status endpoint
├── src/
│   ├── bot/
│   │   ├── index.ts          # Grammy bot instance & middleware
│   │   ├── handlers/
│   │   │   ├── start.ts      # /start and deep-link resolving (?start=...)
│   │   │   ├── joinRequest.ts# chat_join_request auto-approval & toggle
│   │   │   └── admin.ts      # In-bot interactive Admin Dashboard
│   │   ├── keyboards/
│   │   │   └── adminKeyboards.ts # Inline button menus
│   │   └── services/
│   │       ├── linkService.ts    # Deep-link & invite link generator
│   │       ├── loggerService.ts  # Formatted logging to Log Channel
│   │       └── channelService.ts # Channel permission validation
│   ├── db/
│   │   ├── connection.ts     # Cached MongoDB connection for Vercel
│   │   └── models/
│   │       ├── Channel.ts    # Channel settings & auto-approve toggle
│   │       ├── User.ts       # Bot users & referral sources
│   │       ├── RequestLog.ts # Audit logs
│   │       └── Settings.ts   # Global settings & admin sessions
│   ├── config.ts             # Typed configuration
│   └── local.ts              # Local polling runner
├── vercel.json               # Vercel configuration & rewrites
├── package.json
└── tsconfig.json
```

---

## 🛡️ License

MIT License. Free to use, modify, and distribute.
