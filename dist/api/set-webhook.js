"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const index_js_1 = require("../src/bot/index.js");
const config_js_1 = require("../src/config.js");
async function default_1(req, res) {
    res.setHeader('Content-Type', 'application/json');
    if (!config_js_1.config.botToken) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: 'BOT_TOKEN is not configured.' }));
        return;
    }
    try {
        // Determine the webhook URL from host header or APP_URL
        const host = req.headers.host;
        const protocol = host?.includes('localhost') ? 'http' : 'https';
        const baseUrl = config_js_1.config.appUrl || (host ? `${protocol}://${host}` : '');
        if (!baseUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({
                ok: false,
                error: 'Could not determine domain. Please set APP_URL in environment variables.',
            }));
            return;
        }
        const webhookUrl = `${baseUrl}/api/webhook`;
        // Register webhook with Telegram
        await index_js_1.bot.api.setWebhook(webhookUrl, {
            secret_token: config_js_1.config.webhookSecret || undefined,
            allowed_updates: ['message', 'chat_join_request', 'callback_query', 'my_chat_member'],
            drop_pending_updates: false,
        });
        // Auto-update Telegram Bot Command list menu
        const { updateBotCommands } = await import('../src/bot/services/commandService.js');
        const commandResult = await updateBotCommands(index_js_1.bot);
        const info = await index_js_1.bot.api.getWebhookInfo();
        res.statusCode = 200;
        res.end(JSON.stringify({
            ok: true,
            message: 'Webhook and Bot Commands have been successfully configured!',
            webhookUrl,
            commandsUpdated: commandResult.success,
            commandsCount: commandResult.count,
            webhookInfo: info,
        }, null, 2));
    }
    catch (error) {
        console.error('[set-webhook Error]:', error);
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: error.message || 'Failed to set webhook' }));
    }
}
