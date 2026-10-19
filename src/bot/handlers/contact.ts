import { Context, InlineKeyboard } from 'grammy';
import { config } from '../../config.js';
import {
  getGlobalSettings,
  setAdminSession,
  getAdminSession,
  clearAdminSession,
} from '../../db/models/Settings.js';
import { LoggerService } from '../services/loggerService.js';
import { escapeHtml } from '../utils/html.js';
import { isAdmin } from './admin.js';

/**
 * Entry point for /contact, /support, /request
 */
export async function handleContactCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const match = ctx.match as string | undefined;

  // If user provided a message directly with the command: e.g. /contact I need help
  if (match && match.trim().length > 0) {
    await setAdminSession(from.id, 'WAITING_USER_CONTACT', {
      chatId: ctx.chat?.id,
    });
    await sendContactToAdmins(ctx, match.trim());
    await ctx.reply(
      `💬 <b>sᴜᴘᴘᴏʀᴛ ᴄʜᴀᴛ ᴏᴘᴇɴᴇᴅ!</b>\n\n` +
      `ʏᴏᴜʀ ᴍᴇssᴀɢᴇ ʜᴀs ʙᴇᴇɴ ᴅᴇʟɪᴠᴇʀᴇᴅ ᴛᴏ ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛɪᴏɴ ᴛᴇᴀᴍ.\n` +
      `ᴀɴʏ ʀᴇᴘʟɪᴇs ғʀᴏᴍ ᴛʜᴇ ᴀᴅᴍɪɴ ᴡɪʟʟ ᴀʀʀɪᴠᴇ ᴅɪʀᴇᴄᴛʟʏ ɪɴ ᴛʜɪs ᴄʜᴀᴛ.\n\n` +
      `<i>ʏᴏᴜ ᴄᴀɴ ᴄᴏɴᴛɪɴᴜᴇ sᴇɴᴅɪɴɢ ᴍᴇssᴀɢᴇs ᴏʀ ᴍᴇᴅɪᴀ ʙᴇʟᴏᴡ. sᴇɴᴅ /cancel ᴛᴏ ᴇɴᴅ.</i>`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Otherwise, set session and prompt user for details
  const promptText =
    `💬 <b>ʟɪᴠᴇ sᴜᴘᴘᴏʀᴛ | ᴄᴏɴᴛᴀᴄᴛ ᴀᴅᴍɪɴ</b>\n\n` +
    `ʏᴏᴜ ᴀʀᴇ ɴᴏᴡ ᴄᴏɴɴᴇᴄᴛᴇᴅ ᴛᴏ ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ sᴜᴘᴘᴏʀᴛ ᴄʜᴀᴛ!\n` +
    `sᴇɴᴅ ʏᴏᴜʀ <b>ᴍᴇssᴀɢᴇ, ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ, ᴏʀ ᴍᴇᴅɪᴀ</b> (ᴘʜᴏᴛᴏs, ᴠᴏɪᴄᴇ ɴᴏᴛᴇs, ғᴏʀᴡᴀʀᴅs) ʙᴇʟᴏᴡ.\n\n` +
    `<i>ᴛʏᴘᴇ /cancel ᴏʀ ᴛᴀᴘ ᴛʜᴇ ʙᴜᴛᴛᴏɴ ʙᴇʟᴏᴡ ᴛᴏ ᴇxɪᴛ ᴀᴛ ᴀɴʏ ᴛɪᴍᴇ.</i>`;

  const cancelKb = new InlineKeyboard().text('❌ ᴇɴᴅ ᴄʜᴀᴛ', 'user_contact_end');

  let promptMessageId: number;
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(promptText, { parse_mode: 'HTML', reply_markup: cancelKb });
      promptMessageId = ctx.callbackQuery.message?.message_id || 0;
    } catch {
      const promptMsg = await ctx.reply(promptText, { parse_mode: 'HTML', reply_markup: cancelKb });
      promptMessageId = promptMsg.message_id;
    }
  } else {
    const promptMsg = await ctx.reply(promptText, { parse_mode: 'HTML', reply_markup: cancelKb });
    promptMessageId = promptMsg.message_id;
  }

  await setAdminSession(from.id, 'WAITING_USER_CONTACT', {
    promptMessageId,
    chatId: ctx.chat?.id,
  });
}

/**
 * Handles incoming messages from users currently in WAITING_USER_CONTACT session
 */
