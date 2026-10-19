"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const grammy_1 = require("grammy");
const index_js_1 = require("../src/bot/index.js");
const config_js_1 = require("../src/config.js");
const connection_js_1 = require("../src/db/connection.js");
const timeoutMs = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '9500', 10);
const handler = (0, grammy_1.webhookCallback)(index_js_1.bot, 'http', {
    secretToken: config_js_1.config.webhookSecret || undefined,
    timeoutMilliseconds: timeoutMs,
});
async function default_1(req, res) {
    if (req.method === 'POST') {
        // Database failure: return 500 so Telegram retries the update later
        try {
            await (0, connection_js_1.connectDB)();
        }
        catch (err) {
            console.error('[Webhook DB Error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Database unavailable' }));
            return;
        }
        // Handler errors: log them but answer 200, otherwise Telegram re-sends the same update repeatedly
        try {
            return await handler(req, res);
        }
        catch (err) {
            console.error('[Webhook Error]:', err);
            if (!res.headersSent) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true }));
            }
        }
    }
    else {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', service: 'Telegram Auto Request Accept Bot' }));
    }
}
