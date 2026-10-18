import { webhookCallback } from 'grammy';
import type { IncomingMessage, ServerResponse } from 'http';
import { bot } from '../src/bot/index.js';
import { config } from '../src/config.js';
import { connectDB } from '../src/db/connection.js';

const timeoutMs = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '9500', 10);

const handler = webhookCallback(bot, 'http', {
  secretToken: config.webhookSecret || undefined,
  timeoutMilliseconds: timeoutMs,
});

export default async function (req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'POST') {
    // Database failure: return 500 so Telegram retries the update later
    try {
      await connectDB();
    } catch (err: any) {
      console.error('[Webhook DB Error]:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Database unavailable' }));
      return;
    }

    // Handler errors: log them but answer 200, otherwise Telegram re-sends the same update repeatedly
    try {
      return await handler(req, res);
    } catch (err: any) {
      console.error('[Webhook Error]:', err);
      if (!res.headersSent) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      }
    }
  } else {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'Telegram Auto Request Accept Bot' }));
  }
}
