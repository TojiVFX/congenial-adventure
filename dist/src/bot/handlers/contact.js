"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTACT_CATEGORIES = void 0;
exports.handleContactCommand = handleContactCommand;
exports.handleContactMessage = handleContactMessage;
exports.handleAdminDirectReply = handleAdminDirectReply;
exports.handleContactCallback = handleContactCallback;
exports.handleAdminContactReplyInput = handleAdminContactReplyInput;
exports.handleReplyCommand = handleReplyCommand;
const grammy_1 = require("grammy");
const config_js_1 = require("../../config.js");
const Settings_js_1 = require("../../db/models/Settings.js");
const loggerService_js_1 = require("../services/loggerService.js");
const html_js_1 = require("../utils/html.js");
const admin_js_1 = require("./admin.js");
exports.CONTACT_CATEGORIES = {
    channel: {
        id: 'channel',
        label: '📢 Channel Approval / Setup',
        tag: '#CHANNEL_APPROVAL',
        instructions: `📢 <b>ᴄʜᴀɴɴᴇʟ ᴀᴘᴘʀᴏᴠᴀʟ & sᴇᴛᴜᴘ</b>\n\n` +
            `<b>ʙᴇғᴏʀᴇ sᴜʙᴍɪᴛᴛɪɴɢ, ᴘʟᴇᴀsᴇ ᴇɴsᴜʀᴇ:</b>\n` +
            `1. ᴛʜᴇ ʙᴏᴛ ɪs ᴀᴅᴅᴇᴅ ᴛᴏ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴀs ᴀɴ <b>ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ</b> ᴡɪᴛʜ "ɪɴᴠɪᴛᴇ ᴜsᴇʀs ᴠɪᴀ ʟɪɴᴋ" ᴘᴇʀᴍɪssɪᴏɴ.\n` +
            `2. sᴇɴᴅ ʏᴏᴜʀ <b>ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ, ᴜsᴇʀɴᴀᴍᴇ (@ᴄʜᴀɴɴᴇʟ), ᴏʀ ғᴏʀᴡᴀʀᴅ ᴀ ᴘᴏsᴛ</b> ғʀᴏᴍ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ʙᴇʟᴏᴡ.\n\n` +
            `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ.</i>`,
    },
    bug: {
        id: 'bug',
        label: '⚠️ Issue / Bug Report',
        tag: '#BUG_REPORT',
        instructions: `⚠️ <b>ɪssᴜᴇ / ʙᴜɢ ʀᴇᴘᴏʀᴛ</b>\n\n` +
            `<b>ᴘʟᴇᴀsᴇ ᴅᴇsᴄʀɪʙᴇ ᴛʜᴇ ɪssᴜᴇ ɪɴ ᴅᴇᴛᴀɪʟ:</b>\n` +
            `• ᴡʜᴀᴛ ᴡᴇʀᴇ ʏᴏᴜ ᴛʀʏɪɴɢ ᴛᴏ ᴅᴏ?\n` +
            `• ᴡʜᴀᴛ ᴇʀʀᴏʀ ᴏʀ ᴜɴᴇxᴘᴇᴄᴛᴇᴅ ʙᴇʜᴀᴠɪᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ?\n` +
            `• ʏᴏᴜ ᴄᴀɴ ᴀʟsᴏ ᴀᴛᴛᴀᴄʜ sᴄʀᴇᴇɴsʜᴏᴛs ᴏʀ ᴠɪᴅᴇᴏ ᴄʟɪᴘs.\n\n` +
            `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ.</i>`,
    },
    partnership: {
        id: 'partnership',
        label: '💼 Partnership / Promotion',
        tag: '#PARTNERSHIP',
        instructions: `💼 <b>ᴘᴀʀᴛɴᴇʀsʜɪᴘ & ᴘʀᴏᴍᴏᴛɪᴏɴ</b>\n\n` +
            `<b>ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴅᴇᴛᴀɪʟs ʀᴇɢᴀʀᴅɪɴɢ ʏᴏᴜʀ ᴘʀᴏᴘᴏsᴀʟ:</b>\n` +
            `• ᴄʜᴀɴɴᴇʟ, ʙᴏᴛ, ᴏʀ ʙᴜsɪɴᴇss ʟɪɴᴋs\n` +
            `• ᴅᴇsᴄʀɪᴘᴛɪᴏɴ ᴏғ ᴛʜᴇ ᴘʀᴏᴘᴏsᴇᴅ ᴄᴏʟʟᴀʙᴏʀᴀᴛɪᴏɴ ᴏʀ ᴘʀᴏᴍᴏᴛɪᴏɴ\n\n` +
            `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ.</i>`,
    },
    general: {
        id: 'general',
        label: '💬 General Inquiry',
        tag: '#GENERAL_INQUIRY',
        instructions: `💬 <b>ɢᴇɴᴇʀᴀʟ sᴜᴘᴘᴏʀᴛ</b>\n\n` +
            `ᴘʟᴇᴀsᴇ ᴛʏᴘᴇ ʏᴏᴜʀ ǫᴜᴇsᴛɪᴏɴ ᴏʀ ᴍᴇssᴀɢᴇ ʙᴇʟᴏᴡ.\n` +
            `ᴏᴜʀ ᴛᴇᴀᴍ ᴡɪʟʟ ʀᴇᴠɪᴇᴡ ɪᴛ ᴀɴᴅ ɢᴇᴛ ʙᴀᴄᴋ ᴛᴏ ʏᴏᴜ sʜᴏʀᴛʟʏ.\n\n` +
            `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ.</i>`,
    },
};
function getCategoryKeyboard() {
    return new grammy_1.InlineKeyboard()
        .text('📢 ᴄʜᴀɴɴᴇʟ ᴀᴘᴘʀᴏᴠᴀʟ / sᴇᴛᴜᴘ', 'contact_cat:channel')
        .row()
        .text('⚠️ ɪssᴜᴇ / ʙᴜɢ ʀᴇᴘᴏʀᴛ', 'contact_cat:bug')
        .row()
        .text('💼 ᴘᴀʀᴛɴᴇʀsʜɪᴘ / ᴘʀᴏᴍᴏᴛɪᴏɴ', 'contact_cat:partnership')
        .row()
        .text('💬 ɢᴇɴᴇʀᴀʟ ɪɴǫᴜɪʀʏ', 'contact_cat:general')
        .row()
        .text('❌ ᴄᴀɴᴄᴇʟ', 'user_contact_end');
}
/**
 * Entry point for /contact, /support, /request
 */
