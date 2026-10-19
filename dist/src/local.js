"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("./bot/index.js");
const connection_js_1 = require("./db/connection.js");
async function startLocal() {
    console.log('🚀 Starting Telegram Auto Request Accept Bot locally in polling mode...');
    try {
        await (0, connection_js_1.connectDB)();
        console.log('✅ Connected to MongoDB.');
        // Delete webhook if previously set so polling works locally
        await index_js_1.bot.api.deleteWebhook();
        console.log('🧹 Webhook cleared for local polling.');
        // Auto-sync command list with Telegram
        await (0, index_js_1.updateBotCommands)(index_js_1.bot);
        const me = await index_js_1.bot.api.getMe();
        console.log(`🤖 Bot @${me.username} is running! Press Ctrl+C to stop.`);
        await index_js_1.bot.start({
            allowed_updates: ['message', 'chat_join_request', 'callback_query'],
        });
    }
    catch (err) {
        console.error('❌ Failed to start local bot:', err);
        process.exit(1);
    }
}
startLocal();
