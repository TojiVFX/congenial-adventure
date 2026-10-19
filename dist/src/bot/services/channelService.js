"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelService = void 0;
const Channel_js_1 = require("../../db/models/Channel.js");
const linkService_js_1 = require("./linkService.js");
const channelCache = new Map();
const CHANNEL_CACHE_TTL_MS = 60 * 1000;
class ChannelService {
    /**
     * Invalidates in-memory channel cache
     */
    static invalidateChannelCache(channelId) {
        if (channelId) {
            channelCache.delete(channelId);
        }
        else {
            channelCache.clear();
        }
    }
    /**
     * Retrieves channel configuration with a 60s in-memory warm cache
     */
    static async getChannelCached(channelId) {
        const now = Date.now();
        const entry = channelCache.get(channelId);
        if (entry && entry.expiresAt > now) {
            return entry.channel;
        }
        const channel = await Channel_js_1.Channel.findOne({ channelId });
        channelCache.set(channelId, {
            channel,
            expiresAt: now + CHANNEL_CACHE_TTL_MS,
        });
        return channel;
    }
    /**
     * Helper to extract Api instance
     */
    static getApi(botOrApi) {
        return 'api' in botOrApi && botOrApi.api
            ? botOrApi.api
            : botOrApi;
    }
    /**
     * Validates that the bot is an admin in the channel and has required permissions
     */
    static async validateBotPermissions(botOrApi, channelId) {
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
        }
        catch (error) {
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
    static async addChannel(botOrApi, channelId, addedBy) {
        const validation = await this.validateBotPermissions(botOrApi, channelId);
        if (!validation.valid || !validation.title) {
            return { success: false, error: validation.error };
        }
        try {
            let channel = await Channel_js_1.Channel.findOne({ channelId });
            // Generate short clean start payload, Telegram join-request link, and normal preview link
            const startPayload = linkService_js_1.LinkService.generateStartPayload(8);
            const inviteLink = await linkService_js_1.LinkService.getOrCreateChannelInviteLink(botOrApi, channelId, validation.title);
            let normalLink;
            try {
                normalLink = await linkService_js_1.LinkService.getOrCreateNormalChannelLink(botOrApi, channelId, validation.title, validation.username);
            }
            catch {
                if (validation.username)
                    normalLink = `https://t.me/${validation.username.replace(/^@/, '')}`;
            }
            if (!channel) {
                channel = await Channel_js_1.Channel.create({
                    channelId,
                    title: validation.title,
                    username: validation.username,
                    normalLink,
                    inviteLink,
                    startPayload,
                    autoApproveEnabled: true,
                    status: 'approved',
                    welcomeMessage: '✨ Welcome to the channel! Your request has been approved.',
                    addedByUserId: addedBy?.id,
                    addedByUserName: addedBy?.name,
                    addedByUserUsername: addedBy?.username,
                });
            }
            else {
                channel.title = validation.title;
                channel.username = validation.username;
                channel.normalLink = normalLink;
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
            this.invalidateChannelCache(channelId);
            return { success: true, channel };
        }
        catch (err) {
            console.error(`[ChannelService] Error adding channel ${channelId}:`, err);
            return { success: false, error: err.message || 'Failed to save channel to database.' };
        }
    }
    /**
     * Submits a user's channel for admin approval (status: 'pending')
     * Generates a normal direct link for preview, NOT a join-request link.
     */
    static async submitUserChannel(botOrApi, channelId, user) {
        const validation = await this.validateBotPermissions(botOrApi, channelId);
        if (!validation.valid || !validation.title) {
            return { success: false, error: validation.error };
        }
        try {
            let channel = await Channel_js_1.Channel.findOne({ channelId });
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
                // Generate normal direct link for review (not a join-request link)
                let normalLink;
                try {
                    normalLink = await linkService_js_1.LinkService.getOrCreateNormalChannelLink(botOrApi, channelId, validation.title, validation.username);
                }
                catch {
                    if (validation.username) {
                        normalLink = `https://t.me/${validation.username.replace(/^@/, '')}`;
                    }
                }
                // If rejected, re-submit
                channel.status = 'pending';
                channel.title = validation.title;
                channel.username = validation.username;
                channel.normalLink = normalLink || channel.normalLink;
                channel.addedByUserId = user.id;
                channel.addedByUserName = user.name;
                channel.addedByUserUsername = user.username;
                await channel.save();
                this.invalidateChannelCache(channelId);
                return { success: true, channel };
            }
            const startPayload = linkService_js_1.LinkService.generateStartPayload(8);
            // Generate normal direct link for review (not a join-request link)
            let normalLink;
            try {
                normalLink = await linkService_js_1.LinkService.getOrCreateNormalChannelLink(botOrApi, channelId, validation.title, validation.username);
            }
            catch {
                if (validation.username) {
                    normalLink = `https://t.me/${validation.username.replace(/^@/, '')}`;
                }
            }
            channel = await Channel_js_1.Channel.create({
                channelId,
                title: validation.title,
                username: validation.username,
                normalLink,
                startPayload,
                autoApproveEnabled: true,
                status: 'pending',
                welcomeMessage: '✨ Welcome to the channel! Your request has been approved.',
                addedByUserId: user.id,
                addedByUserName: user.name,
                addedByUserUsername: user.username,
            });
            this.invalidateChannelCache(channelId);
            return { success: true, channel };
        }
        catch (err) {
            console.error(`[ChannelService] Error submitting channel ${channelId}:`, err);
            return { success: false, error: err.message || 'Failed to submit channel.' };
        }
    }
    /**
     * Checks if a user is already a member of the channel
     */
    static async isUserMember(botOrApi, channelId, userId) {
        const api = this.getApi(botOrApi);
        try {
            const member = await api.getChatMember(channelId, userId);
            return ['creator', 'administrator', 'member'].includes(member.status);
        }
        catch {
            return false;
        }
    }
}
exports.ChannelService = ChannelService;
