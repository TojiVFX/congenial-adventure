"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStatusText = buildStatusText;
exports.getStatusKeyboard = getStatusKeyboard;
exports.handleStatusCommand = handleStatusCommand;
exports.handleStatusCallback = handleStatusCallback;
exports.handleClearErrorsCallback = handleClearErrorsCallback;
exports.handleCleanCommand = handleCleanCommand;
exports.handleCleanupCallback = handleCleanupCallback;
const grammy_1 = require("grammy");
const mongoose_1 = __importDefault(require("mongoose"));
const User_js_1 = require("../../db/models/User.js");
const Channel_js_1 = require("../../db/models/Channel.js");
const RequestLog_js_1 = require("../../db/models/RequestLog.js");
const InviteLink_js_1 = require("../../db/models/InviteLink.js");
const SystemError_js_1 = require("../../db/models/SystemError.js");
const admin_js_1 = require("./admin.js");
const cleanupService_js_1 = require("../services/cleanupService.js");
const html_js_1 = require("../utils/html.js");
function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0)
        parts.push(`${d}d`);
    if (h > 0)
        parts.push(`${h}h`);
    if (m > 0)
        parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}
/**
 * Builds the comprehensive status and diagnostic text
 */
async function buildStatusText() {
    // 1. Database connection and ping
    const readyState = mongoose_1.default.connection.readyState;
    let dbStatus = '🔴 Disconnected';
    if (readyState === 1)
        dbStatus = '🟢 Connected';
    else if (readyState === 2)
        dbStatus = '🟡 Connecting';
    const pingStart = Date.now();
    let pingDisplay = 'N/A';
    try {
        if (mongoose_1.default.connection.db) {
            await mongoose_1.default.connection.db.admin().ping();
            pingDisplay = `${Date.now() - pingStart}ms`;
        }
    }
    catch {
        pingDisplay = 'Timeout / Error';
    }
    // 2. System and Memory info
    const mem = process.memoryUsage();
    const rssMb = (mem.rss / 1024 / 1024).toFixed(1);
    const heapUsedMb = (mem.heapUsed / 1024 / 1024).toFixed(1);
    const uptimeStr = formatUptime(process.uptime());
    const nowUtc = new Date().toISOString().replace('T', ' ').substring(0, 19);
    // 3. Database counts in parallel
    const [totalUsers, approvedChannels, pendingChannels, approvedRequests, pendingRequests, rejectedRequests, activeLinks, recentErrors,] = await Promise.all([
        User_js_1.User.countDocuments(),
        Channel_js_1.Channel.countDocuments({ status: 'approved' }),
        Channel_js_1.Channel.countDocuments({ status: 'pending' }),
        RequestLog_js_1.RequestLog.countDocuments({ status: 'approved' }),
        RequestLog_js_1.RequestLog.countDocuments({ status: 'pending' }),
        RequestLog_js_1.RequestLog.countDocuments({ status: 'rejected' }),
        InviteLink_js_1.InviteLink.countDocuments({ used: false, expiresAt: { $gt: new Date() } }),
        SystemError_js_1.SystemError.find().sort({ createdAt: -1 }).limit(5),
    ]);
    let text = `🛡️ <b>sʏsᴛᴇᴍ sᴛᴀᴛᴜs & ᴅɪᴀɢɴᴏsᴛɪᴄs</b>\n\n` +
        `⚡ <b>ɪɴғʀᴀsᴛʀᴜᴄᴛᴜʀᴇ:</b>\n` +
        `• <b>Database:</b> ${dbStatus} (Ping: <code>${pingDisplay}</code>)\n` +
        `• <b>Engine Uptime:</b> <code>${uptimeStr}</code>\n` +
        `• <b>Node.js:</b> <code>${process.version}</code>\n` +
        `• <b>Memory Usage:</b> <code>${rssMb} MB</code> (Heap: <code>${heapUsedMb} MB</code>)\n` +
        `• <b>Server Time:</b> <code>${nowUtc} UTC</code>\n\n` +
        `📊 <b>ʟɪᴠᴇ ᴍᴇᴛʀɪᴄs:</b>\n` +
        `• <b>Registered Users:</b> <code>${totalUsers}</code>\n` +
        `• <b>Channels:</b> <code>${approvedChannels + pendingChannels}</code> (<code>${approvedChannels}</code> active, <code>${pendingChannels}</code> pending)\n` +
        `• <b>Join Requests:</b> <code>${approvedRequests + pendingRequests + rejectedRequests}</code> ` +
        `(` +
        `✅ <code>${approvedRequests}</code> | ` +
        `⏳ <code>${pendingRequests}</code> | ` +
        `❌ <code>${rejectedRequests}</code>` +
        `)\n` +
        `• <b>Active Expiring Links:</b> <code>${activeLinks}</code>\n\n`;
    // 4. Render collapsible error messages using Telegram's <blockquote expandable>
    if (recentErrors.length === 0) {
        text += `✅ <b>ʀᴇᴄᴇɴᴛ ᴇʀʀᴏʀs:</b>\n<i>No critical errors recorded. All systems operational!</i>`;
    }
    else {
        text += `⚠️ <b>ʀᴇᴄᴇɴᴛ ᴇʀʀᴏʀ ʟᴏɢs (${recentErrors.length}):</b>\n`;
        recentErrors.forEach((err, idx) => {
            const time = new Date(err.createdAt).toISOString().replace('T', ' ').substring(0, 19);
            const codeStr = err.code ? ` (Code: <code>${err.code}</code>)` : '';
            const cat = (0, html_js_1.escapeHtml)((err.category || 'ERROR').toUpperCase());
            text += `\n${idx + 1}. <b>[${time} UTC] ${cat}</b>${codeStr}\n`;
            text += `<blockquote expandable>`;
            if (err.context) {
                text += `<b>Context:</b> ${(0, html_js_1.escapeHtml)(err.context)}\n`;
            }
            text += `<b>Message:</b> ${(0, html_js_1.escapeHtml)(err.message)}`;
            if (err.stack) {
                const firstLines = err.stack.split('\n').slice(0, 4).join('\n');
                text += `\n\n<b>Trace:</b>\n<code>${(0, html_js_1.escapeHtml)(firstLines)}</code>`;
            }
            text += `</blockquote>`;
        });
    }
    return text;
}
/**
 * Renders the status keyboard
 */
