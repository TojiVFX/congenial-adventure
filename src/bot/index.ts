import { Bot, webhookCallback } from 'grammy';
import { config, validateConfig } from '../config.js';
import { connectDB } from '../db/connection.js';
import { handleStart, handleHelp } from './handlers/start.js';
import { handleContactCommand, handleContactMessage } from './handlers/contact.js';
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
import { handleAcceptAllCommand } from './handlers/acceptAll.js';
import { updateBotCommands } from './services/commandService.js';

export { updateBotCommands };

validateConfig();

export const bot = new Bot(config.botToken);

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
bot.command(['contact', 'request'], handleContactCommand);
bot.command(['dashboard', 'admin', 'panel'], handleAdminCommand);
bot.command(['managechat', 'manage', 'mychannels', 'addchannel'], handleManageChatCommand);
bot.command(['acceptall', 'accepall'], handleAcceptAllCommand);

// Join Requests: Auto-Approval & Logging
bot.on('chat_join_request', handleChatJoinRequest);

// Callback Queries
bot.on('callback_query:data', async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (data.startsWith('user_chan_')) {
    await handleUserChannelCallback(ctx);
    return;
  }
  if (data.startsWith('admin_approve_chan:') || data.startsWith('admin_reject_chan:')) {
    await handleAdminApprovalCallback(ctx);
    return;
  }
  await handleAdminCallback(ctx);
});

// Text & Forward Input Listener (Admin Sessions, User Channel Inputs & Contact Submissions)
bot.on('message', async (ctx, next) => {
  const handledAdmin = await handleAdminInput(ctx);
  if (handledAdmin) return;

  const handledUserChannel = await handleUserChannelInput(ctx);
  if (handledUserChannel) return;

  const handledContact = await handleContactMessage(ctx);
  if (handledContact) return;

  await next();
});

// Catch-all error handler
bot.catch(err => {
  console.error('[Bot Error]:', err);
});
