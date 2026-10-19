import { Bot } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { config, validateConfig } from '../config.js';
import { connectDB } from '../db/connection.js';
import { handleStart, handleHelp } from './handlers/start.js';
import {
  handleContactCommand,
  handleContactMessage,
  handleContactCallback,
  handleAdminDirectReply,
  handleAdminContactReplyInput,
  handleReplyCommand,
} from './handlers/contact.js';
import { handleChatJoinRequest } from './handlers/joinRequest.js';
import {
  handleAdminCommand,
  handleAdminCallback,
  handleAdminInput,
} from './handlers/admin.js';
import {
  handleManageChatCommand,
  handleUserChannelCallback,
  handleUserChannelInput,
  handleAdminApprovalCallback,
} from './handlers/userChannel.js';
import { handleAcceptAllCommand, handleAcceptAllCallback } from './handlers/acceptAll.js';
import {
  handleStatusCommand,
  handleStatusCallback,
  handleClearErrorsCallback,
} from './handlers/status.js';
import { updateBotCommands } from './services/commandService.js';
import { LoggerService } from './services/loggerService.js';
import { classifyError } from './utils/errors.js';
import { recordSystemError } from '../db/models/SystemError.js';

export { updateBotCommands };

validateConfig();

export const bot = new Bot(config.botToken);

// 1. Auto-Retry Telegram Rate Limits (429) - adjusted for 24/7 VPS hosting
bot.api.config.use(
  autoRetry({
    maxDelaySeconds: 60,
    maxRetryAttempts: 3,
  })
);

// 2. Ignore "query is too old" errors from answerCallbackQuery
bot.api.config.use(async (prev, method, payload, signal) => {
  const res = await prev(method, payload, signal);
  if (
    !res.ok &&
    method === 'answerCallbackQuery' &&
    /query is too old|query ID is invalid/i.test(res.description || '')
  ) {
    console.warn('[Bot] Ignored expired callback query.');
    return { ok: true, result: true } as any;
  }
  return res;
});

// Middleware: ensure database connection is established
bot.use(async (ctx, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[Bot Middleware] Database connection error:', err);
  }
  await next();
});

// Commands
bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command(['contact', 'request', 'support'], handleContactCommand);
bot.command('reply', handleReplyCommand);
bot.command(['dashboard', 'admin', 'panel'], handleAdminCommand);
bot.command(['status', 'systemstatus', 'health'], handleStatusCommand);
bot.command(['managechat', 'manage', 'mychannels', 'addchannel'], handleManageChatCommand);
bot.command(['acceptall', 'accepall'], handleAcceptAllCommand);

// Join Requests: Auto-Approval & Logging
bot.on('chat_join_request', handleChatJoinRequest);

// Callback Queries
bot.on('callback_query:data', async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (data.startsWith('contact_') || data === 'user_contact_end') {
    await handleContactCallback(ctx);
    return;
  }
  if (data.startsWith('user_chan_')) {
    await handleUserChannelCallback(ctx);
    return;
  }
  if (data.startsWith('admin_approve_chan:') || data.startsWith('admin_reject_chan:')) {
    await handleAdminApprovalCallback(ctx);
    return;
  }
  if (data.startsWith('acceptall_continue:')) {
    await handleAcceptAllCallback(ctx);
    return;
  }
  if (data === 'admin_status' || data === 'admin_status_refresh') {
    await handleStatusCallback(ctx);
    return;
  }
  if (data === 'admin_clear_errors') {
    await handleClearErrorsCallback(ctx);
    return;
  }
  await handleAdminCallback(ctx);
});

// Text & Forward Input Listener (Support Relay, Admin Sessions, Channel Inputs)
bot.on('message', async (ctx, next) => {
  // 1. Telegram Native Swipe/Reply by Admin to user support cards
  const handledDirectReply = await handleAdminDirectReply(ctx);
  if (handledDirectReply) return;

  // 2. Admin input when replying via [Reply] inline button
  const handledAdminContactReply = await handleAdminContactReplyInput(ctx);
  if (handledAdminContactReply) return;

  // 3. Admin Dashboard sessions (channels, broadcast, settings)
  const handledAdmin = await handleAdminInput(ctx);
  if (handledAdmin) return;

  // 4. User Channel Submission session
  const handledUserChannel = await handleUserChannelInput(ctx);
  if (handledUserChannel) return;

  // 5. User Support / Live Chat session
  const handledContact = await handleContactMessage(ctx);
  if (handledContact) return;

  await next();
});

// Granular Catch-all error handler
bot.catch(async err => {
  const { ctx, error } = err;
  const classified = classifyError(error);

  if (classified.isBenign) {
    console.warn(`[Bot Warning] Suppressed benign error: ${classified.message}`);
  } else {
    console.error(`[Bot Error] Category: ${classified.category} | Code: ${classified.code || 'N/A'}:`, classified.message);

    // Record error in MongoDB for /status diagnostics
    recordSystemError(
      error,
      `Update #${ctx?.update?.update_id || 'unknown'} (${ctx?.from?.id ? `User ${ctx.from.id}` : 'system'})`
    ).catch(() => {});

    if (classified.isCritical && ctx.api) {
      LoggerService.logCriticalError(
        ctx,
        `System Alert: ${classified.category.toUpperCase()}`,
        classified.message
      ).catch(() => {});
    }
  }

  // Release any stuck loading wheel if an unhandled error occurred in a callback query
  if (ctx?.callbackQuery) {
    ctx.answerCallbackQuery({
      text: classified.isCritical ? '⚠️ Operation failed. Admin notified.' : '⚠️ Action failed. Please try again.',
      show_alert: classified.isCritical,
    }).catch(() => {});
  }
});