async function handleContactCommand(ctx) {
    const from = ctx.from;
    if (!from)
        return;
    // 1. Check if user already has an active request awaiting admin reply
    const existingSession = await (0, Settings_js_1.getAdminSession)(from.id);
    if (existingSession && existingSession.state === 'WAITING_ADMIN_RESPONSE') {
        await ctx.reply(`⏳ <b>ʏᴏᴜ ᴀʟʀᴇᴀᴅʏ ʜᴀᴠᴇ ᴀɴ ᴀᴄᴛɪᴠᴇ ʀᴇǫᴜᴇsᴛ!</b>\n\n` +
            `ʏᴏᴜʀ ᴘʀᴇᴠɪᴏᴜs ᴍᴇssᴀɢᴇ ɪs ᴄᴜʀʀᴇɴᴛʟʏ ᴡᴀɪᴛɪɴɢ ғᴏʀ ᴀɴ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ʀᴇsᴘᴏɴsᴇ.\n` +
            `ʏᴏᴜ ᴄᴀɴɴᴏᴛ sᴇɴᴅ ᴀɴᴏᴛʜᴇʀ ᴍᴇssᴀɢᴇ ᴜɴᴛɪʟ ᴀɴ ᴀᴅᴍɪɴ ʀᴇᴘʟɪᴇs ᴏʀ ᴄʟᴏsᴇs ᴛʜᴇ ᴄʜᴀᴛ.\n\n` +
            `<i>sᴇɴᴅ /cancel ɪғ ʏᴏᴜ ᴡɪsʜ ᴛᴏ ᴄᴀɴᴄᴇʟ ʏᴏᴜʀ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛ.</i>`, { parse_mode: 'HTML' });
        return;
    }
    const match = ctx.match;
    const pendingText = match?.trim();
    // 2. User typed text with command -> save text and ask for category first
    if (pendingText && pendingText.length > 0) {
        await (0, Settings_js_1.setAdminSession)(from.id, 'WAITING_USER_CATEGORY', {
            pendingText,
            chatId: ctx.chat?.id,
        });
        const categoryPrompt = `💬 <b>ʟɪᴠᴇ sᴜᴘᴘᴏʀᴛ | sᴇʟᴇᴄᴛ ᴄᴀᴛᴇɢᴏʀʏ</b>\n\n` +
            `ᴘʟᴇᴀsᴇ sᴇʟᴇᴄᴛ ᴛʜᴇ <b>ᴄᴀᴛᴇɢᴏʀʏ</b> ᴛʜᴀᴛ ʙᴇsᴛ ᴅᴇsᴄʀɪʙᴇs ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ:\n\n` +
            `<i>ʏᴏᴜʀ ᴍᴇssᴀɢᴇ ʜᴀs ʙᴇᴇɴ sᴀᴠᴇᴅ ᴀɴᴅ ᴡɪʟʟ ʙᴇ sᴇɴᴛ ɪᴍᴍᴇᴅɪᴀᴛᴇʟʏ ᴀғᴛᴇʀ ʏᴏᴜ ᴘɪᴄᴋ ᴀ ᴄᴀᴛᴇɢᴏʀʏ.</i>`;
        await ctx.reply(categoryPrompt, {
            parse_mode: 'HTML',
            reply_markup: getCategoryKeyboard(),
        });
        return;
    }
    // 3. Normal /contact without text -> show category picker
    await (0, Settings_js_1.setAdminSession)(from.id, 'WAITING_USER_CATEGORY', {
        chatId: ctx.chat?.id,
    });
    const promptText = `💬 <b>ʟɪᴠᴇ sᴜᴘᴘᴏʀᴛ | sᴇʟᴇᴄᴛ ᴄᴀᴛᴇɢᴏʀʏ</b>\n\n` +
        `ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ᴏᴜʀ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ sᴜᴘᴘᴏʀᴛ ɢᴀᴛᴇᴡᴀʏ.\n` +
        `ᴘʟᴇᴀsᴇ sᴇʟᴇᴄᴛ ᴛʜᴇ <b>ᴄᴀᴛᴇɢᴏʀʏ</b> ᴛʜᴀᴛ ʙᴇsᴛ ᴍᴀᴛᴄʜᴇs ʏᴏᴜʀ ɪɴǫᴜɪʀʏ:`;
    const kb = getCategoryKeyboard();
    if (ctx.callbackQuery) {
        try {
            await ctx.editMessageText(promptText, { parse_mode: 'HTML', reply_markup: kb });
            return;
        }
        catch { }
    }
    await ctx.reply(promptText, { parse_mode: 'HTML', reply_markup: kb });
}
/**
 * Handles incoming messages from users in support sessions (enforces 1 message per admin reply)
 */
