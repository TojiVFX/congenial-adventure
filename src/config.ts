import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  botToken: string;
  mongodbUri: string;
  adminIds: number[];
  logChannelId?: number;
  appUrl?: string;
  webhookSecret?: string;
}

function parseAdminIds(raw?: string): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id));
}

function parseChannelId(raw?: string): number | undefined {
  if (!raw) return undefined;
  const parsed = parseInt(raw.trim(), 10);
  return isNaN(parsed) ? undefined : parsed;
}

export const config: Config = {
  botToken: process.env.BOT_TOKEN || '',
  mongodbUri: process.env.MONGODB_URI || '',
  adminIds: parseAdminIds(process.env.ADMIN_IDS),
  logChannelId: parseChannelId(process.env.LOG_CHANNEL_ID),
  appUrl: process.env.APP_URL?.replace(/\/$/, '') || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
};

export function validateConfig(): void {
  const missing: string[] = [];
  if (!config.botToken) missing.push('BOT_TOKEN');
  if (!config.mongodbUri) missing.push('MONGODB_URI');

  if (missing.length > 0) {
    console.warn(`[Config Warning] Missing environment variables: ${missing.join(', ')}`);
  }
}
