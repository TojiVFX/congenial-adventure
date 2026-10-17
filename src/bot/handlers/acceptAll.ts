import { Context } from 'grammy';
import { Channel } from '../../db/models/Channel.js';
import { RequestLog } from '../../db/models/RequestLog.js';
import { LoggerService } from '../services/loggerService.js';
import { isAdmin } from './admin.js';

// Vercel webhook timeout is 25s, so stop early and let the user re-run for the rest
const TIME_BUDGET_MS = 18000;
const DELAY_MS = 35;

const STALE_REGEX =
  /USER_ALREADY_PARTICIPANT|HIDE_REQUESTER_MISSING|USER_ID_INVALID|request.*(not found|missing)/i;

export async function handleAcceptAllCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const raw = (ctx.match as string | undefined)?.trim();
  const channelId = raw ? parseInt(raw, 10) : NaN;

  if (isNaN(channelId)) {
    await ctx.reply(
      `📥 <b>ᴀᴄᴄᴇᴘᴛ ᴀʟʟ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛs</b>\n\n` +
      `<b>Usage:</b> <code>/acceptall -1001234567890</code>\n\n` +
      `Approves every pending join request recorded for that channel.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const channel = await Channel.findOne({ channelId });
  if (!channel) {
    await ctx.reply('⚠️ This channel is not connected to the bot.');
    return;
  }

  const admin = await isAdmin(from.id);
  if (!admin && channel.addedByUserId !== from.id) {
    await ctx.reply('⛔ You can only run this on channels you connected.');
    return;
  }

  if (channel.status !== 'approved') {
    await ctx.reply(`⚠️ This channel is <b>${channel.status}</b>. It must be approved first.`, {
      parse_mode: 'HTML',
    });
    return;
  }

  // Unique users with pending requests (a user may have several log entries)
  const userIds: number[] = await RequestLog.distinct('userId', { channelId, status: 'pending' });

  if (userIds.length === 0) {
    await ctx.reply('✅ No pending requests recorded for this channel.');
    return;
  }

  const statusMsg = await ctx.reply(
    `🚀 Approving <b>${userIds.length}</b> pending requests for <b>${escapeHtml(channel.title)}</b>...`,
    { parse_mode: 'HTML' }
  );

  const started = Date.now();
  let approved = 0;
  let stale = 0;
  let failed = 0;
  let processed = 0;
  let rateLimited = false;

  for (const userId of userIds) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    processed++;

    try {
      await ctx.api.approveChatJoinRequest(channelId, userId);
      await RequestLog.updateMany(
        { channelId, userId, status: 'pending' },
        { status: 'approved', reason: 'Approved via /acceptall' }
      );
      approved++;
    } catch (e: any) {
      const msg: string = e?.description || e?.message || '';
      if (e?.error_code === 429) {
        rateLimited = true;
        processed--;
        break;
      }
      if (STALE_REGEX.test(msg)) {
        // Request no longer exists on Telegram (user left, cancelled, or already joined)
        await RequestLog.updateMany(
          { channelId, userId, status: 'pending' },
          { status: 'rejected', reason: 'Request no longer valid on Telegram' }
        );
        stale++;
      } else {
        console.warn(`[AcceptAll] Failed to approve ${userId} in ${channelId}:`, msg);
        failed++;
      }
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  if (approved > 0) {
    await Channel.updateOne({ channelId }, { $inc: { totalApproved: approved } });
  }

  const remaining = userIds.length - processed;

  let doneText =
    `📥 <b>Bulk Approval ${remaining > 0 ? 'Paused' : 'Completed'}</b>\n\n` +
    `• <b>Channel:</b> ${escapeHtml(channel.title)}\n` +
    `• <b>✅ Approved:</b> <code>${approved}</code>\n` +
    `• <b>⚪ Expired / already handled:</b> <code>${stale}</code>\n` +
    `• <b>❌ Failed:</b> <code>${failed}</code>`;

  if (remaining > 0) {
    doneText +=
      `\n• <b>⏳ Remaining:</b> <code>${remaining}</code>\n\n` +
      (rateLimited ? `Telegram rate limit reached. ` : `Time limit reached. `) +
      `Run <code>/acceptall ${channelId}</code> again to continue.`;
  }

  try {
    await ctx.api.editMessageText(statusMsg.chat.id, statusMsg.message_id, doneText, {
      parse_mode: 'HTML',
    });
  } catch {
    await ctx.reply(doneText, { parse_mode: 'HTML' });
  }

  if (approved > 0) {
    LoggerService.logChannelAction(
      ctx as any,
      `Bulk Approved ${approved} Requests`,
      { id: channel.channelId, title: channel.title },
      from.id
    );
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