async function handleContactMessage(ctx) {
    const from = ctx.from;
    if (!from)
        return false;
    const session = await (0, Settings_js_1.getAdminSession)(from.id);
    if (!session)
        return false;
    // Case A: User already sent their 1 message and is WAITING for admin to reply
    if (session.state === 'WAITING_ADMIN_RESPONSE') {
        const text = ctx.message?.text?.trim();
        // User cancels their pending request
        if (text === '/cancel' || text === '/end') {
            await (0, Settings_js_1.clearAdminSession)(from.id);
            await ctx.reply(`❌ <b>sᴜᴘᴘᴏʀᴛ ʀᴇǫᴜᴇsᴛ ᴄᴀɴᴄᴇʟʟᴇᴅ</b>\n\n` +
                `ʏᴏᴜʀ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛ ʜᴀs ʙᴇᴇɴ ᴄᴀɴᴄᴇʟʟᴇᴅ. ʏᴏᴜ ᴄᴀɴ sᴛᴀʀᴛ ᴀ ɴᴇᴡ ᴏɴᴇ ᴀɴʏᴛɪᴍᴇ ᴠɪᴀ /contact.`, { parse_mode: 'HTML' });
            return true;
        }
        // Allow standard commands like /start or /help to proceed
        if (text && text.startsWith('/')) {
            return false;
        }
        // User attempts to spam/send another message -> Block and remind
        await ctx.reply(`⏳ <b>ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ ғᴏʀ ᴀɴ ᴀᴅᴍɪɴ ʀᴇᴘʟʏ!</b>\n\n` +
            `ʏᴏᴜ ʜᴀᴠᴇ ᴀʟʀᴇᴀᴅʏ sᴇɴᴛ ᴀ ᴍᴇssᴀɢᴇ ᴛᴏ sᴜᴘᴘᴏʀᴛ. ʏᴏᴜ ᴄᴀɴɴᴏᴛ sᴇɴᴅ ᴀɴᴏᴛʜᴇʀ ᴍᴇssᴀɢᴇ ᴜɴᴛɪʟ ᴀɴ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ʀᴇsᴘᴏɴᴅs ᴛᴏ ʏᴏᴜ.\n\n` +
            `<i>sᴇɴᴅ /cancel ᴛᴏ ᴄᴀɴᴄᴇʟ ʏᴏᴜʀ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛ.</i>`, { parse_mode: 'HTML' });
        return true;
    }
    // Case B: User has active turn to send their 1 message (WAITING_USER_CONTACT)
    if (session.state === 'WAITING_USER_CONTACT') {
        const text = ctx.message?.text?.trim();
        if (text === '/cancel' || text === '/end') {
            await (0, Settings_js_1.clearAdminSession)(from.id);
            await ctx.reply(`❌ <b>sᴜᴘᴘᴏʀᴛ ᴄʜᴀᴛ ᴇɴᴅᴇᴅ</b>\n\n` +
                `ʏᴏᴜ ᴄᴀɴ sᴛᴀʀᴛ ᴀ ɴᴇᴡ ᴄʜᴀᴛ ᴀɴʏᴛɪᴍᴇ ʙʏ sᴇɴᴅɪɴɢ /contact.`, { parse_mode: 'HTML' });
            return true;
        }
        // Allow slash commands to exit contact mode
        if (text && text.startsWith('/') && text !== '/contact') {
            await (0, Settings_js_1.clearAdminSession)(from.id);
            return false;
        }
        // Check forwarded channel
        const forwardChat = ctx.message?.forward_origin;
        const forwardedChannel = forwardChat && forwardChat.type === 'channel' && forwardChat.chat
            ? { id: forwardChat.chat.id, title: forwardChat.chat.title || 'Channel' }
            : undefined;
        const content = text || ctx.message?.caption || (forwardedChannel ? `Forwarded from channel: ${forwardedChannel.title}` : 'Media Attachment');
        const catKey = session.data?.category || 'general';
        const category = exports.CONTACT_CATEGORIES[catKey] || exports.CONTACT_CATEGORIES.general;
        // Deliver to all admins with category badge
        await sendContactToAdmins(ctx, content, forwardedChannel, category);
        // LOCK USER: Change state to WAITING_ADMIN_RESPONSE so they can't send another message until admin replies!
        await (0, Settings_js_1.setAdminSession)(from.id, 'WAITING_ADMIN_RESPONSE', {
            chatId: ctx.chat?.id,
            category: category.id,
            categoryLabel: category.label,
            categoryTag: category.tag,
        });
        await ctx.reply(`📨 <b>ᴍᴇssᴀɢᴇ ᴅᴇʟɪᴠᴇʀᴇᴅ ᴛᴏ ᴀᴅᴍɪɴ!</b>\n\n` +
            `• <b>ᴛᴏᴘɪᴄ:</b> ${category.label}\n\n` +
            `ʏᴏᴜʀ ᴍᴇssᴀɢᴇ ʜᴀs ʙᴇᴇɴ ʀᴇᴄᴇɪᴠᴇᴅ ʙʏ ᴏᴜʀ sᴜᴘᴘᴏʀᴛ ᴛᴇᴀᴍ.\n` +
            `ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ ғᴏʀ ᴀɴ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ᴛᴏ ʀᴇᴘʟʏ — ʏᴏᴜ ᴡɪʟʟ ʙᴇ ᴀʙʟᴇ ᴛᴏ sᴇɴᴅ ᴀɴᴏᴛʜᴇʀ ᴍᴇssᴀɢᴇ ᴏɴᴄᴇ ᴛʜᴇʏ ʀᴇsᴘᴏɴᴅ.\n\n` +
            `<i>sᴇɴᴅ /cancel ᴛᴏ ᴄᴀɴᴄᴇʟ ʏᴏᴜʀ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛ.</i>`, { parse_mode: 'HTML' });
        return true;
    }
    return false;
}
/**
 * Sends a user's contact/support message to all configured Admins and the Log Channel
 */
