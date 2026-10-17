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
  const keyboard = new InlineKeyboard().url('🚀 Request to Join Channel', inviteLink);

  const greeting = channel.welcomeMessage
    ? `${channel.welcomeMessage}\n\n`
    : `Tap the button below to submit your join request. You will be approved automatically!`;

  const replyText =
    `✨ <b>Channel Invitation</b>\n\n` +
    `You have been invited to join <b>${escapeHtml(channel.title)}</b>.\n\n` +
    `${greeting}`;

  await ctx.reply(replyText, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handleHelp(ctx: Context): Promise<void> {
  const text =
    `💡 <b>How to Use This Bot</b>\n\n` +
    `• <b>For Channel Members:</b>\n` +
    `  Click the invite or deep link provided by the channel owner. Start the bot and tap <b>Request to Join Channel</b> to be automatically approved!\n\n` +
    `• <b>For Channel Administrators:</b>\n` +
    `  1. Add this bot to your channel as an Administrator with <i>Invite Users via Link</i> rights.\n` +
    `  2. Send /admin to connect your channel, toggle auto-approval, and generate shareable links.\n` +
    `  3. Configure a Log Channel to record all join requests in real time.\n\n` +
    `Need more help? Type /admin if you are an authorized administrator.`;

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
