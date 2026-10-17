import { Bot, Api } from 'grammy';
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
   * Helper to extract Api instance
   */
  private static getApi(botOrApi: Bot | Api | { api: Api }): Api {
    return 'api' in botOrApi && botOrApi.api
      ? (botOrApi.api as Api)
      : (botOrApi as Api);
  }

  /**
   * Validates that the bot is an admin in the channel and has required permissions
   */
  static async validateBotPermissions(
    botOrApi: Bot | Api | { api: Api },
    channelId: number
  ): Promise<ChannelValidationResult> {
    const api = this.getApi(botOrApi);
    try {
      const chat = await api.getChat(channelId);

      // Verify that it's a channel or supergroup
      if (chat.type !== 'channel' && chat.type !== 'supergroup') {
        return { valid: false, error: 'Target must be a Telegram Channel or Supergroup.' };
      }

      const me = await api.getMe();
      const botMember = await api.getChatMember(channelId, me.id);

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
   * Adds or registers a channel in the database and generates its links (admin direct add)
   */
  static async addChannel(
    bot: Bot,
    channelId: number,
    addedBy?: { id: number; name: string; username?: string }
  ): Promise<{ success: boolean; channel?: IChannel; error?: string }> {
    const validation = await this.validateBotPermissions(bot, channelId);
    if (!validation.valid || !validation.title) {
      return { success: false, error: validation.error };
    }

    try {
      let channel = await Channel.findOne({ channelId });

      // Generate short clean start payload and Telegram invite link
      const startPayload = LinkService.generateStartPayload(8);
      const inviteLink = await LinkService.getOrCreateChannelInviteLink(bot, channelId, validation.title);

      if (!channel) {
        channel = await Channel.create({
          channelId,
          title: validation.title,
          username: validation.username,
          inviteLink,
          startPayload,
          autoApproveEnabled: true,
          status: 'approved',
          welcomeMessage: '✨ Welcome to the channel! Your request has been approved.',
          addedByUserId: addedBy?.id,
          addedByUserName: addedBy?.name,
          addedByUserUsername: addedBy?.username,
        });
      } else {
        channel.title = validation.title;
        channel.username = validation.username;
        channel.inviteLink = inviteLink;
        channel.status = 'approved';
        if (addedBy) {
          channel.addedByUserId = addedBy.id;
          channel.addedByUserName = addedBy.name;
          channel.addedByUserUsername = addedBy.username;
        }
        if (!channel.startPayload || !channel.startPayload.startsWith('inv_')) {
          channel.startPayload = startPayload;
        }
        await channel.save();
      }

      return { success: true, channel };
    } catch (err: any) {
      console.error(`[ChannelService] Error adding channel ${channelId}:`, err);
      return { success: false, error: err.message || 'Failed to save channel to database.' };
    }
  }

  /**
   * Submits a user's channel for admin approval (status: 'pending')
   */
  static async submitUserChannel(
    botOrApi: Bot | Api | { api: Api },
    channelId: number,
    user: { id: number; name: string; username?: string }
  ): Promise<{ success: boolean; channel?: IChannel; error?: string }> {
    const validation = await this.validateBotPermissions(botOrApi, channelId);
    if (!validation.valid || !validation.title) {
      return { success: false, error: validation.error };
    }

    try {
      let channel = await Channel.findOne({ channelId });

      if (channel) {
        if (channel.status === 'approved') {
          return { success: false, error: 'This channel is already registered and approved.' };
        }
        if (channel.status === 'pending') {
          return {
            success: false,
            error: 'This channel has already been submitted and is currently pending administrator review.',
          };
        }
        // If rejected, re-submit
        channel.status = 'pending';
        channel.title = validation.title;
        channel.username = validation.username;
        channel.addedByUserId = user.id;
        channel.addedByUserName = user.name;
        channel.addedByUserUsername = user.username;
        if (!channel.inviteLink) {
          try {
            channel.inviteLink = await LinkService.getOrCreateChannelInviteLink(botOrApi, channelId, validation.title);
          } catch {
            if (validation.username) channel.inviteLink = `https://t.me/${validation.username}`;
          }
        }
        await channel.save();
        return { success: true, channel };
      }

      const startPayload = LinkService.generateStartPayload(8);
      let inviteLink: string | undefined;
      try {
        inviteLink = await LinkService.getOrCreateChannelInviteLink(botOrApi, channelId, validation.title);
      } catch {
        if (validation.username) inviteLink = `https://t.me/${validation.username}`;
      }

      channel = await Channel.create({
        channelId,
        title: validation.title,
        username: validation.username,
        inviteLink,
        startPayload,
        autoApproveEnabled: true,
        status: 'pending',
        welcomeMessage: '✨ Welcome to the channel! Your request has been approved.',
        addedByUserId: user.id,
        addedByUserName: user.name,
        addedByUserUsername: user.username,
      });

      return { success: true, channel };
    } catch (err: any) {
      console.error(`[ChannelService] Error submitting channel ${channelId}:`, err);
      return { success: false, error: err.message || 'Failed to submit channel.' };
    }
  }

  /**
   * Checks if a user is already a member of the channel
   */
  static async isUserMember(
    botOrApi: Bot | Api | { api: Api },
    channelId: number,
    userId: number
  ): Promise<boolean> {
    const api = this.getApi(botOrApi);
    try {
      const member = await api.getChatMember(channelId, userId);
      return ['creator', 'administrator', 'member'].includes(member.status);
    } catch {
      return false;
    }
  }
}