async function sendContactToAdmins(ctx, messageContent, forwardedChannel, category) {
    const from = ctx.from;
    const usernameDisplay = from.username ? `@${from.username}` : '<i>ɴᴏɴᴇ</i>';
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let forwardInfo = '';
    if (forwardedChannel) {
        forwardInfo = `📢 <b>Forwarded Channel:</b> ${(0, html_js_1.escapeHtml)(forwardedChannel.title)} (<code>${forwardedChannel.id}</code>)\n`;
    }
    const catLabel = category?.label || '💬 General Inquiry';
    const catTag = category?.tag || '#GENERAL_INQUIRY';
    const adminText = `📬 <b>LIVE SUPPORT MESSAGE</b>  #UID:${from.id}\n` +
        `🏷️ <b>Category:</b> <b>${(0, html_js_1.escapeHtml)(catLabel)}</b>  <code>${catTag}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>From:</b> <a href="tg://user?id=${from.id}">${(0, html_js_1.escapeHtml)(from.first_name)}</a> (${usernameDisplay})\n` +
        `🆔 <b>User ID:</b> <code>${from.id}</code>\n` +
        (forwardInfo ? `${forwardInfo}` : '') +
        `🕒 <b>Time:</b> <code>${time} UTC</code>\n\n` +
        `💬 <b>Message Content:</b>\n` +
        `<blockquote>${(0, html_js_1.escapeHtml)(messageContent)}</blockquote>\n\n` +
        `💡 <i>Tip: Swipe/Reply directly to this message to send an instant reply through the bot!</i>`;
    const adminKb = new grammy_1.InlineKeyboard()
        .text('💬 ʀᴇᴘʟʏ', `contact_reply:${from.id}`)
        .text('❌ ᴄʟᴏsᴇ ᴄʜᴀᴛ', `contact_close:${from.id}`)
        .row()
        .url('👤 ᴏᴘᴇɴ ᴛᴇʟᴇɢʀᴀᴍ ᴘʀᴏғɪʟᴇ', `tg://user?id=${from.id}`);
    // Check if message has media to forward
    const hasMedia = !ctx.message?.text && (ctx.message?.photo ||
        ctx.message?.video ||
        ctx.message?.voice ||
        ctx.message?.audio ||
        ctx.message?.document ||
        ctx.message?.sticker);
    // 1. Deliver to all configured Admins
    const settings = await (0, Settings_js_1.getGlobalSettings)();
    const allAdmins = Array.from(new Set([...config_js_1.config.adminIds, ...(settings.admins || [])]));
    for (const adminId of allAdmins) {
        try {
            await ctx.api.sendMessage(adminId, adminText, {
                parse_mode: 'HTML',
                reply_markup: adminKb,
            });
            if (hasMedia && ctx.chat) {
                await ctx.api.copyMessage(adminId, ctx.chat.id, ctx.message.message_id);
            }
        }
        catch (e) {
            console.warn(`[Contact] Could not deliver request to admin ${adminId}:`, e);
        }
    }
    // 2. Deliver to Log Channel if set
    const logChannelId = await loggerService_js_1.LoggerService.getLogChannelId();
    if (logChannelId) {
        try {
            await ctx.api.sendMessage(logChannelId, adminText, {
                parse_mode: 'HTML',
                reply_markup: adminKb,
            });
            if (hasMedia && ctx.chat) {
                await ctx.api.copyMessage(logChannelId, ctx.chat.id, ctx.message.message_id);
            }
        }
        catch (e) {
            console.warn('[Contact] Could not deliver to log channel:', e);
        }
    }
}
/**
 * Handles Telegram's native "Reply" feature when an Admin replies directly to a support message
 */