export async function handleContactMessage(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const session = await getAdminSession(from.id);
  if (!session || session.state !== 'WAITING_USER_CONTACT') {
    return false;
  }

  const text = ctx.message?.text?.trim();

  // Cancel / End chat
  if (text === '/cancel' || text === '/end') {
    await clearAdminSession(from.id);
    await ctx.reply(
      `❌ <b>sᴜᴘᴘᴏʀᴛ ᴄʜᴀᴛ ᴇɴᴅᴇᴅ</b>\n\n` +
      `ʏᴏᴜ ᴄᴀɴ sᴛᴀʀᴛ ᴀ ɴᴇᴡ ᴄʜᴀᴛ ᴀɴʏᴛɪᴍᴇ ʙʏ sᴇɴᴅɪɴɢ /contact.`,
      { parse_mode: 'HTML' }
    );
    return true;
  }

  // Let other slash commands (like /start, /help, /dashboard) break out of contact mode
  if (text && text.startsWith('/') && text !== '/contact') {
    await clearAdminSession(from.id);
    return false;
  }

  // Inspect if forwarded from channel
  const forwardChat = ctx.message?.forward_origin;
  const forwardedChannel =
    forwardChat && forwardChat.type === 'channel' && forwardChat.chat
      ? { id: forwardChat.chat.id, title: forwardChat.chat.title || 'Channel' }
      : undefined;

  const content = text || ctx.message?.caption || (forwardedChannel ? `Forwarded from channel: ${forwardedChannel.title}` : 'Media Attachment');

  // Relay to admins
  await sendContactToAdmins(ctx, content, forwardedChannel);

  // Send acknowledgement to user (session stays active so they can keep typing)
  await ctx.reply(
    `📨 <b>ᴍᴇssᴀɢᴇ ᴅᴇʟɪᴠᴇʀᴇᴅ ᴛᴏ ᴀᴅᴍɪɴ!</b>\n` +
    `<i>ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ ғᴏʀ ᴀ ʀᴇᴘʟʏ. ʏᴏᴜ ᴄᴀɴ sᴇɴᴅ ᴍᴏʀᴇ ᴍᴇssᴀɢᴇs ᴏʀ ᴛʏᴘᴇ /cancel ᴛᴏ ᴇɴᴅ.</i>`,
    { parse_mode: 'HTML' }
  );

  return true;
}

/**
 * Sends a user's contact/support message to all configured Admins and the Log Channel
 */
async function sendContactToAdmins(
  ctx: Context,
  messageContent: string,
  forwardedChannel?: { id: number; title: string }
): Promise<void> {
  const from = ctx.from!;
  const usernameDisplay = from.username ? `@${from.username}` : '<i>ɴᴏɴᴇ</i>';
  const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

  let forwardInfo = '';
  if (forwardedChannel) {
    forwardInfo = `📢 <b>Forwarded Channel:</b> ${escapeHtml(forwardedChannel.title)} (<code>${forwardedChannel.id}</code>)\n`;
  }

  const adminText =
    `📬 <b>LIVE SUPPORT MESSAGE</b>  #UID:${from.id}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>From:</b> <a href="tg://user?id=${from.id}">${escapeHtml(from.first_name)}</a> (${usernameDisplay})\n` +
    `🆔 <b>User ID:</b> <code>${from.id}</code>\n` +
    (forwardInfo ? `${forwardInfo}` : '') +
    `🕒 <b>Time:</b> <code>${time} UTC</code>\n\n` +
    `💬 <b>Message Content:</b>\n` +
    `<blockquote>${escapeHtml(messageContent)}</blockquote>\n\n` +
    `💡 <i>Tip: Swipe/Reply directly to this message to send an instant reply through the bot!</i>`;

  const adminKb = new InlineKeyboard()
    .text('💬 ʀᴇᴘʟʏ', `contact_reply:${from.id}`)
    .text('❌ ᴄʟᴏsᴇ ᴄʜᴀᴛ', `contact_close:${from.id}`)
    .row()
    .url('👤 ᴏᴘᴇɴ ᴛᴇʟᴇɢʀᴀᴍ ᴘʀᴏғɪʟᴇ', `tg://user?id=${from.id}`);

  // Check if message has media to forward
  const hasMedia = !ctx.message?.text && (
    ctx.message?.photo ||
    ctx.message?.video ||
    ctx.message?.voice ||
    ctx.message?.audio ||
    ctx.message?.document ||
    ctx.message?.sticker
  );

  // 1. Deliver to all configured Admins
  const settings = await getGlobalSettings();
  const allAdmins = Array.from(new Set([...config.adminIds, ...(settings.admins || [])]));

  for (const adminId of allAdmins) {
    try {
      await ctx.api.sendMessage(adminId, adminText, {
        parse_mode: 'HTML',
        reply_markup: adminKb,
      });

      if (hasMedia && ctx.chat) {
        await ctx.api.copyMessage(adminId, ctx.chat.id, ctx.message!.message_id);
      }
    } catch (e) {
      console.warn(`[Contact] Could not deliver request to admin ${adminId}:`, e);
    }
  }

  // 2. Deliver to Log Channel if set
  const logChannelId = await LoggerService.getLogChannelId();
  if (logChannelId) {
    try {
      await ctx.api.sendMessage(logChannelId, adminText, {
        parse_mode: 'HTML',
        reply_markup: adminKb,
      });
      if (hasMedia && ctx.chat) {
        await ctx.api.copyMessage(logChannelId, ctx.chat.id, ctx.message!.message_id);
      }
    } catch (e) {
      console.warn('[Contact] Could not deliver to log channel:', e);
    }
  }
}

