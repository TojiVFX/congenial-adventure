import { Context } from 'grammy';
import { Channel } from '../../db/models/Channel.js';
import { RequestLog } from '../../db/models/RequestLog.js';
import { LoggerService } from '../services/loggerService.js';
import { LinkService } from '../services/linkService.js';

export async function handleChatJoinRequest(ctx: Context): Promise<void> {
  const joinRequest = ctx.chatJoinRequest;
  if (!joinRequest) return;

  const chat = joinRequest.chat;
  const user = joinRequest.from;

  console.log(`[JoinRequest] Received from user ${user.id} (${user.first_name}) for channel ${chat.id} (${chat.title})`);

  let channel = await Channel.findOne({ channelId: chat.id });

  // If channel is not yet registered in DB, register it with default settings
  if (!channel) {
    channel = await Channel.create({
      channelId: chat.id,
      title: chat.title || 'Untitled Channel',
      username: chat.username,
      startPayload: LinkService.generateStartPayload(8),
      autoApproveEnabled: true,
      welcomeMessage: '✨ Welcome! Your request has been approved.',
    });
  }

  // Update total request count
  channel.totalRequests = (channel.totalRequests || 0) + 1;

  // Case 1: Auto-Approve is DISABLED
  if (!channel.autoApproveEnabled) {
    console.log(`[JoinRequest] Auto-approve is DISABLED for channel ${chat.id}. Request kept pending.`);

    await RequestLog.create({
      userId: user.id,
      userName: user.first_name,
      userUsername: user.username,
      channelId: chat.id,
      channelTitle: chat.title || 'Untitled Channel',
      status: 'pending',
      reason: 'Auto-approve disabled by administrator',
    });

    await channel.save();

    // Log to audit log channel
    ctx.api && LoggerService.logRequestPending(
      ctx as any,
      { id: user.id, firstName: user.first_name, username: user.username },
      { id: chat.id, title: chat.title || 'Untitled' }
    );
    return;
  }

  // Case 2: Auto-Approve is ENABLED
  try {
    await ctx.approveChatJoinRequest(user.id);
    console.log(`[JoinRequest] Approved user ${user.id} for channel ${chat.id}`);

    channel.totalApproved = (channel.totalApproved || 0) + 1;
    await channel.save();

    // Record in RequestLog
    await RequestLog.create({
      userId: user.id,
      userName: user.first_name,
      userUsername: user.username,
      channelId: chat.id,
      channelTitle: chat.title || 'Untitled Channel',
      status: 'approved',
    });

    // Send Welcome Message in private chat to user (if permitted by Telegram)
    try {
      const welcome = channel.welcomeMessage ||
        `✨ <b>Request Approved!</b>\n\n` +
        `Hello ${escapeHtml(user.first_name)}, your request to join <b>${escapeHtml(chat.title || 'the community')}</b> has been approved. Welcome aboard!`;
      await ctx.api.sendMessage(user.id, welcome, { parse_mode: 'HTML' });
    } catch (dmError) {
      // Telegram does not allow bots to DM users who haven't started the bot yet
      console.log(`[JoinRequest] Could not send welcome DM to ${user.id}: User has not started bot in private.`);
    }

    // Log to audit log channel
    ctx.api && LoggerService.logRequestApproved(
      ctx as any,
      { id: user.id, firstName: user.first_name, username: user.username },
      { id: chat.id, title: chat.title || 'Untitled' }
    );
  } catch (error) {
    console.error(`[JoinRequest] Failed to approve user ${user.id} in channel ${chat.id}:`, error);
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
