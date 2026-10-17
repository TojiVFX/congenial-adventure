import { Bot, webhookCallback } from 'grammy';
import { config, validateConfig } from '../config.js';
import { connectDB } from '../db/connection.js';
import { handleStart } from './handlers/start.js';
import { handleChatJoinRequest } from './handlers/joinRequest.js';
import {
  handleAdminCommand,
  handleAdminCallback,
  handleAdminInput,
} from './handlers/admin.js';

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
bot.command(['admin', 'dashboard', 'panel'], handleAdminCommand);

// Join Requests: Auto-Approval & Logging
bot.on('chat_join_request', handleChatJoinRequest);

// Callback Queries (Admin Dashboard Navigation & Toggles)
bot.on('callback_query:data', handleAdminCallback);

// Admin Text / Forward Input Listener (Sessions)
bot.on('message', async (ctx, next) => {
  const handled = await handleAdminInput(ctx);
  if (!handled) {
    await next();
  }
});

// Catch-all error handler
bot.catch(err => {
  console.error('[Bot Error]:', err);
});
