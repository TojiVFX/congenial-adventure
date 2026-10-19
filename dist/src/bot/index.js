"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = exports.updateBotCommands = void 0;
const grammy_1 = require("grammy");
const auto_retry_1 = require("@grammyjs/auto-retry");
const config_js_1 = require("../config.js");
const connection_js_1 = require("../db/connection.js");
const start_js_1 = require("./handlers/start.js");
const contact_js_1 = require("./handlers/contact.js");
const joinRequest_js_1 = require("./handlers/joinRequest.js");
const admin_js_1 = require("./handlers/admin.js");
const userChannel_js_1 = require("./handlers/userChannel.js");
const acceptAll_js_1 = require("./handlers/acceptAll.js");
const status_js_1 = require("./handlers/status.js");
const commandService_js_1 = require("./services/commandService.js");
Object.defineProperty(exports, "updateBotCommands", { enumerable: true, get: function () { return commandService_js_1.updateBotCommands; } });
const loggerService_js_1 = require("./services/loggerService.js");
const errors_js_1 = require("./utils/errors.js");
const SystemError_js_1 = require("../db/models/SystemError.js");
(0, config_js_1.validateConfig)();
exports.bot = new grammy_1.Bot(config_js_1.config.botToken);
// 1. Auto-Retry Telegram Rate Limits (429) - adjusted for 24/7 VPS hosting
exports.bot.api.config.use((0, auto_retry_1.autoRetry)({
    maxDelaySeconds: 60,
    maxRetryAttempts: 3,
}));
// 2. Ignore "query is too old" errors from answerCallbackQuery
exports.bot.api.config.use(async (prev, method, payload, signal) => {
    const res = await prev(method, payload, signal);
    if (!res.ok &&
        method === 'answerCallbackQuery' &&
        /query is too old|query ID is invalid/i.test(res.description || '')) {
        console.warn('[Bot] Ignored expired callback query.');
        return { ok: true, result: true };
    }
    return res;
});
// Middleware: ensure database connection is established
exports.bot.use(async (ctx, next) => {
    try {
        await (0, connection_js_1.connectDB)();
    }
    catch (err) {
        console.error('[Bot Middleware] Database connection error:', err);
    }
    await next();
});
// Commands
exports.bot.command('start', start_js_1.handleStart);
exports.bot.command('help', start_js_1.handleHelp);
exports.bot.command(['contact', 'request'], contact_js_1.handleContactCommand);
exports.bot.command(['dashboard', 'admin', 'panel'], admin_js_1.handleAdminCommand);
exports.bot.command(['status', 'systemstatus', 'health'], status_js_1.handleStatusCommand);
exports.bot.command(['managechat', 'manage', 'mychannels', 'addchannel'], userChannel_js_1.handleManageChatCommand);
exports.bot.command(['acceptall', 'accepall'], acceptAll_js_1.handleAcceptAllCommand);
// Join Requests: Auto-Approval & Logging
exports.bot.on('chat_join_request', joinRequest_js_1.handleChatJoinRequest);
// Callback Queries
exports.bot.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith('user_chan_')) {
        await (0, userChannel_js_1.handleUserChannelCallback)(ctx);
        return;
    }
    if (data.startsWith('admin_approve_chan:') || data.startsWith('admin_reject_chan:')) {
        await (0, userChannel_js_1.handleAdminApprovalCallback)(ctx);
        return;
    }
    if (data.startsWith('acceptall_continue:')) {
        await (0, acceptAll_js_1.handleAcceptAllCallback)(ctx);
        return;
    }
    if (data === 'admin_status' || data === 'admin_status_refresh') {
        await (0, status_js_1.handleStatusCallback)(ctx);
        return;
    }
    if (data === 'admin_clear_errors') {
        await (0, status_js_1.handleClearErrorsCallback)(ctx);
        return;
    }
    await (0, admin_js_1.handleAdminCallback)(ctx);
});
// Text & Forward Input Listener (Admin Sessions, User Channel Inputs & Contact Submissions)
exports.bot.on('message', async (ctx, next) => {
    const handledAdmin = await (0, admin_js_1.handleAdminInput)(ctx);
    if (handledAdmin)
        return;
    const handledUserChannel = await (0, userChannel_js_1.handleUserChannelInput)(ctx);
    if (handledUserChannel)
        return;
    const handledContact = await (0, contact_js_1.handleContactMessage)(ctx);
    if (handledContact)
        return;
    await next();
});
// Granular Catch-all error handler
exports.bot.catch(async (err) => {
    const { ctx, error } = err;
    const classified = (0, errors_js_1.classifyError)(error);
    if (classified.isBenign) {
        console.warn(`[Bot Warning] Suppressed benign error: ${classified.message}`);
    }
    else {
        console.error(`[Bot Error] Category: ${classified.category} | Code: ${classified.code || 'N/A'}:`, classified.message);
        // Record error in MongoDB for /status diagnostics
        (0, SystemError_js_1.recordSystemError)(error, `Update #${ctx?.update?.update_id || 'unknown'} (${ctx?.from?.id ? `User ${ctx.from.id}` : 'system'})`).catch(() => { });
        if (classified.isCritical && ctx.api) {
            loggerService_js_1.LoggerService.logCriticalError(ctx, `System Alert: ${classified.category.toUpperCase()}`, classified.message).catch(() => { });
        }
    }
    // Release any stuck loading wheel if an unhandled error occurred in a callback query
    if (ctx?.callbackQuery) {
        ctx.answerCallbackQuery({
            text: classified.isCritical ? '⚠️ Operation failed. Admin notified.' : '⚠️ Action failed. Please try again.',
            show_alert: classified.isCritical,
        }).catch(() => { });
    }
});
