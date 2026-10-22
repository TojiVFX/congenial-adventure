"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("./bot/index.js");
const connection_js_1 = require("./db/connection.js");
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
        await (0, connection_js_1.connectDB)();
        console.log('✅ Connected to MongoDB.');
        // Delete webhook if previously set so polling works locally
        await index_js_1.bot.api.deleteWebhook();
        console.log('🧹 Webhook cleared for polling.');
        // Auto-sync command list with Telegram
        await (0, index_js_1.updateBotCommands)(index_js_1.bot);
        const me = await index_js_1.bot.api.getMe();
        console.log(`🤖 Bot @${me.username} is running! Press Ctrl+C to stop.`);
        // Graceful shutdown handling
        const stopBot = async () => {
            console.log('🛑 Stopping bot gracefully...');
            await index_js_1.bot.stop();
            process.exit(0);
        };
        process.once('SIGINT', stopBot);
        process.once('SIGTERM', stopBot);
        await index_js_1.bot.start({
            allowed_updates: ['message', 'chat_join_request', 'callback_query', 'my_chat_member'],
            drop_pending_updates: false,
        });
    }
    catch (err) {
        console.error('❌ Failed to start bot:', err);
        process.exit(1);
    }
}
startLocal();
