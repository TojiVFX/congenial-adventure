import v8 from 'v8';
try {
  v8.setFlagsFromString('--expose-gc');
} catch {}

import { bot, updateBotCommands } from './bot/index.js';
import { connectDB } from './db/connection.js';
import { CleanupService } from './bot/services/cleanupService.js';

// Process safety handlers to prevent unhandled network drops from crashing the server
process.on('unhandledRejection', (reason) => {
  console.error('[Process Warning] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process Warning] Uncaught Exception:', err);
});

async function startLocal() {
  console.log('🚀 Starting Telegram Auto Request Accept Bot in 24/7 polling mode...');
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB.');

    // Delete webhook if previously set so polling works locally
    await bot.api.deleteWebhook();
    console.log('🧹 Webhook cleared for polling.');

    // Auto-sync command list with Telegram
    await updateBotCommands(bot);

    // Start background auto-cleaner (every 30 mins + RAM watchdog)
    CleanupService.startAutoCleanup(30);
    console.log('🧹 Background auto-cleaner active (Disk & RAM optimization).');

    const me = await bot.api.getMe();
    console.log(`🤖 Bot @${me.username} is running! Press Ctrl+C to stop.`);

    // Graceful shutdown handling
    const stopBot = async () => {
      console.log('🛑 Stopping bot gracefully...');
      CleanupService.stopAutoCleanup();
      await bot.stop();
      process.exit(0);
    };
    process.once('SIGINT', stopBot);
    process.once('SIGTERM', stopBot);

    await bot.start({
      allowed_updates: ['message', 'chat_join_request', 'callback_query', 'my_chat_member'],
      drop_pending_updates: false,
    });
  } catch (err) {
    console.error('❌ Failed to start bot:', err);
    process.exit(1);
  }
}

startLocal();
