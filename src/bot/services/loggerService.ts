import { Bot } from 'grammy';
import { config } from '../../config.js';
import { getGlobalSettings } from '../../db/models/Settings.js';

export class LoggerService {
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
  private static async sendLog(bot: Bot, message: string): Promise<void> {
    try {
      const logChannelId = await this.getLogChannelId();
      if (!logChannelId) return; // No log channel configured

      await bot.api.sendMessage(logChannelId, message, {
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
    bot: Bot,
    user: { id: number; firstName: string; username?: string },
    payload?: string
  ): Promise<void> {
    const usernameDisplay = user.username ? `@${user.username}` : '<i>None</i>';
    const payloadDisplay = payload ? `<code>${payload}</code>` : '<i>Direct / None</i>';
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const text =
      `👤 <b>New User Started Bot</b>\n\n` +
      `• <b>Name:</b> <a href="tg://user?id=${user.id}">${escapeHtml(user.firstName)}</a>\n` +
      `• <b>Username:</b> ${usernameDisplay}\n` +
      `• <b>User ID:</b> <code>${user.id}</code>\n` +
      `• <b>Start Payload:</b> ${payloadDisplay}\n` +
      `• <b>Timestamp:</b> <code>${time} UTC</code>`;

    await this.sendLog(bot, text);
  }

  /**
   * Log: Join request auto-approved
   */
  static async logRequestApproved(
    bot: Bot,
    user: { id: number; firstName: string; username?: string },
    channel: { id: number; title: string }
  ): Promise<void> {
    const usernameDisplay = user.username ? `@${user.username}` : '<i>None</i>';
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const text =
      `🟢 <b>Join Request Approved</b>\n\n` +
      `• <b>Channel:</b> <b>${escapeHtml(channel.title)}</b> (<code>${channel.id}</code>)\n` +
      `• <b>User:</b> <a href="tg://user?id=${user.id}">${escapeHtml(user.firstName)}</a>\n` +
      `• <b>Username:</b> ${usernameDisplay}\n` +
      `• <b>User ID:</b> <code>${user.id}</code>\n` +
      `• <b>Status:</b> ✅ <b>Approved Automatically</b>\n` +
      `• <b>Timestamp:</b> <code>${time} UTC</code>`;

    await this.sendLog(bot, text);
  }

  /**
   * Log: Join request received but kept pending (auto-approve disabled)
   */
  static async logRequestPending(
    bot: Bot,
    user: { id: number; firstName: string; username?: string },
    channel: { id: number; title: string }
  ): Promise<void> {
    const usernameDisplay = user.username ? `@${user.username}` : '<i>None</i>';
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const text =
      `🟡 <b>Join Request Pending (Auto-Approve Disabled)</b>\n\n` +
      `• <b>Channel:</b> <b>${escapeHtml(channel.title)}</b> (<code>${channel.id}</code>)\n` +
      `• <b>User:</b> <a href="tg://user?id=${user.id}">${escapeHtml(user.firstName)}</a>\n` +
      `• <b>Username:</b> ${usernameDisplay}\n` +
      `• <b>User ID:</b> <code>${user.id}</code>\n` +
      `• <b>Status:</b> ⏳ <b>Left Pending</b> (Approval disabled for this channel)\n` +
      `• <b>Timestamp:</b> <code>${time} UTC</code>`;

    await this.sendLog(bot, text);
  }

  /**
   * Log: Channel added or updated
   */
  static async logChannelAction(
    bot: Bot,
    action: string,
    channel: { id: number; title: string },
    adminId: number
  ): Promise<void> {
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const text =
      `📢 <b>Channel Action: ${escapeHtml(action)}</b>\n\n` +
      `• <b>Channel:</b> <b>${escapeHtml(channel.title)}</b> (<code>${channel.id}</code>)\n` +
      `• <b>Performed By Admin:</b> <code>${adminId}</code>\n` +
      `• <b>Timestamp:</b> <code>${time} UTC</code>`;

    await this.sendLog(bot, text);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