async function handleAdminDirectReply(ctx) {
    const from = ctx.from;
    if (!from || !(await (0, admin_js_1.isAdmin)(from.id)))
        return false;
    const replyTo = ctx.message?.reply_to_message;
    if (!replyTo)
        return false;
    // Extract User ID from the replied-to message text or caption
    const combinedText = (replyTo.text || replyTo.caption || '');
    const match = combinedText.match(/(?:User ID:\s*<code>|#UID:)(\d+)/i);
    if (!match)
        return false;
    const targetUserId = parseInt(match[1], 10);
    if (isNaN(targetUserId))
        return false;
    const replyText = ctx.message?.text?.trim();
    // Retrieve user session to maintain category context
    const targetSession = await (0, Settings_js_1.getAdminSession)(targetUserId);
    const catKey = targetSession?.data?.category || 'general';
    const category = exports.CONTACT_CATEGORIES[catKey] || exports.CONTACT_CATEGORIES.general;
    try {
        if (replyText) {
            await ctx.api.sendMessage(targetUserId, `💬 <b>sᴜᴘᴘᴏʀᴛ ᴛᴇᴀᴍ:</b>\n\n` +
                `${(0, html_js_1.escapeHtml)(replyText)}\n\n` +
                `<i>💬 ʏᴏᴜ ᴄᴀɴ ɴᴏᴡ sᴇɴᴅ ᴏɴᴇ ʀᴇᴘʟʏ ʙᴇʟᴏᴡ, ᴏʀ sᴇɴᴅ /cancel ᴛᴏ ᴇɴᴅ.</i>`, { parse_mode: 'HTML' });
        }
        else {
            await ctx.api.sendMessage(targetUserId, `💬 <b>sᴜᴘᴘᴏʀᴛ ᴛᴇᴀᴍ (ᴀᴛᴛᴀᴄʜᴍᴇɴᴛ):</b>`, { parse_mode: 'HTML' });
            await ctx.copyMessage(targetUserId);
        }
        // UNLOCK USER FOR 1 TURN while preserving category
        await (0, Settings_js_1.setAdminSession)(targetUserId, 'WAITING_USER_CONTACT', {
            chatId: targetUserId,
            category: category.id,
            categoryLabel: category.label,
            categoryTag: category.tag,
        });
        await ctx.reply(`✅ <b>ʀᴇᴘʟʏ ᴅᴇʟɪᴠᴇʀᴇᴅ ᴛᴏ ᴜsᴇʀ</b> <code>${targetUserId}</code>`, {
            parse_mode: 'HTML',
        });
        return true;
    }
    catch (err) {
        console.error(`[Contact Reply] Failed to send reply to user ${targetUserId}:`, err);
        await ctx.reply(`❌ <b>ᴄᴏᴜʟᴅ ɴᴏᴛ ᴅᴇʟɪᴠᴇʀ ʀᴇᴘʟʏ:</b> ${(0, html_js_1.escapeHtml)(err?.message || 'User may have blocked the bot.')}`, { parse_mode: 'HTML' });
        return true;
    }
}
/**
 * Handles button callbacks for contact chat (categories, reply, close, user end)
 */
async function handleContactCallback(ctx) {
    const data = ctx.callbackQuery?.data;
    const from = ctx.from;
    if (!data || !from)
        return;
    // 1. User ended their own contact chat
    if (data === 'user_contact_end') {
        await (0, Settings_js_1.clearAdminSession)(from.id);
        await ctx.answerCallbackQuery({ text: 'Support chat closed.' });
        try {
            await ctx.editMessageText(`❌ <b>sᴜᴘᴘᴏʀᴛ ᴄʜᴀᴛ ᴇɴᴅᴇᴅ</b>\n\n` +
                `ʏᴏᴜ ᴄᴀɴ sᴛᴀʀᴛ ᴀ ɴᴇᴡ ᴄʜᴀᴛ ᴀɴʏᴛɪᴍᴇ ʙʏ sᴇɴᴅɪɴɢ /contact.`, { parse_mode: 'HTML' });
        }
        catch { }
        return;
    }
    // 2. User selects category
    if (data.startsWith('contact_cat:')) {
        const catKey = data.split(':')[1];
        const category = exports.CONTACT_CATEGORIES[catKey] || exports.CONTACT_CATEGORIES.general;
        const session = await (0, Settings_js_1.getAdminSession)(from.id);
        const pendingText = session?.data?.pendingText;
        // If user provided text with the command, dispatch immediately!
        if (pendingText) {
            await sendContactToAdmins(ctx, pendingText, undefined, category);
            await (0, Settings_js_1.setAdminSession)(from.id, 'WAITING_ADMIN_RESPONSE', {
                chatId: ctx.chat?.id,
                category: category.id,
                categoryLabel: category.label,
                categoryTag: category.tag,
            });
            await ctx.answerCallbackQuery({ text: `Category: ${category.label}` });
            const confirmText = `📨 <b>ᴍᴇssᴀɢᴇ ᴅᴇʟɪᴠᴇʀᴇᴅ ᴛᴏ ᴀᴅᴍɪɴ!</b>\n\n` +
                `• <b>ᴛᴏᴘɪᴄ:</b> ${category.label}\n\n` +
                `ʏᴏᴜʀ ᴍᴇssᴀɢᴇ ʜᴀs ʙᴇᴇɴ ʀᴇᴄᴇɪᴠᴇᴅ ʙʏ ᴏᴜʀ sᴜᴘᴘᴏʀᴛ ᴛᴇᴀᴍ.\n` +
                `ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ ғᴏʀ ᴀɴ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ᴛᴏ ʀᴇᴘʟʏ — ʏᴏᴜ ᴡɪʟʟ ʙᴇ ᴀʙʟᴇ ᴛᴏ sᴇɴᴅ ᴀɴᴏᴛʜᴇʀ ᴍᴇssᴀɢᴇ ᴏɴᴄᴇ ᴛʜᴇʏ ʀᴇsᴘᴏɴᴅ.\n\n` +
                `<i>sᴇɴᴅ /cancel ᴛᴏ ᴄᴀɴᴄᴇʟ ʏᴏᴜʀ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛ.</i>`;
            try {
                await ctx.editMessageText(confirmText, { parse_mode: 'HTML' });
            }
            catch {
                await ctx.reply(confirmText, { parse_mode: 'HTML' });
            }
            return;
        }
        // Otherwise show tailored instructions and grant 1 message turn
        await (0, Settings_js_1.setAdminSession)(from.id, 'WAITING_USER_CONTACT', {
            chatId: ctx.chat?.id,
            category: category.id,
            categoryLabel: category.label,
            categoryTag: category.tag,
        });
        await ctx.answerCallbackQuery({ text: `Selected: ${category.label}` });
        const cancelKb = new grammy_1.InlineKeyboard().text('❌ ᴇɴᴅ ᴄʜᴀᴛ', 'user_contact_end');
        try {
            await ctx.editMessageText(category.instructions, {
                parse_mode: 'HTML',
                reply_markup: cancelKb,
            });
        }
        catch {
            await ctx.reply(category.instructions, {
                parse_mode: 'HTML',
                reply_markup: cancelKb,
            });
        }
        return;
    }
    // 3. Admin initiates reply via button
    if (data.startsWith('contact_reply:')) {
        if (!(await (0, admin_js_1.isAdmin)(from.id))) {
            await ctx.answerCallbackQuery({ text: 'Access denied.' });
            return;
        }
        const targetUserId = parseInt(data.split(':')[1], 10);
        await (0, Settings_js_1.setAdminSession)(from.id, 'WAITING_ADMIN_CONTACT_REPLY', {
            targetUserId,
            promptMessageId: ctx.callbackQuery.message?.message_id,
            chatId: ctx.chat?.id,
        });
        await ctx.answerCallbackQuery();
        await ctx.reply(`✍️ <b>ʀᴇᴘʟʏɪɴɢ ᴛᴏ ᴜsᴇʀ</b> <code>${targetUserId}</code>\n\n` +
            `ᴘʟᴇᴀsᴇ sᴇɴᴅ ʏᴏᴜʀ ʀᴇsᴘᴏɴsᴇ (ᴛᴇxᴛ ᴏʀ ᴍᴇᴅɪᴀ) ʙᴇʟᴏᴡ.\n` +
            `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ.</i>`, { parse_mode: 'HTML' });
        return;
    }
    // 4. Admin ends/closes contact session
    if (data.startsWith('contact_close:')) {
        if (!(await (0, admin_js_1.isAdmin)(from.id))) {
            await ctx.answerCallbackQuery({ text: 'Access denied.' });
            return;
        }
        const targetUserId = parseInt(data.split(':')[1], 10);
        // Remove user's lock/session completely so they can open a new request later
        await (0, Settings_js_1.clearAdminSession)(targetUserId);
        try {
            await ctx.api.sendMessage(targetUserId, `🔒 <b>sᴜᴘᴘᴏʀᴛ sᴇssɪᴏɴ ᴄʟᴏsᴇᴅ</b>\n\n` +
                `ᴛʜᴇ sᴜᴘᴘᴏʀᴛ ᴛᴇᴀᴍ ʜᴀs ʀᴇsᴏʟᴠᴇᴅ ᴀɴᴅ ᴄʟᴏsᴇᴅ ᴛʜɪs sᴜᴘᴘᴏʀᴛ ᴄʜᴀᴛ.\n` +
                `ɪғ ʏᴏᴜ ɴᴇᴇᴅ ᴀɴʏᴛʜɪɴɢ ᴇʟsᴇ, ғᴇᴇʟ ғʀᴇᴇ ᴛᴏ sᴇɴᴅ /contact ᴀɴʏᴛɪᴍᴇ!`, { parse_mode: 'HTML' });
        }
        catch { }
        await ctx.answerCallbackQuery({ text: `Chat closed for User ${targetUserId}.` });
        try {
            await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        }
        catch { }
        await ctx.reply(`🔒 <b>sᴜᴘᴘᴏʀᴛ ᴄʜᴀᴛ ᴄʟᴏsᴇᴅ ғᴏʀ ᴜsᴇʀ</b> <code>${targetUserId}</code>`, {
            parse_mode: 'HTML',
        });
        return;
    }
}
/**
 * Handles admin input when replying via the button prompt (WAITING_ADMIN_CONTACT_REPLY)
 */
async function handleAdminContactReplyInput(ctx) {
    const from = ctx.from;
    if (!from)
        return false;
    const session = await (0, Settings_js_1.getAdminSession)(from.id);
    if (!session || session.state !== 'WAITING_ADMIN_CONTACT_REPLY') {
        return false;
    }
    const targetUserId = session.data?.targetUserId;
    const text = ctx.message?.text?.trim();
    if (text === '/cancel') {
        await (0, Settings_js_1.clearAdminSession)(from.id);
        await ctx.reply('❌ <b>ʀᴇᴘʟʏ ᴄᴀɴᴄᴇʟʟᴇᴅ</b>', { parse_mode: 'HTML' });
        return true;
    }
    if (!targetUserId) {
        await (0, Settings_js_1.clearAdminSession)(from.id);
        return false;
    }
    await (0, Settings_js_1.clearAdminSession)(from.id);
    // Retrieve user category to keep context
    const targetSession = await (0, Settings_js_1.getAdminSession)(targetUserId);
    const catKey = targetSession?.data?.category || 'general';
    const category = exports.CONTACT_CATEGORIES[catKey] || exports.CONTACT_CATEGORIES.general;
    try {
        if (text) {
            await ctx.api.sendMessage(targetUserId, `💬 <b>sᴜᴘᴘᴏʀᴛ ᴛᴇᴀᴍ:</b>\n\n` +
                `${(0, html_js_1.escapeHtml)(text)}\n\n` +
                `<i>💬 ʏᴏᴜ ᴄᴀɴ ɴᴏᴡ sᴇɴᴅ ᴏɴᴇ ʀᴇᴘʟʏ ʙᴇʟᴏᴡ, ᴏʀ sᴇɴᴅ /cancel ᴛᴏ ᴇɴᴅ.</i>`, { parse_mode: 'HTML' });
        }
        else {
            await ctx.api.sendMessage(targetUserId, `💬 <b>sᴜᴘᴘᴏʀᴛ ᴛᴇᴀᴍ (ᴀᴛᴛᴀᴄʜᴍᴇɴᴛ):</b>`, { parse_mode: 'HTML' });
            await ctx.copyMessage(targetUserId);
        }
        // UNLOCK USER FOR 1 TURN while preserving category
        await (0, Settings_js_1.setAdminSession)(targetUserId, 'WAITING_USER_CONTACT', {
            chatId: targetUserId,
            category: category.id,
            categoryLabel: category.label,
            categoryTag: category.tag,
        });
        await ctx.reply(`✅ <b>ʀᴇᴘʟʏ sᴜᴄᴄᴇssғᴜʟʟʏ ᴅᴇʟɪᴠᴇʀᴇᴅ ᴛᴏ ᴜsᴇʀ</b> <code>${targetUserId}</code>`, {
            parse_mode: 'HTML',
        });
        return true;
    }
    catch (err) {
        console.error(`[Contact Reply] Error sending to user ${targetUserId}:`, err);
        await ctx.reply(`❌ <b>ᴄᴏᴜʟᴅ ɴᴏᴛ ᴅᴇʟɪᴠᴇʀ:</b> ${(0, html_js_1.escapeHtml)(err?.message || 'User may have blocked the bot.')}`, { parse_mode: 'HTML' });
        return true;
    }
}
/**
 * Handles admin /reply command: /reply <user_id> <message>
 */
async function handleReplyCommand(ctx) {
    const from = ctx.from;
    if (!from || !(await (0, admin_js_1.isAdmin)(from.id))) {
        await ctx.reply('⛔ <b>ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ</b>', { parse_mode: 'HTML' });
        return;
    }
    const rawMatch = ctx.match;
    if (!rawMatch || !rawMatch.trim()) {
        await ctx.reply(`💡 <b>ᴜsᴀɢᴇ:</b> <code>/reply &lt;user_id&gt; &lt;your message&gt;</code>\n\n` +
            `<b>ᴇxᴀᴍᴘʟᴇ:</b>\n<code>/reply 123456789 Hello, your channel has been approved!</code>`, { parse_mode: 'HTML' });
        return;
    }
    const parts = rawMatch.trim().split(/\s+/);
    const targetUserId = parseInt(parts[0], 10);
    const messageText = parts.slice(1).join(' ').trim();
    if (isNaN(targetUserId) || !messageText) {
        await ctx.reply(`⚠️ <b>ɪɴᴠᴀʟɪᴅ ғᴏʀᴍᴀᴛ.</b>\n` +
            `ᴜsᴀɢᴇ: <code>/reply &lt;user_id&gt; &lt;your message&gt;</code>`, { parse_mode: 'HTML' });
        return;
    }
    const targetSession = await (0, Settings_js_1.getAdminSession)(targetUserId);
    const catKey = targetSession?.data?.category || 'general';
    const category = exports.CONTACT_CATEGORIES[catKey] || exports.CONTACT_CATEGORIES.general;
    try {
        await ctx.api.sendMessage(targetUserId, `💬 <b>sᴜᴘᴘᴏʀᴛ ᴛᴇᴀᴍ:</b>\n\n` +
            `${(0, html_js_1.escapeHtml)(messageText)}\n\n` +
            `<i>💬 ʏᴏᴜ ᴄᴀɴ ɴᴏᴡ sᴇɴᴅ ᴏɴᴇ ʀᴇᴘʟʏ ʙᴇʟᴏᴡ, ᴏʀ sᴇɴᴅ /cancel ᴛᴏ ᴇɴᴅ.</i>`, { parse_mode: 'HTML' });
        // UNLOCK USER FOR 1 TURN while preserving category
        await (0, Settings_js_1.setAdminSession)(targetUserId, 'WAITING_USER_CONTACT', {
            chatId: targetUserId,
            category: category.id,
            categoryLabel: category.label,
            categoryTag: category.tag,
        });
        await ctx.reply(`✅ <b>ʀᴇᴘʟʏ ᴅᴇʟɪᴠᴇʀᴇᴅ ᴛᴏ ᴜsᴇʀ</b> <code>${targetUserId}</code>`, { parse_mode: 'HTML' });
    }
    catch (err) {
        await ctx.reply(`❌ <b>ғᴀɪʟᴇᴅ ᴛᴏ ᴅᴇʟɪᴠᴇʀ:</b> ${(0, html_js_1.escapeHtml)(err?.message || 'User may have blocked the bot.')}`, { parse_mode: 'HTML' });
    }
}
