import crypto from 'crypto';
import { Bot } from 'grammy';
import { Channel, IChannel } from '../../db/models/Channel.js';

export class LinkService {
  /**
   * Generates a unique, URL-safe start payload string resembling Telegram file IDs / tokens
   * (e.g. BQADAQADfQ8AAtFDkEYjVw5S-EXRHhYE)
   */
  static generateStartPayload(channelId: number): string {
    // Pack channelId and random bytes in a format that produces strings like BQADAQ...
    const prefix = Buffer.from([0x05, 0x00, 0x03, 0x01, 0x00, 0x03]); // Telegram-like header bytes
    const idBuffer = Buffer.alloc(8);
    // Write BigInt channel ID (handles negative 64-bit Telegram IDs like -100xxxxxxxxxx)
    idBuffer.writeBigInt64BE(BigInt(channelId));
    const randomSuffix = crypto.randomBytes(8);

    const fullBuffer = Buffer.concat([prefix, idBuffer, randomSuffix]);
    return fullBuffer.toString('base64url');
  }

  /**
   * Generates a Telegram Deep-Link for the bot with a given payload
   * e.g. https://t.me/BotUsername?start=BQADAQADfQ8AAtFDkEYjVw5S-EXRHhYE
   */
  static getBotDeepLink(botUsername: string, startPayload: string): string {
    return `https://t.me/${botUsername}?start=${startPayload}`;
  }

  /**
   * Creates or retrieves a Telegram channel join-request invite link
   * (creates_join_request: true)
   */
  static async getOrCreateChannelInviteLink(
    bot: Bot,
    channelId: number,
    channelTitle: string
  ): Promise<string> {
    try {
      const inviteLinkObj = await bot.api.createChatInviteLink(channelId, {
        name: `AutoApprove_${channelTitle.substring(0, 15)}`,
        creates_join_request: true,
      });
      return inviteLinkObj.invite_link;
    } catch (error) {
      console.error(`[LinkService] Failed to create invite link for channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Resolves a channel from a start payload.
   * Looks up by direct payload match or decodes the embedded channelId.
   */
  static async resolveChannelFromPayload(payload: string): Promise<IChannel | null> {
    if (!payload || !payload.trim()) return null;

    // 1. Direct match by startPayload in DB
    let channel = await Channel.findOne({ startPayload: payload });
    if (channel) return channel;

    // 2. Fallback: try decoding binary payload
    try {
      const buf = Buffer.from(payload, 'base64url');
      if (buf.length >= 14) {
        // Offset 6 is where the 8-byte channelId is written
        const decodedId = Number(buf.readBigInt64BE(6));
        channel = await Channel.findOne({ channelId: decodedId });
        if (channel) return channel;
      }
    } catch {
      // Not a binary payload, ignore
    }

    // 3. Fallback: direct channelId passed in payload
    const numericId = parseInt(payload, 10);
    if (!isNaN(numericId)) {
      channel = await Channel.findOne({ channelId: numericId });
      if (channel) return channel;
    }

    return null;
  }
}
