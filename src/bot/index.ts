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
bot.command(['contact', 'request', 'addchannel'], handleContactCommand);
bot.command(['dashboard', 'admin', 'panel'], handleAdminCommand);

// Join Requests: Auto-Approval & Logging
bot.on('chat_join_request', handleChatJoinRequest);

// Callback Queries (Admin Dashboard Navigation & Toggles)
bot.on('callback_query:data', handleAdminCallback);

// Text & Forward Input Listener (Admin Sessions & Contact Submissions)
bot.on('message', async (ctx, next) => {
  const handledAdmin = await handleAdminInput(ctx);
  if (handledAdmin) return;

  const handledContact = await handleContactMessage(ctx);
  if (handledContact) return;

  await next();
});

// Catch-all error handler
bot.catch(err => {
  console.error('[Bot Error]:', err);
});
