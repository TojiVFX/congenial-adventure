import crypto from 'crypto';
import { Bot, Api } from 'grammy';
import { Channel, IChannel } from '../../db/models/Channel.js';
import { InviteLink } from '../../db/models/InviteLink.js';

export const USER_LINK_TTL_MINUTES = 10;

export class LinkService {
  /**
   * Generates a clean, short start payload matching:
   * https://t.me/YourBot?start=inv_bcibiv
   * - Starts with 'inv_'
   * - Followed by 6 to 10 alphanumeric characters (mix of A-Z, a-z, 0-9)
   * - No hyphens (-)
   */
  static generateStartPayload(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomBytes = crypto.randomBytes(length);
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars[randomBytes[i] % chars.length];
    }
    return `inv_${code}`;
  }

  /**
   * Generates a clean, short Telegram Deep-Link for the bot
   * e.g. https://t.me/BotUsername?start=inv_bcibiv
   */
  static getBotDeepLink(botUsername: string, startPayload: string): string {
    return `https://t.me/${botUsername}?start=${startPayload}`;
  }

  /**
   * Creates or retrieves a Telegram channel join-request invite link
   * (creates_join_request: true)
   */
  static async getOrCreateChannelInviteLink(
    botOrApi: Bot | Api | { api: Api },
    channelId: number,
    channelTitle: string
  ): Promise<string> {
    const api: Api =
      'api' in botOrApi && (botOrApi as any).api
        ? ((botOrApi as any).api as Api)
        : (botOrApi as Api);
    try {
      const inviteLinkObj = await api.createChatInviteLink(channelId, {
        name: `JoinReq_${channelTitle.substring(0, 12).replace(/[^\w\s]/gi, '')}`,
        creates_join_request: true,
      });
      return inviteLinkObj.invite_link;
    } catch (error) {
      console.error(`[LinkService] Failed to create invite link for channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Creates (or reuses) a join-request link made for ONE user that expires
   * after USER_LINK_TTL_MINUTES. Telegram itself enforces the expiry.
   */
  static async getOrCreateUserInviteLink(
    botOrApi: Bot | Api | { api: Api },
    channelId: number,
    userId: number
  ): Promise<{ link: string; expiresAt: Date }> {
    const api: Api =
      'api' in botOrApi && (botOrApi as any).api
        ? ((botOrApi as any).api as Api)
        : (botOrApi as Api);

    // Reuse a still-valid link (more than 60s left) so repeated /start taps don't spam links
    const existing = await InviteLink.findOne({
      userId,
      channelId,
      used: false,
      expiresAt: { $gt: new Date(Date.now() + 60 * 1000) },
    }).sort({ expiresAt: -1 });
    if (existing) {
      return { link: existing.inviteLink, expiresAt: existing.expiresAt };
    }

    const expiresAt = new Date(Date.now() + USER_LINK_TTL_MINUTES * 60 * 1000);
    const inviteLinkObj = await api.createChatInviteLink(channelId, {
      name: `User_${userId}`.substring(0, 32),
      creates_join_request: true,
      expire_date: Math.floor(expiresAt.getTime() / 1000),
    });

    await InviteLink.create({
      userId,
      channelId,
      inviteLink: inviteLinkObj.invite_link,
      expiresAt,
    });

    return { link: inviteLinkObj.invite_link, expiresAt };
  }

  /**
   * Creates or resolves a normal direct channel link (public username or creates_join_request: false).
   * This link allows administrators and reviewers to preview channel content directly without sending a join request.
   */
  static async getOrCreateNormalChannelLink(
    botOrApi: Bot | Api | { api: Api },
    channelId: number,
    channelTitle: string,
    username?: string
  ): Promise<string> {
    if (username) {
      const cleanUser = username.replace(/^@/, '');
      return `https://t.me/${cleanUser}`;
    }

    const api: Api =
      'api' in botOrApi && (botOrApi as any).api
        ? ((botOrApi as any).api as Api)
        : (botOrApi as Api);

    try {
      const inviteLinkObj = await api.createChatInviteLink(channelId, {
        name: `Norm_${channelTitle.substring(0, 12).replace(/[^\w\s]/gi, '')}`,
        creates_join_request: false,
      });
      return inviteLinkObj.invite_link;
    } catch (error) {
      console.warn(
        `[LinkService] createChatInviteLink(creates_join_request: false) failed for ${channelId}, attempting exportChatInviteLink:`,
        error
      );
      try {
        const exported = await api.exportChatInviteLink(channelId);
        return exported;
      } catch (exportErr) {
        console.error(`[LinkService] Failed to export normal invite link for channel ${channelId}:`, exportErr);
        throw exportErr;
      }
    }
  }

  /**
   * Resolves a channel from a start payload.
   * Supports short 'inv_...' codes, prefix-less codes, and legacy fallbacks.
   */
  static async resolveChannelFromPayload(payload: string): Promise<IChannel | null> {
    if (!payload || !payload.trim()) return null;
    const cleanPayload = payload.trim();
    const approvedFilter = { status: { $in: ['approved', undefined] } };

    // 1. Direct match by startPayload (e.g. inv_bcibiv)
    let channel = await Channel.findOne({ startPayload: cleanPayload, ...approvedFilter });
    if (channel) return channel;

    // 2. Match with 'inv_' prepended if missing
    if (!cleanPayload.startsWith('inv_')) {
      channel = await Channel.findOne({ startPayload: `inv_${cleanPayload}`, ...approvedFilter });
      if (channel) return channel;
    }

    // 3. Fallback: legacy base64 decoding (for backwards compatibility)
    try {
      const buf = Buffer.from(cleanPayload, 'base64url');
      if (buf.length >= 14) {
        const decodedId = Number(buf.readBigInt64BE(6));
        channel = await Channel.findOne({ channelId: decodedId, ...approvedFilter });
        if (channel) return channel;
      }
    } catch {
      // Ignore binary parsing errors
    }

    // 4. Fallback: direct channel ID
    const numericId = parseInt(cleanPayload, 10);
    if (!isNaN(numericId)) {
      channel = await Channel.findOne({ channelId: numericId, ...approvedFilter });
      if (channel) return channel;
    }

    return null;
  }
}
