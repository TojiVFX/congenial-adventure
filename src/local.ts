import { bot, updateBotCommands } from './bot/index.js';
import { connectDB } from './db/connection.js';

async function startLocal() {
  console.log('🚀 Starting Telegram Auto Request Accept Bot locally in polling mode...');
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB.');

    // Delete webhook if previously set so polling works locally
    await bot.api.deleteWebhook();
    console.log('🧹 Webhook cleared for local polling.');

    // Auto-sync command list with Telegram
    await updateBotCommands(bot);

    const me = await bot.api.getMe();
    console.log(`🤖 Bot @${me.username} is running! Press Ctrl+C to stop.`);

    await bot.start({
      allowed_updates: ['message', 'chat_join_request', 'callback_query'],
    });
  } catch (err) {
    console.error('❌ Failed to start local bot:', err);
    process.exit(1);
  }
}

startLocal();