/**
 * Handles Telegram's native "Reply" feature when an Admin replies directly to a support message
 */
export async function handleAdminDirectReply(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from || !(await isAdmin(from.id))) return false;

  const replyTo = ctx.message?.reply_to_message;
  if (!replyTo) return false;

  // Extract User ID from the replied-to message text or caption
  const combinedText = (replyTo.text || replyTo.caption || '');
  const match = combinedText.match(/(?:User ID:\s*<code>|#UID:)(\d+)/i);
  if (!match) return false;

  const targetUserId = parseInt(match[1], 10);
  if (isNaN(targetUserId)) return false;

  const replyText = ctx.message?.text?.trim();

  try {
    if (replyText) {
      await ctx.api.sendMessage(
        targetUserId,
        `👨‍💼 <b>sᴜᴘᴘᴏʀᴛ ʀᴇsᴘᴏɴsᴇ:</b>\n\n` +
        `${escapeHtml(replyText)}\n\n` +
        `<i>💬 ʏᴏᴜ ᴄᴀɴ ʀᴇᴘʟʏ ᴅɪʀᴇᴄᴛʟʏ ʙᴇʟᴏᴡ ᴛᴏ ᴄᴏɴᴛɪɴᴜᴇ ᴛʜɪs ᴄʜᴀᴛ, ᴏʀ sᴇɴᴅ /cancel ᴛᴏ ᴇɴᴅ.</i>`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.api.sendMessage(
        targetUserId,
        `👨‍💼 <b>sᴜᴘᴘᴏʀᴛ ʀᴇsᴘᴏɴsᴇ (ᴀᴛᴛᴀᴄʜᴍᴇɴᴛ):</b>`,
        { parse_mode: 'HTML' }
      );
      await ctx.copyMessage(targetUserId);
    }

    // Keep user's contact session active so their next reply routes back to admin
    await setAdminSession(targetUserId, 'WAITING_USER_CONTACT', {
      chatId: targetUserId,
    });

    await ctx.reply(`✅ <b>ʀᴇᴘʟʏ ᴅᴇʟɪᴠᴇʀᴇᴅ ᴛᴏ ᴜsᴇʀ</b> <code>${targetUserId}</code>`, {
      parse_mode: 'HTML',
    });
    return true;
  } catch (err: any) {
    console.error(`[Contact Reply] Failed to send reply to user ${targetUserId}:`, err);
    await ctx.reply(
      `❌ <b>ᴄᴏᴜʟᴅ ɴᴏᴛ ᴅᴇʟɪᴠᴇʀ ʀᴇᴘʟʏ:</b> ${escapeHtml(err?.message || 'User may have blocked the bot.')}`,
      { parse_mode: 'HTML' }
    );
    return true;
  }
}

/**
 * Handles button callbacks for contact chat (reply, close, user end)
 */
export async function handleContactCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const from = ctx.from;
  if (!data || !from) return;

  // 1. User ended their own contact chat
  if (data === 'user_contact_end') {
    await clearAdminSession(from.id);
    await ctx.answerCallbackQuery({ text: 'Support chat closed.' });
    try {
      await ctx.editMessageText(
        `❌ <b>sᴜᴘᴘᴏʀᴛ ᴄʜᴀᴛ ᴇɴᴅᴇᴅ</b>\n\n` +
        `ʏᴏᴜ ᴄᴀɴ sᴛᴀʀᴛ ᴀ ɴᴇᴡ ᴄʜᴀᴛ ᴀɴʏᴛɪᴍᴇ ʙʏ sᴇɴᴅɪɴɢ /contact.`,
        { parse_mode: 'HTML' }
      );
    } catch {}
    return;
  }

  // 2. Admin initiates reply via button
  if (data.startsWith('contact_reply:')) {
    if (!(await isAdmin(from.id))) {
      await ctx.answerCallbackQuery({ text: 'Access denied.' });
      return;
    }

    const targetUserId = parseInt(data.split(':')[1], 10);
    await setAdminSession(from.id, 'WAITING_ADMIN_CONTACT_REPLY', {
      targetUserId,
      promptMessageId: ctx.callbackQuery.message?.message_id,
      chatId: ctx.chat?.id,
    });

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `✍️ <b>ʀᴇᴘʟʏɪɴɢ ᴛᴏ ᴜsᴇʀ</b> <code>${targetUserId}</code>\n\n` +
      `ᴘʟᴇᴀsᴇ sᴇɴᴅ ʏᴏᴜʀ ʀᴇsᴘᴏɴsᴇ (ᴛᴇxᴛ ᴏʀ ᴍᴇᴅɪᴀ) ʙᴇʟᴏᴡ.\n` +
      `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ.</i>`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 3. Admin ends/closes contact session
  if (data.startsWith('contact_close:')) {
    if (!(await isAdmin(from.id))) {
      await ctx.answerCallbackQuery({ text: 'Access denied.' });
      return;
    }

    const targetUserId = parseInt(data.split(':')[1], 10);
    await clearAdminSession(targetUserId);

    try {
      await ctx.api.sendMessage(
        targetUserId,
        `🔒 <b>sᴜᴘᴘᴏʀᴛ sᴇssɪᴏɴ ᴄʟᴏsᴇᴅ</b>\n\n` +
        `ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ʜᴀs ʀᴇsᴏʟᴠᴇᴅ ᴀɴᴅ ᴄʟᴏsᴇᴅ ᴛʜɪs sᴜᴘᴘᴏʀᴛ ᴄʜᴀᴛ.\n` +
        `ɪғ ʏᴏᴜ ɴᴇᴇᴅ ᴀɴʏᴛʜɪɴɢ ᴇʟsᴇ, ғᴇᴇʟ ғʀᴇᴇ ᴛᴏ sᴇɴᴅ /contact ᴀɴʏᴛɪᴍᴇ!`,
        { parse_mode: 'HTML' }
      );
    } catch {}

    await ctx.answerCallbackQuery({ text: `Chat closed for User ${targetUserId}.` });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {}
    await ctx.reply(`🔒 <b>sᴜᴘᴘᴏʀᴛ ᴄʜᴀᴛ ᴄʟᴏsᴇᴅ ғᴏʀ ᴜsᴇʀ</b> <code>${targetUserId}</code>`, {
      parse_mode: 'HTML',
    });
    return;
  }
}

/**
 * Handles admin input when replying via the button prompt (WAITING_ADMIN_CONTACT_REPLY)
 */
export async function handleAdminContactReplyInput(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const session = await getAdminSession(from.id);
  if (!session || session.state !== 'WAITING_ADMIN_CONTACT_REPLY') {
    return false;
  }

  const targetUserId = session.data?.targetUserId;
  const text = ctx.message?.text?.trim();

  if (text === '/cancel') {
    await clearAdminSession(from.id);
    await ctx.reply('❌ <b>ʀᴇᴘʟʏ ᴄᴀɴᴄᴇʟʟᴇᴅ</b>', { parse_mode: 'HTML' });
    return true;
  }

  if (!targetUserId) {
    await clearAdminSession(from.id);
    return false;
  }

  await clearAdminSession(from.id);

  try {
    if (text) {
      await ctx.api.sendMessage(
        targetUserId,
        `👨‍💼 <b>sᴜᴘᴘᴏʀᴛ ʀᴇsᴘᴏɴsᴇ:</b>\n\n` +
        `${escapeHtml(text)}\n\n` +
        `<i>💬 ʏᴏᴜ ᴄᴀɴ ʀᴇᴘʟʏ ᴅɪʀᴇᴄᴛʟʏ ʙᴇʟᴏᴡ ᴛᴏ ᴄᴏɴᴛɪɴᴜᴇ ᴛʜɪs ᴄʜᴀᴛ, ᴏʀ sᴇɴᴅ /cancel ᴛᴏ ᴇɴᴅ.</i>`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.api.sendMessage(
        targetUserId,
        `👨‍💼 <b>sᴜᴘᴘᴏʀᴛ ʀᴇsᴘᴏɴsᴇ (ᴀᴛᴛᴀᴄʜᴍᴇɴᴛ):</b>`,
        { parse_mode: 'HTML' }
      );
      await ctx.copyMessage(targetUserId);
    }

    // Keep user session warm
    await setAdminSession(targetUserId, 'WAITING_USER_CONTACT', {
      chatId: targetUserId,
    });

    await ctx.reply(`✅ <b>ʀᴇᴘʟʏ sᴜᴄᴄᴇssғᴜʟʟʏ ᴅᴇʟɪᴠᴇʀᴇᴅ ᴛᴏ ᴜsᴇʀ</b> <code>${targetUserId}</code>`, {
      parse_mode: 'HTML',
    });
    return true;
  } catch (err: any) {
    console.error(`[Contact Reply] Error sending to user ${targetUserId}:`, err);
    await ctx.reply(
      `❌ <b>ᴄᴏᴜʟᴅ ɴᴏᴛ ᴅᴇʟɪᴠᴇʀ:</b> ${escapeHtml(err?.message || 'User may have blocked the bot.')}`,
      { parse_mode: 'HTML' }
    );
    return true;
  }
}

/**
 * Handles admin /reply command: /reply <user_id> <message>
 */
export async function handleReplyCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from || !(await isAdmin(from.id))) {
    await ctx.reply('⛔ <b>ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ</b>', { parse_mode: 'HTML' });
    return;
  }

  const rawMatch = ctx.match as string | undefined;
  if (!rawMatch || !rawMatch.trim()) {
    await ctx.reply(
      `💡 <b>ᴜsᴀɢᴇ:</b> <code>/reply &lt;user_id&gt; &lt;your message&gt;</code>\n\n` +
      `<b>ᴇxᴀᴍᴘʟᴇ:</b>\n<code>/reply 123456789 Hello, your channel has been approved!</code>`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const parts = rawMatch.trim().split(/\s+/);
  const targetUserId = parseInt(parts[0], 10);
  const messageText = parts.slice(1).join(' ').trim();

  if (isNaN(targetUserId) || !messageText) {
    await ctx.reply(
      `⚠️ <b>ɪɴᴠᴀʟɪᴅ ғᴏʀᴍᴀᴛ.</b>\n` +
      `ᴜsᴀɢᴇ: <code>/reply &lt;user_id&gt; &lt;your message&gt;</code>`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  try {
    await ctx.api.sendMessage(
      targetUserId,
      `👨‍💼 <b>sᴜᴘᴘᴏʀᴛ ʀᴇsᴘᴏɴsᴇ:</b>\n\n` +
      `${escapeHtml(messageText)}\n\n` +
      `<i>💬 ʏᴏᴜ ᴄᴀɴ ʀᴇᴘʟʏ ᴅɪʀᴇᴄᴛʟʏ ʙᴇʟᴏᴡ ᴛᴏ ᴄᴏɴᴛɪɴᴜᴇ ᴛʜɪs ᴄʜᴀᴛ, ᴏʀ sᴇɴᴅ /cancel ᴛᴏ ᴇɴᴅ.</i>`,
      { parse_mode: 'HTML' }
    );

    await setAdminSession(targetUserId, 'WAITING_USER_CONTACT', {
      chatId: targetUserId,
    });

    await ctx.reply(
      `✅ <b>ʀᴇᴘʟʏ ᴅᴇʟɪᴠᴇʀᴇᴅ ᴛᴏ ᴜsᴇʀ</b> <code>${targetUserId}</code>`,
      { parse_mode: 'HTML' }
    );
  } catch (err: any) {
    await ctx.reply(
      `❌ <b>ғᴀɪʟᴇᴅ ᴛᴏ ᴅᴇʟɪᴠᴇʀ:</b> ${escapeHtml(err?.message || 'User may have blocked the bot.')}`,
      { parse_mode: 'HTML' }
    );
  }
}