function getStatusKeyboard() {
    return new grammy_1.InlineKeyboard()
        .text('🔄 ʀᴇғʀᴇsʜ sᴛᴀᴛᴜs', 'admin_status_refresh')
        .text('🧹 ᴄʟᴇᴀɴ ʀᴀᴍ & ᴅɪsᴋ', 'admin_cleanup')
        .row()
        .text('🗑️ ᴄʟᴇᴀʀ ᴇʀʀᴏʀs', 'admin_clear_errors')
        .text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴅᴀsʜʙᴏᴀʀᴅ', 'admin_home');
}
/**
 * /status command entry point (Admin Only)
 */
async function handleStatusCommand(ctx) {
    const from = ctx.from;
    if (!from || !(await (0, admin_js_1.isAdmin)(from.id))) {
        await ctx.reply('⛔ <b>ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ</b>: This command is restricted to administrators.', {
            parse_mode: 'HTML',
        });
        return;
    }
    const text = await buildStatusText();
    await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: getStatusKeyboard(),
    });
}
/**
 * Handles 'admin_status' and 'admin_status_refresh' callback queries
 */
async function handleStatusCallback(ctx) {
    const from = ctx.from;
    if (!from || !(await (0, admin_js_1.isAdmin)(from.id))) {
        await ctx.answerCallbackQuery({ text: 'Access denied.' });
        return;
    }
    await ctx.answerCallbackQuery({ text: 'Refreshing status...' });
    const text = await buildStatusText();
    try {
        await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: getStatusKeyboard(),
        });
    }
    catch (err) {
        if (!/message is not modified/i.test(err?.description || '')) {
            await ctx.reply(text, {
                parse_mode: 'HTML',
                reply_markup: getStatusKeyboard(),
            });
        }
    }
}
/**
 * Handles 'admin_clear_errors' callback query
 */
