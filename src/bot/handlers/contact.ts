import { Context, InlineKeyboard } from 'grammy';
import { config } from '../../config.js';
import { getGlobalSettings, setAdminSession, getAdminSession, clearAdminSession } from '../../db/models/Settings.js';
import { LoggerService } from '../services/loggerService.js';
import { escapeHtml } from '../utils/html.js';

export async function handleContactCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const match = ctx.match as string | undefined;

  // If user provided a message directly with the command: e.g. /contact please add my channel @test
  if (match && match.trim().length > 0) {
    await sendContactToAdmins(ctx, match.trim());
    await ctx.reply(
      `✅ <b>ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ ʜᴀs ʙᴇᴇɴ sᴇɴᴛ!</b>\n\n` +
      `ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ʜᴀs ʀᴇᴄᴇɪᴠᴇᴅ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴡɪʟʟ ʀᴇᴠɪᴇᴡ ɪᴛ sʜᴏʀᴛʟʏ.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Otherwise, set session and prompt user for details
  const promptText =
    `📩 <b>ᴄᴏɴᴛᴀᴄᴛ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ</b>\n\n` +
    `ᴘʟᴇᴀsᴇ sᴇɴᴅ ʏᴏᴜʀ <b>ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ, ᴜsᴇʀɴᴀᴍᴇ, ᴏʀ ᴍᴇssᴀɢᴇ</b> ʙᴇʟᴏᴡ.\n` +
    `ʏᴏᴜ ᴄᴀɴ ᴀʟsᴏ ғᴏʀᴡᴀʀᴅ ᴀ ᴘᴏsᴛ ғʀᴏᴍ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ʜᴇʀᴇ.\n\n` +
    `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ.</i>`;

  const cancelKb = new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'user_chan_list');

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

export async function handleContactMessage(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const session = await getAdminSession(from.id);
  if (!session || session.state !== 'WAITING_USER_CONTACT') {
    return false;
  }

  const promptMessageId = session.data?.promptMessageId;
  const chatId = session.data?.chatId || ctx.chat?.id;

  // Clean up user's message
  try {
    await ctx.deleteMessage();
  } catch {}

  const text = ctx.message?.text?.trim();
  if (text === '/cancel') {
    await clearAdminSession(from.id);
    if (promptMessageId && chatId) {
      try {
        await ctx.api.editMessageText(chatId, promptMessageId, '❌ <b>ᴄᴏɴᴛᴀᴄᴛ ᴄᴀɴᴄᴇʟʟᴇᴅ</b>', {
          parse_mode: 'HTML',
        });
        return true;
      } catch {}
    }
    await ctx.reply('❌ <b>ᴄᴏɴᴛᴀᴄᴛ ᴄᴀɴᴄᴇʟʟᴇᴅ</b>', { parse_mode: 'HTML' });
    return true;
  }

  await clearAdminSession(from.id);

  const forwardChat = ctx.message?.forward_origin;
  const forwardedChannel =
    forwardChat && forwardChat.type === 'channel' && forwardChat.chat
      ? { id: forwardChat.chat.id, title: forwardChat.chat.title || 'Channel' }
      : undefined;

  const content = text || 'Forwarded media / channel post';
  await sendContactToAdmins(ctx, content, forwardedChannel);

  const confirmText =
    `✅ <b>ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ ʜᴀs ʙᴇᴇɴ sᴇɴᴛ!</b>\n\n` +
    `ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ʜᴀs ʀᴇᴄᴇɪᴠᴇᴅ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴡɪʟʟ ʀᴇᴠɪᴇᴡ ɪᴛ sʜᴏʀᴛʟʏ.`;

  if (promptMessageId && chatId) {
    try {
      await ctx.api.editMessageText(chatId, promptMessageId, confirmText, {
        parse_mode: 'HTML',
      });
      return true;
    } catch {}
  }

  await ctx.reply(confirmText, { parse_mode: 'HTML' });
  return true;
}

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
    forwardInfo = `\n\n📢 <b>ғᴏʀᴡᴀʀᴅᴇᴅ ᴄʜᴀɴɴᴇʟ:</b> ${escapeHtml(forwardedChannel.title)} (<code>${forwardedChannel.id}</code>)`;
  }

  const adminText =
    `📬 <b>ɴᴇᴡ ᴄʜᴀɴɴᴇʟ / sᴜᴘᴘᴏʀᴛ ʀᴇǫᴜᴇsᴛ</b>\n\n` +
    `• <b>ғʀᴏᴍ:</b> <a href="tg://user?id=${from.id}">${escapeHtml(from.first_name)}</a>\n` +
    `• <b>ᴜsᴇʀ ɪᴅ:</b> <code>${from.id}</code>\n` +
    `• <b>ᴜsᴇʀɴᴀᴍᴇ:</b> ${usernameDisplay}\n` +
    `• <b>ᴛɪᴍᴇ:</b> <code>${time} UTC</code>\n\n` +
    `💬 <b>ᴍᴇssᴀɢᴇ:</b>\n` +
    `<blockquote>${escapeHtml(messageContent)}</blockquote>` +
    forwardInfo;

  const replyKb = new InlineKeyboard()
    .url('💬 ᴄᴏɴᴛᴀᴄᴛ ᴜsᴇʀ', `tg://user?id=${from.id}`)
    .primary();

  // 1. Deliver to all configured Admins
  const settings = await getGlobalSettings();
  const allAdmins = Array.from(new Set([...config.adminIds, ...(settings.admins || [])]));

  for (const adminId of allAdmins) {
    try {
      await ctx.api.sendMessage(adminId, adminText, {
        parse_mode: 'HTML',
        reply_markup: replyKb,
      });
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
        reply_markup: replyKb,
      });
    } catch (e) {
      console.warn('[Contact] Could not deliver to log channel:', e);
    }
  }
}
