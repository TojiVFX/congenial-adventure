import { Bot } from 'grammy';
import { Channel, IChannel } from '../../db/models/Channel.js';
import { LinkService } from './linkService.js';

export interface ChannelValidationResult {
  valid: boolean;
  error?: string;
  title?: string;
  username?: string;
}

export class ChannelService {
  /**
   * Validates that the bot is an admin in the channel and has required permissions
   */
  static async validateBotPermissions(bot: Bot, channelId: number): Promise<ChannelValidationResult> {
    try {
      const chat = await bot.api.getChat(channelId);

      // Verify that it's a channel or supergroup
      if (chat.type !== 'channel' && chat.type !== 'supergroup') {
        return { valid: false, error: 'Target must be a Telegram Channel or Supergroup.' };
      }

      const me = await bot.api.getMe();
      const botMember = await bot.api.getChatMember(channelId, me.id);

      if (botMember.status !== 'administrator') {
        return {
          valid: false,
          error: 'Bot is not an Administrator in this channel. Please promote the bot to Admin with "Invite Users via Link" rights.',
        };
      }

      // Check specific permission
      if (!botMember.can_invite_users) {
        return {
          valid: false,
          error: 'Bot is missing the "Invite Users via Link" / "Add Users" permission in this channel.',
        };
      }

      return {
        valid: true,
        title: chat.title || 'Untitled Channel',
        username: chat.username,
      };
    } catch (error: any) {
      console.error(`[ChannelService] Permission check error for ${channelId}:`, error);
      return {
        valid: false,
        error: error.message || 'Failed to inspect channel. Ensure bot was added to the channel as admin.',
      };
    }
  }

  /**
   * Adds or registers a channel in the database and generates its links
   */
  static async addChannel(
    bot: Bot,
    channelId: number
  ): Promise<{ success: boolean; channel?: IChannel; error?: string }> {
    const validation = await this.validateBotPermissions(bot, channelId);
    if (!validation.valid || !validation.title) {
      return { success: false, error: validation.error };
    }

    try {
      let channel = await Channel.findOne({ channelId });

      // Generate start payload and Telegram invite link
      const startPayload = LinkService.generateStartPayload(channelId);
      const inviteLink = await LinkService.getOrCreateChannelInviteLink(bot, channelId, validation.title);

      if (!channel) {
        channel = await Channel.create({
          channelId,
          title: validation.title,
          username: validation.username,
          inviteLink,
          startPayload,
          autoApproveEnabled: true,
          welcomeMessage: '🎉 Welcome to the channel! Your request has been approved.',
        });
      } else {
        channel.title = validation.title;
        channel.username = validation.username;
        channel.inviteLink = inviteLink;
        if (!channel.startPayload) channel.startPayload = startPayload;
        await channel.save();
      }

      return { success: true, channel };
    } catch (err: any) {
      console.error(`[ChannelService] Error adding channel ${channelId}:`, err);
      return { success: false, error: err.message || 'Failed to save channel to database.' };
    }
  }

  /**
   * Checks if a user is already a member of the channel
   */
  static async isUserMember(bot: Bot, channelId: number, userId: number): Promise<boolean> {
    try {
      const member = await bot.api.getChatMember(channelId, userId);
      return ['creator', 'administrator', 'member'].includes(member.status);
    } catch {
      return false;
    }
  }
}