async function handleClearErrorsCallback(ctx) {
    const from = ctx.from;
    if (!from || !(await (0, admin_js_1.isAdmin)(from.id))) {
        await ctx.answerCallbackQuery({ text: 'Access denied.' });
        return;
    }
    await SystemError_js_1.SystemError.deleteMany({});
    await ctx.answerCallbackQuery({ text: '🧹 Error logs cleared successfully!' });
    const text = await buildStatusText();
    try {
        await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: getStatusKeyboard(),
        });
    }
    catch { }
}
/**
 * /clean command entry point (Admin Only)
 */
async function handleCleanCommand(ctx) {
    const from = ctx.from;
    if (!from || !(await (0, admin_js_1.isAdmin)(from.id))) {
        await ctx.reply('⛔ <b>ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ</b>: This command is restricted to administrators.', {
            parse_mode: 'HTML',
        });
        return;
    }
    const statusMsg = await ctx.reply('🧹 <i>Cleaning RAM and Disk storage...</i>', {
        parse_mode: 'HTML',
    });
    const res = await cleanupService_js_1.CleanupService.performCleanup();
    const diskFreedMb = (res.diskBytesCleaned / 1024 / 1024).toFixed(2);
    const text = `🧹 <b>sʏsᴛᴇᴍ ᴄʟᴇᴀɴᴜᴘ ᴄᴏᴍᴘʟᴇᴛᴇ</b>\n\n` +
        `⚡ <b>ʀᴀᴍ ᴏᴘᴛɪᴍɪᴢᴀᴛɪᴏɴ:</b>\n` +
        `• <b>RAM Before:</b> <code>${res.ramBeforeMb.toFixed(1)} MB</code>\n` +
        `• <b>RAM After:</b> <code>${res.ramAfterMb.toFixed(1)} MB</code>\n` +
        `• <b>Freed Memory:</b> <code>${res.ramFreedMb.toFixed(1)} MB</code>\n\n` +
        `🗄️ <b>ᴅɪsᴋ & ᴅᴀᴛᴀʙᴀsᴇ:</b>\n` +
        `• <b>Old Join Logs Pruned (>30d):</b> <code>${res.dbLogsRemoved}</code>\n` +
        `• <b>Expired Invite Links Pruned:</b> <code>${res.expiredLinksRemoved}</code>\n` +
        `• <b>Stale Sessions Cleared:</b> <code>${res.sessionsRemoved}</code>\n` +
        `• <b>Old Errors Cleared:</b> <code>${res.errorsRemoved}</code>\n` +
        `• <b>Disk Log Space Freed:</b> <code>${diskFreedMb} MB</code>\n\n` +
        `⏱️ <i>Completed in ${res.durationMs}ms</i>`;
    try {
        await ctx.api.editMessageText(statusMsg.chat.id, statusMsg.message_id, text, {
            parse_mode: 'HTML',
            reply_markup: new grammy_1.InlineKeyboard().text('🔄 ʀᴇғʀᴇsʜ sᴛᴀᴛᴜs', 'admin_status_refresh'),
        });
    }
    catch {
        await ctx.reply(text, { parse_mode: 'HTML' });
    }
}
/**
 * Handles 'admin_cleanup' callback query from the status dashboard
 */
async function handleCleanupCallback(ctx) {
    const from = ctx.from;
    if (!from || !(await (0, admin_js_1.isAdmin)(from.id))) {
        await ctx.answerCallbackQuery({ text: 'Access denied.' });
        return;
    }
    await ctx.answerCallbackQuery({ text: '🧹 Running cleanup...' });
    const res = await cleanupService_js_1.CleanupService.performCleanup();
    const alertText = `🧹 Cleaned in ${res.durationMs}ms!\n` +
        `RAM: ${res.ramBeforeMb.toFixed(0)}MB -> ${res.ramAfterMb.toFixed(0)}MB (Freed ${res.ramFreedMb.toFixed(1)}MB)\n` +
        `Pruned: ${res.dbLogsRemoved} logs, ${res.expiredLinksRemoved} links`;
    try {
        await ctx.answerCallbackQuery({ text: alertText, show_alert: true });
    }
    catch { }
    const text = await buildStatusText();
    try {
        await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: getStatusKeyboard(),
        });
    }
    catch { }
}
