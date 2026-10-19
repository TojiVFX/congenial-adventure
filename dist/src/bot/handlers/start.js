"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStart = handleStart;
exports.renderStartMenu = renderStartMenu;
exports.handleHelp = handleHelp;
const grammy_1 = require("grammy");
const User_js_1 = require("../../db/models/User.js");
const linkService_js_1 = require("../services/linkService.js");
const loggerService_js_1 = require("../services/loggerService.js");
const channelService_js_1 = require("../services/channelService.js");
const html_js_1 = require("../utils/html.js");
async function handleStart(ctx) {
    const from = ctx.from;
    if (!from)
        return;
    const payload = ctx.match;
    const cleanPayload = payload?.trim() || undefined;
    let isNewUser = false;
    // 1. Record or update user in database
    try {
        const existingUser = await User_js_1.User.findOne({ userId: from.id });
        if (!existingUser) {
            isNewUser = true;
            await User_js_1.User.create({
                userId: from.id,
                firstName: from.first_name,
                lastName: from.last_name,
                username: from.username,
                sourcePayload: cleanPayload,
                totalStarts: 1,
                lastActiveAt: new Date(),
            });
        }
        else {
            isNewUser = false;
            existingUser.firstName = from.first_name;
            existingUser.lastName = from.last_name;
            existingUser.username = from.username;
            existingUser.totalStarts = (existingUser.totalStarts || 1) + 1;
            existingUser.lastActiveAt = new Date();
            if (cleanPayload && !existingUser.sourcePayload) {
                existingUser.sourcePayload = cleanPayload;
            }
            await existingUser.save();
        }
    }
    catch (err) {
        console.error('[handleStart] Failed to record user:', err);
    }
    // 2. Notify Log Channel ONLY for genuinely NEW users who started the bot for the first time
    if (isNewUser) {
        try {
            ctx.api && (await loggerService_js_1.LoggerService.logUserStart(ctx, {
                id: from.id,
                firstName: from.first_name,
                username: from.username,
            }, cleanPayload));
        }
        catch (logErr) {
            console.warn('[handleStart] Failed to log new user start:', logErr);
        }
    }
    // 3. If no payload, send appropriate bot greeting with instant action buttons
    if (!cleanPayload) {
        const { text, keyboard } = renderStartMenu(from.first_name, isNewUser);
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        return;
    }
    // 4. Resolve Channel from Deep-Link Payload (e.g. inv_bcibiv)
    const channel = await linkService_js_1.LinkService.resolveChannelFromPayload(cleanPayload);
    if (!channel) {
        await ctx.reply(`⚠️ <b>Invalid or Expired Link</b>\n\nThe invitation link you followed is no longer active. Please request a new link from the channel administrator.`, { parse_mode: 'HTML' });
        return;
    }
    // 5. Check if user is already a member
    const isMember = await channelService_js_1.ChannelService.isUserMember(ctx, channel.channelId, from.id);
    if (isMember) {
        const normalLink = channel.normalLink || (channel.username ? `https://t.me/${channel.username.replace(/^@/, '')}` : undefined);
        const openKb = new grammy_1.InlineKeyboard();
        if (normalLink) {
            openKb.url('📢 ᴏᴘᴇɴ ᴄʜᴀɴɴᴇʟ', normalLink).primary();
        }
        await ctx.reply(`✅ <b>Already a Member</b>\n\nYou are already a member of <b>${(0, html_js_1.escapeHtml)(channel.title)}</b>.\nFeel free to open the channel anytime.`, {
            parse_mode: 'HTML',
            ...(normalLink ? { reply_markup: openKb } : {}),
        });
        return;
    }
    // 6. Generate a personal join-request link for THIS user that expires in 10 minutes
    let userLink;
    try {
        const result = await linkService_js_1.LinkService.getOrCreateUserInviteLink(ctx, channel.channelId, from.id);
        userLink = result.link;
    }
    catch (err) {
        console.error('[handleStart] Failed to create personal invite link:', err);
        await ctx.reply(`⚠️ <b>Could not create your invite link.</b>\n\nPlease try again in a moment or contact the channel administrator.`, { parse_mode: 'HTML' });
        return;
    }
    const keyboard = new grammy_1.InlineKeyboard()
        .url('🚀 ʀᴇǫᴜᴇsᴛ ᴛᴏ ᴊᴏɪɴ ᴄʜᴀɴɴᴇʟ', userLink)
        .primary()
        .row();
    const greeting = channel.welcomeMessage
        ? `${channel.welcomeMessage}\n\n`
        : `ᴛᴀᴘ ᴛʜᴇ ʙᴜᴛᴛᴏɴ ʙᴇʟᴏᴡ ᴛᴏ sᴜʙᴍɪᴛ ʏᴏᴜʀ ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛ. ʏᴏᴜ ᴡɪʟʟ ʙᴇ ᴀᴘᴘʀᴏᴠᴇᴅ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ!\n\n`;
    const replyText = `✨ <b>ᴄʜᴀɴɴᴇʟ ɪɴᴠɪᴛᴀᴛɪᴏɴ</b>\n\n` +
        `ʏᴏᴜ ʜᴀᴠᴇ ʙᴇᴇɴ ɪɴᴠɪᴛᴇᴅ ᴛᴏ ᴊᴏɪɴ <b>${(0, html_js_1.escapeHtml)(channel.title)}</b>.\n\n` +
        `${greeting}` +
        `⏳ <i>This personal link is valid for ${linkService_js_1.USER_LINK_TTL_MINUTES} minutes and works only for you.</i>`;
    await ctx.reply(replyText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
    });
}
/**
 * Renders the primary Start menu with instant submission, Profile, and About buttons
 */
