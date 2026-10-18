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
    const usernameDisplay = user.username ? `@${user.username}` : '<i>ɴᴏɴᴇ</i>';
    const payloadDisplay = payload ? `<code>${payload}</code>` : '<i>ᴅɪʀᴇᴄᴛ / ɴᴏɴᴇ</i>';
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const text =
      `👤 <b>ɴᴇᴡ ᴜsᴇʀ sᴛᴀʀᴛᴇᴅ ʙᴏᴛ</b>\n\n` +
      `• <b>ɴᴀᴍᴇ:</b> <a href="tg://user?id=${user.id}">${escapeHtml(user.firstName)}</a>\n` +
      `• <b>ᴜsᴇʀɴᴀᴍᴇ:</b> ${usernameDisplay}\n` +
      `• <b>ᴜsᴇʀ ɪᴅ:</b> <code>${user.id}</code>\n` +
      `• <b>sᴛᴀʀᴛ ᴘᴀʏʟᴏᴀᴅ:</b> ${payloadDisplay}\n` +
      `• <b>ᴛɪᴍᴇsᴛᴀᴍᴘ:</b> <code>${time} UTC</code>`;

    await this.sendLog(botOrApi, text);
  }

  /**
   * Log: Join request auto-approved
   */
  static async logRequestApproved(
    botOrApi: BotOrApi,
    user: { id: number; firstName: string; username?: string },
    channel: { id: number; title: string }
  ): Promise<void> {
    const usernameDisplay = user.username ? `@${user.username}` : '<i>ɴᴏɴᴇ</i>';
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const text =
      `🟢 <b>ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛ ᴀᴘᴘʀᴏᴠᴇᴅ</b>\n\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ:</b> <b>${escapeHtml(channel.title)}</b> (<code>${channel.id}</code>)\n` +
      `• <b>ᴜsᴇʀ:</b> <a href="tg://user?id=${user.id}">${escapeHtml(user.firstName)}</a>\n` +
      `• <b>ᴜsᴇʀɴᴀᴍᴇ:</b> ${usernameDisplay}\n` +
      `• <b>ᴜsᴇʀ ɪᴅ:</b> <code>${user.id}</code>\n` +
      `• <b>sᴛᴀᴛᴜs:</b> ✅ <b>ᴀᴘᴘʀᴏᴠᴇᴅ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ</b>\n` +
      `• <b>ᴛɪᴍᴇsᴛᴀᴍᴘ:</b> <code>${time} UTC</code>`;

    await this.sendLog(botOrApi, text);
  }

  /**
   * Log: Join request received but kept pending (auto-approve disabled)
   */
  static async logRequestPending(
    botOrApi: BotOrApi,
    user: { id: number; firstName: string; username?: string },
    channel: { id: number; title: string }
  ): Promise<void> {
    const usernameDisplay = user.username ? `@${user.username}` : '<i>ɴᴏɴᴇ</i>';
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const text =
      `🟡 <b>ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛ ᴘᴇɴᴅɪɴɢ (ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ ᴅɪsᴀʙʟᴇᴅ)</b>\n\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ:</b> <b>${escapeHtml(channel.title)}</b> (<code>${channel.id}</code>)\n` +
      `• <b>ᴜsᴇʀ:</b> <a href="tg://user?id=${user.id}">${escapeHtml(user.firstName)}</a>\n` +
      `• <b>ᴜsᴇʀɴᴀᴍᴇ:</b> ${usernameDisplay}\n` +
      `• <b>ᴜsᴇʀ ɪᴅ:</b> <code>${user.id}</code>\n` +
      `• <b>sᴛᴀᴛᴜs:</b> ⏳ <b>ʟᴇғᴛ ᴘᴇɴᴅɪɴɢ</b>\n` +
      `• <b>ᴛɪᴍᴇsᴛᴀᴍᴘ:</b> <code>${time} UTC</code>`;

    await this.sendLog(botOrApi, text);
  }

  /**
   * Log: Channel added or updated
   */
  static async logChannelAction(
    botOrApi: BotOrApi,
    action: string,
    channel: { id: number; title: string },
    adminId: number
  ): Promise<void> {
    const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const text =
      `📢 <b>ᴄʜᴀɴɴᴇʟ ᴀᴄᴛɪᴏɴ: ${escapeHtml(action)}</b>\n\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ:</b> <b>${escapeHtml(channel.title)}</b> (<code>${channel.id}</code>)\n` +
      `• <b>ᴘᴇʀғᴏʀᴍᴇᴅ ʙʏ ᴀᴅᴍɪɴ:</b> <code>${adminId}</code>\n` +
      `• <b>ᴛɪᴍᴇsᴛᴀᴍᴘ:</b> <code>${time} UTC</code>`;

    await this.sendLog(botOrApi, text);
  }
}
