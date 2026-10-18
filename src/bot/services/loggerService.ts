import { Bot, Api } from 'grammy';
import { config } from '../../config.js';
import { getGlobalSettings } from '../../db/models/Settings.js';
import { escapeHtml } from '../utils/html.js';

export type BotOrApi = Bot | Api | { api: Api };

export class LoggerService {
  /**
   * Helper to safely extract Api instance from Bot, Api, or Context
   */
  private static getApi(botOrApi: BotOrApi): Api {
    return 'api' in botOrApi && (botOrApi as any).api
      ? ((botOrApi as any).api as Api)
      : (botOrApi as Api);
  }

  /**
   * Retrieves the active log channel ID from DB or environment variables
   */
  static async getLogChannelId(): Promise<number | undefined> {
    try {
      const settings = await getGlobalSettings();
      if (settings.logChannelId) return settings.logChannelId;
    } catch (e) {
      console.warn('[LoggerService] Could not fetch DB settings for log channel:', e);
    }
    return config.logChannelId;
  }

  /**
   * Sends a formatted log message to the log channel
   */
  private static async sendLog(botOrApi: BotOrApi, message: string): Promise<void> {
    try {
      const logChannelId = await this.getLogChannelId();
      if (!logChannelId) return; // No log channel configured

      const api = this.getApi(botOrApi);
      await api.sendMessage(logChannelId, message, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      console.error('[LoggerService] Failed to send message to log channel:', error);
    }
  }

  /**
   * Log: New user started the bot
   */
  static async logUserStart(
    botOrApi: BotOrApi,
    user: { id: number; firstName: string; username?: string },
    payload?: string
  ): Promise<void> {
    const usernameDisplay = user.username ? `@${user.username}` : '<i>None</i>';
    const payloadDisplay = payload ? `<code>${escapeHtml(payload)}</code>` : '<i>Direct / None</i>';
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const text =
      `👤 <b>NEW USER ONBOARDED</b>  #NEW_USER\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>User:</b> <a href="tg://user?id=${user.id}">${escapeHtml(user.firstName)}</a> (${usernameDisplay})\n` +
      `🆔 <b>User ID:</b> <code>${user.id}</code>\n` +
      `🔗 <b>Start Payload:</b> ${payloadDisplay}\n` +
      `🕒 <b>Timestamp:</b> <code>${time} UTC</code>`;

    await this.sendLog(botOrApi, text);
  }

  /**
   * Log: Join request auto-approved
   */
  static async logRequestApproved(
    botOrApi: BotOrApi,
    user: { id: number; firstName: string; username?: string },
    channel: { id: number; title: string; username?: string }
  ): Promise<void> {
    const usernameDisplay = user.username ? `@${user.username}` : '<i>None</i>';
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const channelDisplay = channel.username
      ? `<a href="https://t.me/${channel.username.replace(/^@/, '')}">${escapeHtml(channel.title)}</a>`
      : `<b>${escapeHtml(channel.title)}</b>`;

    const text =
      `🟢 <b>JOIN REQUEST APPROVED</b>  #JOIN_APPROVED\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📢 <b>Channel:</b> ${channelDisplay} (<code>${channel.id}</code>)\n` +
      `👤 <b>User:</b> <a href="tg://user?id=${user.id}">${escapeHtml(user.firstName)}</a> (${usernameDisplay})\n` +
      `🆔 <b>User ID:</b> <code>${user.id}</code>\n` +
      `⚡ <b>Status:</b> ✅ <b>Instant Auto-Approval</b>\n` +
      `🕒 <b>Timestamp:</b> <code>${time} UTC</code>`;

    await this.sendLog(botOrApi, text);
  }

  /**
   * Log: Join request received but kept pending (auto-approve disabled)
   */
  static async logRequestPending(
    botOrApi: BotOrApi,
    user: { id: number; firstName: string; username?: string },
    channel: { id: number; title: string; username?: string }
  ): Promise<void> {
    const usernameDisplay = user.username ? `@${user.username}` : '<i>None</i>';
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const channelDisplay = channel.username
      ? `<a href="https://t.me/${channel.username.replace(/^@/, '')}">${escapeHtml(channel.title)}</a>`
      : `<b>${escapeHtml(channel.title)}</b>`;

    const text =
      `🟡 <b>JOIN REQUEST PENDING</b>  #JOIN_PENDING\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📢 <b>Channel:</b> ${channelDisplay} (<code>${channel.id}</code>)\n` +
      `👤 <b>User:</b> <a href="tg://user?id=${user.id}">${escapeHtml(user.firstName)}</a> (${usernameDisplay})\n` +
      `🆔 <b>User ID:</b> <code>${user.id}</code>\n` +
      `⏸️ <b>Status:</b> ⏳ <b>Auto-Approve Disabled (Pending Review)</b>\n` +
      `🕒 <b>Timestamp:</b> <code>${time} UTC</code>`;

    await this.sendLog(botOrApi, text);
  }

  /**
   * Log: Channel added, approved, or updated
   */
  static async logChannelAction(
    botOrApi: BotOrApi,
    action: string,
    channel: { id: number; title: string; username?: string },
    adminId: number
  ): Promise<void> {
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const channelDisplay = channel.username
      ? `<a href="https://t.me/${channel.username.replace(/^@/, '')}">${escapeHtml(channel.title)}</a>`
      : `<b>${escapeHtml(channel.title)}</b>`;

    const text =
      `⚙️ <b>CHANNEL MANAGEMENT</b>  #CHANNEL_ACTION\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📢 <b>Channel:</b> ${channelDisplay} (<code>${channel.id}</code>)\n` +
      `⚡ <b>Action:</b> <b>${escapeHtml(action)}</b>\n` +
      `👮 <b>Performed By:</b> <a href="tg://user?id=${adminId}">Admin</a> (<code>${adminId}</code>)\n` +
      `🕒 <b>Timestamp:</b> <code>${time} UTC</code>`;

    await this.sendLog(botOrApi, text);
  }

  /**
   * Log: Critical error alert sent to log channel with collapsible quote
   */
  static async logCriticalError(
    botOrApi: BotOrApi,
    title: string,
    details: string,
    extraInfo?: { channel?: { id: number; title: string }; user?: { id: number; name?: string } }
  ): Promise<void> {
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    let extraText = '';
    if (extraInfo?.channel) {
      extraText = `📢 <b>Channel:</b> <b>${escapeHtml(extraInfo.channel.title)}</b> (<code>${extraInfo.channel.id}</code>)\n`;
    }
    if (extraInfo?.user) {
      extraText += `👤 <b>User:</b> <a href="tg://user?id=${extraInfo.user.id}">${escapeHtml(extraInfo.user.name || 'User')}</a> (<code>${extraInfo.user.id}</code>)\n`;
    }

    const text =
      `🚨 <b>CRITICAL SYSTEM ALERT</b>  #CRITICAL_ALERT\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ <b>Event:</b> <b>${escapeHtml(title)}</b>\n` +
      extraText +
      `\n<blockquote expandable><b>Error Details:</b>\n${escapeHtml(details.substring(0, 800))}</blockquote>\n` +
      `🕒 <b>Timestamp:</b> <code>${time} UTC</code>`;

    await this.sendLog(botOrApi, text);
  }
}
