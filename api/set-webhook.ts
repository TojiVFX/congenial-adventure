import type { IncomingMessage, ServerResponse } from 'http';
import { bot } from '../src/bot/index.js';
import { config } from '../src/config.js';

export default async function (req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (!config.botToken) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'BOT_TOKEN is not configured.' }));
    return;
  }

  try {
    // Determine the webhook URL from host header or APP_URL
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = config.appUrl || (host ? `${protocol}://${host}` : '');

    if (!baseUrl) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Could not determine domain. Please set APP_URL in environment variables.',
        })
      );
      return;
    }

    const webhookUrl = `${baseUrl}/api/webhook`;

    // Register webhook with Telegram
    await bot.api.setWebhook(webhookUrl, {
      secret_token: config.webhookSecret || undefined,
      allowed_updates: ['message', 'chat_join_request', 'callback_query'],
      drop_pending_updates: false,
    });

    const info = await bot.api.getWebhookInfo();

    res.statusCode = 200;
    res.end(
      JSON.stringify(
        {
          ok: true,
          message: 'Webhook has been successfully configured!',
          webhookUrl,
          webhookInfo: info,
        },
        null,
        2
      )
    );
  } catch (error: any) {
    console.error('[set-webhook Error]:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: error.message || 'Failed to set webhook' }));
  }
}
