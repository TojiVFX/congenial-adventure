import { webhookCallback } from 'grammy';
import type { IncomingMessage, ServerResponse } from 'http';
import { bot } from '../src/bot/index.js';
import { config } from '../src/config.js';
import { connectDB } from '../src/db/connection.js';

const handler = webhookCallback(bot, 'http', {
  secretToken: config.webhookSecret || undefined,
  timeoutMilliseconds: 25000,
});

export default async function (req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'POST') {
    try {
      await connectDB();
      return await handler(req, res);
    } catch (err: any) {
      console.error('[Webhook Error]:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  } else {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'Telegram Auto Request Accept Bot' }));
  }
}
