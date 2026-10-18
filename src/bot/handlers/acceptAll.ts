import { Context, InlineKeyboard } from 'grammy';
import { Channel } from '../../db/models/Channel.js';
import { RequestLog } from '../../db/models/RequestLog.js';
import { InviteLink } from '../../db/models/InviteLink.js';
import { ChannelService } from '../services/channelService.js';
import { LoggerService } from '../services/loggerService.js';
import { isAdmin } from './admin.js';
import { escapeHtml } from '../utils/html.js';

// Vercel serverless safe budget (8.5s limit ensures 200 OK before gateway timeout)
const TIME_BUDGET_MS = 8500;
const DELAY_MS = 30;

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

  await processBulkApproval(ctx, channelId, from.id);
}

export async function handleAcceptAllCallback(ctx: Context): Promise<void> {
  const from = ctx.from;
  const data = ctx.callbackQuery?.data;
  if (!from || !data) return;

  const channelId = parseInt(data.replace('acceptall_continue:', '').trim(), 10);
  if (isNaN(channelId)) {
    await ctx.answerCallbackQuery({ text: 'Invalid channel ID.' });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'Resuming approval batch...' });
  await processBulkApproval(ctx, channelId, from.id);
}

async function processBulkApproval(ctx: Context, channelId: number, fromId: number): Promise<void> {
  const channel = await ChannelService.getChannelCached(channelId);
  if (!channel) {
    await ctx.reply('⚠️ This channel is not connected to the bot.');
    return;
  }

  const admin = await isAdmin(fromId);
  if (!admin && channel.addedByUserId !== fromId) {
    await ctx.reply('⛔ You can only run this on channels you connected.');
    return;
  }

  if (channel.status !== 'approved') {
    await ctx.reply(`⚠️ This channel is <b>${channel.status}</b>. It must be approved first.`, {
      parse_mode: 'HTML',
    });
    return;
  }

  // Unique users with pending requests
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
  const approvedIds: number[] = [];
  const staleIds: number[] = [];
  let failed = 0;
  let processed = 0;
  let rateLimited = false;

  for (const userId of userIds) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    processed++;

    try {
      await ctx.api.approveChatJoinRequest(channelId, userId);
      approvedIds.push(userId);
    } catch (e: any) {
      const msg: string = e?.description || e?.message || '';
      if (e?.error_code === 429) {
        rateLimited = true;
        processed--;
        break;
      }
      if (STALE_REGEX.test(msg)) {
        staleIds.push(userId);
      } else {
        console.warn(`[AcceptAll] Failed to approve ${userId} in ${channelId}:`, msg);
        failed++;
      }
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // Single High-Performance Bulk Write to MongoDB
  const bulkWrites: Promise<any>[] = [];

  if (approvedIds.length > 0) {
    bulkWrites.push(
      RequestLog.updateMany(
        { channelId, userId: { $in: approvedIds }, status: 'pending' },
        { status: 'approved', reason: 'Approved via /acceptall' }
      ),
      InviteLink.updateMany(
        { channelId, userId: { $in: approvedIds }, used: false },
        { used: true }
      ),
      Channel.updateOne(
        { channelId },
        { $inc: { totalApproved: approvedIds.length } }
      )
    );
  }

  if (staleIds.length > 0) {
    bulkWrites.push(
      RequestLog.updateMany(
        { channelId, userId: { $in: staleIds }, status: 'pending' },
        { status: 'rejected', reason: 'Request no longer valid on Telegram' }
      )
    );
  }

  await Promise.allSettled(bulkWrites);

  const remaining = userIds.length - processed;

  let doneText =
    `📥 <b>Bulk Approval ${remaining > 0 ? 'Batch Completed' : 'All Completed'}</b>\n\n` +
    `• <b>Channel:</b> ${escapeHtml(channel.title)}\n` +
    `• <b>✅ Approved:</b> <code>${approvedIds.length}</code>\n` +
    `• <b>⚪ Expired / already handled:</b> <code>${staleIds.length}</code>\n` +
    `• <b>❌ Failed:</b> <code>${failed}</code>`;

  const keyboard = new InlineKeyboard();

  if (remaining > 0) {
    doneText +=
      `\n• <b>⏳ Remaining:</b> <code>${remaining}</code>\n\n` +
      (rateLimited ? `Telegram rate limit reached. ` : `Serverless batch window closed. `) +
      `Tap below to approve the next batch:`;

    keyboard.text(`⏩ Continue Approving (${remaining} Left)`, `acceptall_continue:${channelId}`);
  }

  try {
    await ctx.api.editMessageText(statusMsg.chat.id, statusMsg.message_id, doneText, {
      parse_mode: 'HTML',
      reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined,
    });
  } catch {
    await ctx.reply(doneText, {
      parse_mode: 'HTML',
      reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined,
    });
  }

  if (approvedIds.length > 0) {
    LoggerService.logChannelAction(
      ctx,
      `Bulk Approved ${approvedIds.length} Requests`,
      { id: channel.channelId, title: channel.title },
      fromId
    ).catch(() => {});
  }
}
