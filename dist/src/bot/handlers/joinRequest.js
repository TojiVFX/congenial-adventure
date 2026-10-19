"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChatJoinRequest = handleChatJoinRequest;
const Channel_js_1 = require("../../db/models/Channel.js");
const RequestLog_js_1 = require("../../db/models/RequestLog.js");
const InviteLink_js_1 = require("../../db/models/InviteLink.js");
const SystemError_js_1 = require("../../db/models/SystemError.js");
const channelService_js_1 = require("../services/channelService.js");
const loggerService_js_1 = require("../services/loggerService.js");
const html_js_1 = require("../utils/html.js");
async function handleChatJoinRequest(ctx) {
    const joinRequest = ctx.chatJoinRequest;
    if (!joinRequest)
        return;
    const chat = joinRequest.chat;
    const user = joinRequest.from;
    console.log(`[JoinRequest] Received from user ${user.id} (${user.first_name}) for channel ${chat.id} (${chat.title})`);
    // 1. Fast-Path Channel Lookup using 60s in-memory warm cache
    const channel = await channelService_js_1.ChannelService.getChannelCached(chat.id);
    // If channel is not registered or not approved, keep request pending
    if (!channel || channel.status !== 'approved') {
        console.log(`[JoinRequest] Channel ${chat.id} is not approved (status: ${channel?.status}). Request kept pending.`);
        await RequestLog_js_1.RequestLog.create({
            userId: user.id,
            userName: user.first_name,
            userUsername: user.username,
            channelId: chat.id,
            channelTitle: chat.title || 'Untitled Channel',
            status: 'pending',
            reason: channel ? `Channel status is ${channel.status}` : 'Channel not registered or approved by administrator',
        });
        return;
    }
    // 2. Personal link check: if the request came through a per-user expiring link,
    // only the user it was issued to may be approved.
    const usedLink = joinRequest.invite_link?.invite_link;
    let personalLinkRecord = null;
    if (usedLink) {
        personalLinkRecord = await InviteLink_js_1.InviteLink.findOne({ inviteLink: usedLink });
        if (personalLinkRecord && personalLinkRecord.userId !== user.id) {
            console.log(`[JoinRequest] Link issued to ${personalLinkRecord.userId} was used by ${user.id}. Request kept pending.`);
            await RequestLog_js_1.RequestLog.create({
                userId: user.id,
                userName: user.first_name,
                userUsername: user.username,
                channelId: chat.id,
                channelTitle: chat.title || 'Untitled Channel',
                status: 'pending',
                reason: 'Personal invite link was issued to a different user',
            });
            return;
        }
    }
    // Case 1: Auto-Approve is DISABLED
    if (!channel.autoApproveEnabled) {
        console.log(`[JoinRequest] Auto-approve is DISABLED for channel ${chat.id}. Request kept pending.`);
        await Promise.allSettled([
            Channel_js_1.Channel.updateOne({ channelId: chat.id }, { $inc: { totalRequests: 1 } }),
            RequestLog_js_1.RequestLog.create({
                userId: user.id,
                userName: user.first_name,
                userUsername: user.username,
                channelId: chat.id,
                channelTitle: chat.title || 'Untitled Channel',
                status: 'pending',
                reason: 'Auto-approve disabled by administrator',
            }),
            loggerService_js_1.LoggerService.logRequestPending(ctx, { id: user.id, firstName: user.first_name, username: user.username }, { id: chat.id, title: chat.title || 'Untitled' }),
        ]);
        return;
    }
    // Case 2: Auto-Approve is ENABLED (Fast-Path Telegram Approval)
    try {
        await ctx.approveChatJoinRequest(user.id);
        console.log(`[JoinRequest] Approved user ${user.id} for channel ${chat.id}`);
        // Non-blocking concurrent execution of DB logs, DM, audit log, and personal link cleanup
        const tasks = [
            // 1. Atomic DB stats & audit log
            Channel_js_1.Channel.updateOne({ channelId: chat.id }, { $inc: { totalRequests: 1, totalApproved: 1 } }),
            RequestLog_js_1.RequestLog.create({
                userId: user.id,
                userName: user.first_name,
                userUsername: user.username,
                channelId: chat.id,
                channelTitle: chat.title || 'Untitled Channel',
                status: 'approved',
            }),
        ];
        // 2. Personal link revocation (if applicable)
        if (personalLinkRecord && usedLink) {
            tasks.push(InviteLink_js_1.InviteLink.updateOne({ inviteLink: usedLink }, { used: true }), ctx.api.revokeChatInviteLink(chat.id, usedLink).catch(err => {
                console.warn(`[JoinRequest] Could not revoke personal link for ${user.id}:`, err?.message || err);
            }));
        }
        // 3. Welcome Message in private chat (non-blocking, suppressed if user hasn't started bot)
        tasks.push((async () => {
            try {
                const welcome = channel.welcomeMessage ||
                    `✨ <b>Request Approved!</b>\n\n` +
                        `Hello ${(0, html_js_1.escapeHtml)(user.first_name)}, your request to join <b>${(0, html_js_1.escapeHtml)(chat.title || 'the community')}</b> has been approved. Welcome aboard!`;
                await ctx.api.sendMessage(user.id, welcome, { parse_mode: 'HTML' });
            }
            catch (dmErr) {
                // Telegram prohibits bots from sending DMs if user hasn't started the bot in private
                const msg = dmErr?.description || dmErr?.message || '';
                if (!/bot was blocked|user is deactivated|chat not found|can't initiate/i.test(msg)) {
                    console.warn(`[JoinRequest] Could not send welcome DM to ${user.id}:`, msg);
                }
            }
        })());
        // 4. Audit Log notification
        tasks.push(loggerService_js_1.LoggerService.logRequestApproved(ctx, { id: user.id, firstName: user.first_name, username: user.username }, { id: chat.id, title: chat.title || 'Untitled' }));
        await Promise.allSettled(tasks);
    }
    catch (error) {
        const errorMsg = error?.description || error?.message || '';
        // Handle benign / already-resolved edge cases
        if (/USER_ALREADY_PARTICIPANT/i.test(errorMsg)) {
            console.log(`[JoinRequest] User ${user.id} is already in channel ${chat.id}`);
            await RequestLog_js_1.RequestLog.create({
                userId: user.id,
                userName: user.first_name,
                userUsername: user.username,
                channelId: chat.id,
                channelTitle: chat.title || 'Untitled Channel',
                status: 'approved',
                reason: 'User already participant',
            });
            return;
        }
        if (/HIDE_REQUESTER_MISSING|request.*(not found|missing)/i.test(errorMsg)) {
            console.log(`[JoinRequest] Join request for user ${user.id} no longer exists.`);
            return;
        }
        // Critical Error: Bot lacks permissions or was kicked
        console.error(`[JoinRequest] Failed to approve user ${user.id} in channel ${chat.id}:`, errorMsg);
        (0, SystemError_js_1.recordSystemError)(error, `JoinRequest: user ${user.id} in channel ${chat.id}`).catch(() => { });
        if (/not enough rights|CHAT_ADMIN_REQUIRED|rights to invite|administrator/i.test(errorMsg)) {
            loggerService_js_1.LoggerService.logCriticalError(ctx, 'Permission Error: Bot Lacks Channel Rights', `Bot is missing "Invite Users via Link" permission to approve join requests.\nError: ${errorMsg}`, {
                channel: { id: chat.id, title: chat.title || 'Untitled Channel' },
                user: { id: user.id, name: user.first_name },
            }).catch(() => { });
        }
        await RequestLog_js_1.RequestLog.create({
            userId: user.id,
            userName: user.first_name,
            userUsername: user.username,
            channelId: chat.id,
            channelTitle: chat.title || 'Untitled Channel',
            status: 'pending',
            reason: `Approval failed: ${errorMsg}`,
        });
    }
}
