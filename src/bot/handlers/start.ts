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
      `👋 <b>Welcome, ${escapeHtml(from.first_name)}!</b>\n\n` +
      `⚡ <b>Auto-Approval Gateway</b>\n` +
      `Automated channel request verification and instant access.\n\n` +
      `• <b>Joining a Channel?</b> Click the invitation link provided by the community owner.\n` +
      `• <b>Administrator?</b> Send /admin to access your Control Dashboard.`;

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
    `• <b>ғᴏʀ ᴄʜᴀɴɴᴇʟ ᴍᴇᴍʙᴇʀs:</b>\n` +
    `  ᴄʟɪᴄᴋ ᴛʜᴇ ɪɴᴠɪᴛᴇ ᴏʀ ᴅᴇᴇᴘ ʟɪɴᴋ ᴘʀᴏᴠɪᴅᴇᴅ ʙʏ ᴛʜᴇ ᴄʜᴀɴɴᴇʟ ᴏᴡɴᴇʀ. sᴛᴀʀᴛ ᴛʜᴇ ʙᴏᴛ ᴀɴᴅ ᴛᴀᴘ <b>ʀᴇǫᴜᴇsᴛ ᴛᴏ ᴊᴏɪɴ</b> ᴛᴏ ɢᴇᴛ ɪɴsᴛᴀɴᴛ ᴀᴄᴄᴇss!\n\n` +
    `• <b>ᴡᴀɴᴛ ᴛᴏ ᴀᴅᴅ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ?</b>\n` +
    `  sᴇɴᴅ /contact ᴛᴏ sᴜʙᴍɪᴛ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴅᴇᴛᴀɪʟs ᴅɪʀᴇᴄᴛʟʏ ᴛᴏ ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ.\n\n` +
    `• <b>ғᴏʀ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀs:</b>\n` +
    `  1. ᴀᴅᴅ ᴛʜɪs ʙᴏᴛ ᴛᴏ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴀs ᴀɴ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ᴡɪᴛʜ <i>ɪɴᴠɪᴛᴇ ᴜsᴇʀs ᴠɪᴀ ʟɪɴᴋ</i> ʀɪɢʜᴛs.\n` +
    `  2. sᴇɴᴅ /admin ᴛᴏ ᴏᴘᴇɴ ʏᴏᴜʀ ᴄᴏɴᴛʀᴏʟ ᴅᴀsʜʙᴏᴀʀᴅ, ᴄᴏɴɴᴇᴄᴛ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ, ᴀɴᴅ ɢᴇɴᴇʀᴀᴛᴇ sʜᴏʀᴛ ʟɪɴᴋs.\n` +
    `  3. sᴇᴛ ᴜᴘ ᴀ ʟᴏɢ ᴄʜᴀɴɴᴇʟ ᴛᴏ ᴋᴇᴇᴘ ᴛʀᴀᴄᴋ ᴏғ ᴀʟʟ ᴀᴄᴛɪᴏɴs ɪɴ ʀᴇᴀʟ ᴛɪᴍᴇ.`;

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
