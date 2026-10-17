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
      `👋 <b>Hello, ${escapeHtml(from.first_name)}!</b>\n\n` +
      `Welcome to the <b>Auto Request Approval Bot</b>.\n\n` +
      `⚡ This bot automatically handles channel join requests and manages member approvals effortlessly.\n\n` +
      `If you are an administrator, use /admin to access your management dashboard.`;

    await ctx.reply(text, { parse_mode: 'HTML' });
    return;
  }

  // 4. Resolve Channel from Deep-Link Payload (e.g. BQADAQADfQ8AAtFDkEYjVw5S-EXRHhYE)
  const channel = await LinkService.resolveChannelFromPayload(payload);
  if (!channel) {
    await ctx.reply(
      `⚠️ <b>Invalid or Expired Link</b>\n\nThe link you clicked does not correspond to an active channel. Please verify with the channel administrator.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 5. Check if user is already a member
  const isMember = await ChannelService.isUserMember(ctx as any, channel.channelId, from.id);
  if (isMember) {
    await ctx.reply(
      `✅ You are already a member of <b>${escapeHtml(channel.title)}</b>!\n\nFeel free to open the channel anytime.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 6. Present the Join Request Button to the user
  const inviteLink = channel.inviteLink || `https://t.me/${channel.username || ''}`;
  const keyboard = new InlineKeyboard().url('👉 Request to Join Channel', inviteLink);

  const greeting = channel.welcomeMessage
    ? `${channel.welcomeMessage}\n\n`
    : `Click the button below to send your join request. Our bot will process it automatically!`;

  const replyText =
    `📢 <b>Join ${escapeHtml(channel.title)}</b>\n\n` +
    `${greeting}`;

  await ctx.reply(replyText, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
