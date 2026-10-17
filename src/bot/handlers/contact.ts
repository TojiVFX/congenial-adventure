import { Context, InlineKeyboard } from 'grammy';
import { config } from '../../config.js';
import { getGlobalSettings, setAdminSession, getAdminSession, clearAdminSession } from '../../db/models/Settings.js';
import { LoggerService } from '../services/loggerService.js';

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
  await setAdminSession(from.id, 'WAITING_USER_CONTACT');

  await ctx.reply(
    `📩 <b>ᴄᴏɴᴛᴀᴄᴛ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ</b>\n\n` +
    `ᴘʟᴇᴀsᴇ sᴇɴᴅ ʏᴏᴜʀ <b>ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ, ᴜsᴇʀɴᴀᴍᴇ, ᴏʀ ᴍᴇssᴀɢᴇ</b> ʙᴇʟᴏᴡ.\n` +
    `ʏᴏᴜ ᴄᴀɴ ᴀʟsᴏ ғᴏʀᴡᴀʀᴅ ᴀ ᴘᴏsᴛ ғʀᴏᴍ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ʜᴇʀᴇ.\n\n` +
    `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ.</i>`,
    { parse_mode: 'HTML' }
  );
}

export async function handleContactMessage(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const session = await getAdminSession(from.id);
  if (!session || session.state !== 'WAITING_USER_CONTACT') {
    return false;
  }

  const text = ctx.message?.text?.trim();
  if (text === '/cancel') {
    await clearAdminSession(from.id);
    await ctx.reply('❌ <b>ᴄᴀɴᴄᴇʟʟᴇᴅ</b>', { parse_mode: 'HTML' });
    return true;
  }

  await clearAdminSession(from.id);

  let content = text || '<i>Forwarded media / channel post</i>';
  const forwardChat = ctx.message?.forward_origin;
  if (forwardChat && forwardChat.type === 'channel' && forwardChat.chat) {
    content += `\n\n📢 <b>ғᴏʀᴡᴀʀᴅᴇᴅ ᴄʜᴀɴɴᴇʟ:</b> ${escapeHtml(forwardChat.chat.title || 'Channel')} (<code>${forwardChat.chat.id}</code>)`;
  }

  await sendContactToAdmins(ctx, content);

  await ctx.reply(
    `✅ <b>ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ ʜᴀs ʙᴇᴇɴ sᴇɴᴛ!</b>\n\n` +
    `ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ʜᴀs ʀᴇᴄᴇɪᴠᴇᴅ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴡɪʟʟ ʀᴇᴠɪᴇᴡ ɪᴛ sʜᴏʀᴛʟʏ.`,
    { parse_mode: 'HTML' }
  );

  return true;
}

async function sendContactToAdmins(ctx: Context, messageContent: string): Promise<void> {
  const from = ctx.from!;
  const usernameDisplay = from.username ? `@${from.username}` : '<i>ɴᴏɴᴇ</i>';
  const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const adminText =
    `📬 <b>ɴᴇᴡ ᴄʜᴀɴɴᴇʟ / sᴜᴘᴘᴏʀᴛ ʀᴇǫᴜᴇsᴛ</b>\n\n` +
    `• <b>ғʀᴏᴍ:</b> <a href="tg://user?id=${from.id}">${escapeHtml(from.first_name)}</a>\n` +
    `• <b>ᴜsᴇʀ ɪᴅ:</b> <code>${from.id}</code>\n` +
    `• <b>ᴜsᴇʀɴᴀᴍᴇ:</b> ${usernameDisplay}\n` +
    `• <b>ᴛɪᴍᴇ:</b> <code>${time} UTC</code>\n\n` +
    `💬 <b>ᴍᴇssᴀɢᴇ:</b>\n` +
    `<blockquote>${escapeHtml(messageContent)}</blockquote>`;

  const replyKb = new InlineKeyboard().url('💬 ᴄᴏɴᴛᴀᴄᴛ ᴜsᴇʀ', `tg://user?id=${from.id}`);

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
