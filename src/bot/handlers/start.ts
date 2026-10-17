import { Context, InlineKeyboard } from 'grammy';
import { User } from '../../db/models/User.js';
import { LinkService } from '../services/linkService.js';
import { LoggerService } from '../services/loggerService.js';
import { ChannelService } from '../services/channelService.js';

export async function handleStart(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const payload = ctx.match as string | undefined;

  // 1. Record or update user in database
  try {
    await User.findOneAndUpdate(
      { userId: from.id },
      {
        userId: from.id,
        firstName: from.first_name,
        lastName: from.last_name,
        username: from.username,
        sourcePayload: payload || undefined,
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('[handleStart] Failed to record user:', err);
  }

  // 2. Notify Log Channel
  ctx.api && LoggerService.logUserStart(ctx as any, {
    id: from.id,
    firstName: from.first_name,
    username: from.username,
  }, payload);

  // 3. If no payload, send standard bot greeting
  if (!payload || !payload.trim()) {
    const text =
      `👋 <b>ᴡᴇʟᴄᴏᴍᴇ, ${escapeHtml(from.first_name)}!</b>\n\n` +
      `⚡ <b>ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴀʟ ɢᴀᴛᴇᴡᴀʏ</b>\n` +
      `ᴛʜɪs ʙᴏᴛ ᴘʀᴏᴠɪᴅᴇs ᴀᴜᴛᴏᴍᴀᴛᴇᴅ, ɪɴsᴛᴀɴᴛ ᴍᴇᴍʙᴇʀsʜɪᴘ ᴠᴇʀɪғɪᴄᴀᴛɪᴏɴ ғᴏʀ ᴘʀɪᴠᴀᴛᴇ ᴄᴏᴍᴍᴜɴɪᴛɪᴇs.\n\n` +
      `• <b>ᴊᴏɪɴɪɴɢ ᴀ ᴄʜᴀɴɴᴇʟ?</b> ᴄʟɪᴄᴋ ᴛʜᴇ ɪɴᴠɪᴛᴀᴛɪᴏɴ ʟɪɴᴋ ᴘʀᴏᴠɪᴅᴇᴅ ʙʏ ʏᴏᴜʀ ᴄᴏᴍᴍᴜɴɪᴛʏ.\n` +
      `• <b>ᴍᴀɴᴀɢᴇ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ?</b> sᴇɴᴅ /managechat ᴛᴏ ᴄᴏɴɴᴇᴄᴛ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴏʀ ᴄᴏᴘʏ ʟɪɴᴋs.\n` +
      `• <b>ɴᴇᴇᴅ ᴀssɪsᴛᴀɴᴄᴇ?</b> sᴇɴᴅ /contact ᴛᴏ ʀᴇᴀᴄʜ ᴏᴜᴛ ᴛᴏ ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ.`;

    await ctx.reply(text, { parse_mode: 'HTML' });
    return;
  }

  // 4. Resolve Channel from Deep-Link Payload (e.g. inv_bcibiv)
  const channel = await LinkService.resolveChannelFromPayload(payload);
  if (!channel) {
    await ctx.reply(
      `⚠️ <b>Invalid or Expired Link</b>\n\nThe invitation link you followed is no longer active. Please request a new link from the channel administrator.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 5. Check if user is already a member
  const isMember = await ChannelService.isUserMember(ctx as any, channel.channelId, from.id);
  if (isMember) {
    await ctx.reply(
      `✅ <b>Already a Member</b>\n\nYou are already a member of <b>${escapeHtml(channel.title)}</b>.\nFeel free to open the channel anytime.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 6. Present the Join Request Button to the user
  const inviteLink = channel.inviteLink || `https://t.me/${channel.username || ''}`;
  const keyboard = new InlineKeyboard()
    .url('🚀 ʀᴇǫᴜᴇsᴛ ᴛᴏ ᴊᴏɪɴ ᴄʜᴀɴɴᴇʟ', inviteLink)
    .row();

  const greeting = channel.welcomeMessage
    ? `${channel.welcomeMessage}\n\n`
    : `ᴛᴀᴘ ᴛʜᴇ ʙᴜᴛᴛᴏɴ ʙᴇʟᴏᴡ ᴛᴏ sᴜʙᴍɪᴛ ʏᴏᴜʀ ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛ. ʏᴏᴜ ᴡɪʟʟ ʙᴇ ᴀᴘᴘʀᴏᴠᴇᴅ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ!`;

  const replyText =
    `✨ <b>ᴄʜᴀɴɴᴇʟ ɪɴᴠɪᴛᴀᴛɪᴏɴ</b>\n\n` +
    `ʏᴏᴜ ʜᴀᴠᴇ ʙᴇᴇɴ ɪɴᴠɪᴛᴇᴅ ᴛᴏ ᴊᴏɪɴ <b>${escapeHtml(channel.title)}</b>.\n\n` +
    `${greeting}`;

  await ctx.reply(replyText, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handleHelp(ctx: Context): Promise<void> {
  const text =
    `💡 <b>ʜᴏᴡ ᴛᴏ ᴜsᴇ ᴛʜɪs ʙᴏᴛ</b>\n\n` +
    `• <b>ᴊᴏɪɴɪɴɢ ᴀ ᴄᴏᴍᴍᴜɴɪᴛʏ:</b>\n` +
    `  1. ᴄʟɪᴄᴋ ᴛʜᴇ sʜᴏʀᴛ ɪɴᴠɪᴛᴇ ʟɪɴᴋ ғᴏʀ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ.\n` +
    `  2. ᴛᴀᴘ <b>ʀᴇǫᴜᴇsᴛ ᴛᴏ ᴊᴏɪɴ ᴄʜᴀɴɴᴇʟ</b>.\n` +
    `  3. ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ ᴡɪʟʟ ʙᴇ ᴠᴇʀɪғɪᴇᴅ ᴀɴᴅ ᴀᴘᴘʀᴏᴠᴇᴅ ɪɴsᴛᴀɴᴛʟʏ!\n\n` +
    `• <b>ᴄᴏɴɴᴇᴄᴛɪɴɢ ʏᴏᴜʀ ᴏᴡɴ ᴄʜᴀɴɴᴇʟ:</b>\n` +
    `  1. sᴇɴᴅ /managechat ᴛᴏ ᴏᴘᴇɴ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴅᴀsʜʙᴏᴀʀᴅ.\n` +
    `  2. ᴛᴀᴘ <b>➕ ᴀᴅᴅ ɴᴇᴡ ᴄʜᴀɴɴᴇʟ</b> ᴀɴᴅ ᴀᴅᴅ ᴛʜᴇ ʙᴏᴛ ᴀs ᴀɴ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ.\n` +
    `  3. ᴏɴᴄᴇ ᴀᴘᴘʀᴏᴠᴇᴅ ʙʏ ᴀᴅᴍɪɴs, ʏᴏᴜ ɢᴇᴛ ʏᴏᴜʀ sʜᴏʀᴛ ʟɪɴᴋ & ᴄᴏɴᴛʀᴏʟs!\n\n` +
    `• <b>ɴᴇᴇᴅ ʜᴇʟᴘ ᴏʀ sᴜᴘᴘᴏʀᴛ?</b>\n` +
    `  sᴇɴᴅ /contact ᴛᴏ ᴍᴇssᴀɢᴇ ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ᴅɪʀᴇᴄᴛʟʏ.`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