function renderStartMenu(firstName, isNewUser = false) {
    const greetingHeader = isNewUser
        ? `👋 <b>ᴡᴇʟᴄᴏᴍᴇ, ${(0, html_js_1.escapeHtml)(firstName)}!</b>`
        : `👋 <b>ᴡᴇʟᴄᴏᴍᴇ ʙᴀᴄᴋ, ${(0, html_js_1.escapeHtml)(firstName)}!</b>`;
    const subHeader = isNewUser
        ? `ᴛʜɪs ʙᴏᴛ ᴘʀᴏᴠɪᴅᴇs ᴀᴜᴛᴏᴍᴀᴛᴇᴅ, ɪɴsᴛᴀɴᴛ ᴍᴇᴍʙᴇʀsʜɪᴘ ᴠᴇʀɪғɪᴄᴀᴛɪᴏɴ ғᴏʀ ᴘʀɪᴠᴀᴛᴇ ᴄᴏᴍᴍᴜɴɪᴛɪᴇs.`
        : `ʏᴏᴜ ᴀʀᴇ ᴀʟʀᴇᴀᴅʏ ᴄᴏɴɴᴇᴄᴛᴇᴅ ᴛᴏ ᴛʜᴇ ᴠᴇʀɪғɪᴄᴀᴛɪᴏɴ sʏsᴛᴇᴍ.`;
    const text = `${greetingHeader}\n\n` +
        `⚡ <b>ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴀʟ ɢᴀᴛᴇᴡᴀʏ</b>\n` +
        `${subHeader}\n\n` +
        `• <b>sᴜʙᴍɪᴛ ʀᴇǫᴜᴇsᴛ:</b> ᴛᴀᴘ <b>➕ sᴜʙᴍɪᴛ ʀᴇǫᴜᴇsᴛ</b> ᴛᴏ ᴄᴏɴɴᴇᴄᴛ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ɪɴsᴛᴀɴᴛʟʏ.\n` +
        `• <b>ᴍᴀɴᴀɢᴇ ᴄʜᴀɴɴᴇʟs:</b> ᴛᴀᴘ <b>⚙️ ᴍʏ ᴄʜᴀɴɴᴇʟs</b> ᴏʀ sᴇɴᴅ /managechat.\n` +
        `• <b>ʏᴏᴜʀ ᴀᴄᴄᴏᴜɴᴛ:</b> ᴛᴀᴘ <b>👤 ᴍʏ ᴘʀᴏғɪʟᴇ</b> ᴛᴏ ᴠɪᴇᴡ ʏᴏᴜʀ sᴛᴀᴛs & ɪɴғᴏ.\n` +
        `• <b>ɴᴇᴇᴅ ᴀssɪsᴛᴀɴᴄᴇ?</b> sᴇɴᴅ /contact ᴏʀ ᴛᴀᴘ <b>📩 ᴄᴏɴᴛᴀᴄᴛ ᴀᴅᴍɪɴ</b>.`;
    const keyboard = new grammy_1.InlineKeyboard()
        .text('➕ sᴜʙᴍɪᴛ ʀᴇǫᴜᴇsᴛ', 'user_chan_add')
        .primary()
        .text('⚙️ ᴍʏ ᴄʜᴀɴɴᴇʟs', 'user_chan_list')
        .row()
        .text('👤 ᴍʏ ᴘʀᴏғɪʟᴇ', 'user_chan_profile')
        .text('ℹ️ ᴀʙᴏᴜᴛ', 'user_chan_about')
        .row()
        .text('📩 ᴄᴏɴᴛᴀᴄᴛ ᴀᴅᴍɪɴ', 'user_chan_contact');
    return { text, keyboard };
}
async function handleHelp(ctx) {
    const text = `💡 <b>ʜᴏᴡ ᴛᴏ ᴜsᴇ ᴛʜɪs ʙᴏᴛ</b>\n\n` +
        `• <b>ᴊᴏɪɴɪɴɢ ᴀ ᴄᴏᴍᴍᴜɴɪᴛʏ:</b>\n` +
        `  1. ᴄʟɪᴄᴋ ᴛʜᴇ sʜᴏʀᴛ ɪɴᴠɪᴛᴇ ʟɪɴᴋ ғᴏʀ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ.\n` +
        `  2. ᴛᴀᴘ <b>ʀᴇǫᴜᴇsᴛ ᴛᴏ ᴊᴏɪɴ ᴄʜᴀɴɴᴇʟ</b> (ʏᴏᴜʀ ᴘᴇʀsᴏɴᴀʟ ʟɪɴᴋ ʟᴀsᴛs 10 ᴍɪɴᴜᴛᴇs).\n` +
        `  3. ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ ᴡɪʟʟ ʙᴇ ᴠᴇʀɪғɪᴇᴅ ᴀɴᴅ ᴀᴘᴘʀᴏᴠᴇᴅ ɪɴsᴛᴀɴᴛʟʏ!\n\n` +
        `• <b>ᴄᴏɴɴᴇᴄᴛɪɴɢ ʏᴏᴜʀ ᴏᴡɴ ᴄʜᴀɴɴᴇʟ:</b>\n` +
        `  1. sᴇɴᴅ /managechat ᴛᴏ ᴏᴘᴇɴ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴅᴀsʜʙᴏᴀʀᴅ.\n` +
        `  2. ᴛᴀᴘ <b>➕ ᴀᴅᴅ ɴᴇᴡ ᴄʜᴀɴɴᴇʟ</b> ᴀɴᴅ ᴀᴅᴅ ᴛʜᴇ ʙᴏᴛ ᴀs ᴀɴ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ.\n` +
        `  3. ᴏɴᴄᴇ ᴀᴘᴘʀᴏᴠᴇᴅ ʙʏ ᴀᴅᴍɪɴs, ʏᴏᴜ ɢᴇᴛ ʏᴏᴜʀ sʜᴏʀᴛ ʟɪɴᴋ & ᴄᴏɴᴛʀᴏʟs!\n\n` +
        `• <b>ɴᴇᴇᴅ ʜᴇʟᴘ ᴏʀ sᴜᴘᴘᴏʀᴛ?</b>\n` +
        `  sᴇɴᴅ /contact ᴛᴏ ᴍᴇssᴀɢᴇ ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ᴅɪʀᴇᴄᴛʟʏ.`;
    await ctx.reply(text, { parse_mode: 'HTML' });
}
