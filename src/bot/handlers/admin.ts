import { Context, Bot } from 'grammy';
import { config } from '../../config.js';
import { Channel } from '../../db/models/Channel.js';
import { User } from '../../db/models/User.js';
import { RequestLog } from '../../db/models/RequestLog.js';
import {
  getGlobalSettings,
  getAdminSession,
  setAdminSession,
  clearAdminSession,
} from '../../db/models/Settings.js';
import { AdminKeyboards } from '../keyboards/adminKeyboards.js';
import { ChannelService } from '../services/channelService.js';
import { LinkService } from '../services/linkService.js';
import { LoggerService } from '../services/loggerService.js';
import { updateBotCommands } from '../services/commandService.js';

export async function isAdmin(userId: number): Promise<boolean> {
  if (config.adminIds.includes(userId)) return true;
  try {
    const settings = await getGlobalSettings();
    return settings.admins.includes(userId);
  } catch {
    return false;
  }
}

/**
 * Renders the main dashboard text
 */
export async function getDashboardText(): Promise<string> {
  const [totalUsers, totalChannels, totalApproved, totalPending] = await Promise.all([
    User.countDocuments(),
    Channel.countDocuments(),
    RequestLog.countDocuments({ status: 'approved' }),
    RequestLog.countDocuments({ status: 'pending' }),
  ]);

  return (
    `🛡️ <b>Control Dashboard | Auto-Approval System</b>\n\n` +
    `📊 <b>System Overview:</b>\n` +
    `• <b>Registered Users:</b> <code>${totalUsers}</code>\n` +
    `• <b>Connected Channels:</b> <code>${totalChannels}</code>\n` +
    `• <b>Total Requests:</b> <code>${totalApproved + totalPending}</code>\n` +
    `• <b>Instant Approvals:</b> <code>${totalApproved}</code>\n` +
    `• <b>Pending Review:</b> <code>${totalPending}</code>\n\n` +
    `Select an option below to manage channels, copy short links, or broadcast:`
  );
}

/**
 * /admin command entry point
 */
export async function handleAdminCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from || !(await isAdmin(from.id))) {
    await ctx.reply('⛔ <b>Access Denied</b>: You are not authorized to use the admin dashboard.', {
      parse_mode: 'HTML',
    });
    return;
  }

  // Clear any existing session
  await clearAdminSession(from.id);

  const text = await getDashboardText();
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: AdminKeyboards.mainMenu(),
  });
}

/**
 * Handle Dashboard Callback Queries
 */
export async function handleAdminCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const from = ctx.from;
  if (!data || !from || !(await isAdmin(from.id))) {
    await ctx.answerCallbackQuery({ text: 'Access denied.' });
    return;
  }

  await ctx.answerCallbackQuery();

  // 1. Dashboard Home
  if (data === 'admin_home' || data === 'admin_refresh') {
    await clearAdminSession(from.id);
    const text = await getDashboardText();
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: AdminKeyboards.mainMenu(),
    });
    return;
  }

  // 2. Statistics & Analytics
  if (data === 'admin_stats') {
    const [totalUsers, totalChannels, totalRequests, totalApproved, totalPending, recentLogs] =
      await Promise.all([
        User.countDocuments(),
        Channel.countDocuments(),
        RequestLog.countDocuments(),
        RequestLog.countDocuments({ status: 'approved' }),
        RequestLog.countDocuments({ status: 'pending' }),
        RequestLog.find().sort({ createdAt: -1 }).limit(5),
      ]);

    const approvalRate =
      totalRequests > 0 ? ((totalApproved / totalRequests) * 100).toFixed(1) : '0';

    let statsText =
      `📊 <b>Detailed Bot Analytics</b>\n\n` +
      `• <b>Total Registered Users:</b> <code>${totalUsers}</code>\n` +
      `• <b>Active Channels:</b> <code>${totalChannels}</code>\n` +
      `• <b>Total Join Requests:</b> <code>${totalRequests}</code>\n` +
      `• <b>✅ Approved:</b> <code>${totalApproved}</code> (${approvalRate}%)\n` +
      `• <b>⏸️ Pending:</b> <code>${totalPending}</code>\n\n` +
      `🕒 <b>Recent Actions:</b>\n`;

    if (recentLogs.length === 0) {
      statsText += `<i>No requests recorded yet.</i>\n`;
    } else {
      for (const log of recentLogs) {
        const icon = log.status === 'approved' ? '🟢' : '🟡';
        statsText += `${icon} <b>${escapeHtml(log.userName)}</b> in <i>${escapeHtml(log.channelTitle)}</i> [${log.status}]\n`;
      }
    }

    await ctx.editMessageText(statsText, {
      parse_mode: 'HTML',
      reply_markup: AdminKeyboards.backToHome(),
    });
    return;
  }

  // 3. Channels List
  if (data === 'admin_channels') {
    await clearAdminSession(from.id);
    const channels = await Channel.find().sort({ createdAt: -1 });

    if (channels.length === 0) {
      await ctx.editMessageText(
        `📢 <b>Channel Management</b>\n\nNo channels have been connected yet.\nClick <b>Add New Channel</b> to connect your first channel.`,
        {
          parse_mode: 'HTML',
          reply_markup: AdminKeyboards.channelListMenu([]),
        }
      );
      return;
    }

    await ctx.editMessageText(
      `📢 <b>Connected Channels (${channels.length})</b>\n\nClick on any channel below to view settings, copy links, or toggle auto-approval:`,
      {
        parse_mode: 'HTML',
        reply_markup: AdminKeyboards.channelListMenu(channels),
      }
    );
    return;
  }

  // 4. View Single Channel Details
  if (data.startsWith('channel_view_')) {
    const channelId = parseInt(data.replace('channel_view_', ''), 10);
    const channel = await Channel.findOne({ channelId });

    if (!channel) {
      await ctx.editMessageText('⚠️ Channel not found.', {
        reply_markup: AdminKeyboards.backToChannels(),
      });
      return;
    }

    // Auto-upgrade legacy or missing payload to clean short inv_ format
    if (!channel.startPayload || !channel.startPayload.startsWith('inv_')) {
      channel.startPayload = LinkService.generateStartPayload(8);
      await channel.save();
    }

    const me = await ctx.api.getMe();
    const deepLink = LinkService.getBotDeepLink(me.username || '', channel.startPayload);
    const statusText = channel.autoApproveEnabled ? '✅ <b>Active (ON)</b>' : '⏸️ <b>Disabled (OFF)</b>';

    const text =
      `📢 <b>Channel: ${escapeHtml(channel.title)}</b>\n\n` +
      `• <b>Channel ID:</b> <code>${channel.channelId}</code>\n` +
      `• <b>Username:</b> ${channel.username ? `@${channel.username}` : '<i>Private</i>'}\n` +
      `• <b>Auto-Approve:</b> ${statusText}\n` +
      `• <b>Total Requests:</b> <code>${channel.totalRequests || 0}</code>\n` +
      `• <b>Approved:</b> <code>${channel.totalApproved || 0}</code>\n\n` +
      `🔗 <b>Short Bot Deep-Link:</b>\n<code>${deepLink}</code>\n\n` +
      `📨 <b>Direct Channel Link:</b>\n<code>${channel.inviteLink || 'Not generated'}</code>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: AdminKeyboards.channelDetailMenu(channel),
    });
    return;
  }

  // 5. Toggle Auto-Approve for Channel
  if (data.startsWith('toggle_approve_')) {
    const channelId = parseInt(data.replace('toggle_approve_', ''), 10);
    const channel = await Channel.findOne({ channelId });
    if (!channel) return;

    channel.autoApproveEnabled = !channel.autoApproveEnabled;
    await channel.save();

    // Log the toggle change
    LoggerService.logChannelAction(
      ctx as any,
      channel.autoApproveEnabled ? 'Auto-Approve Enabled' : 'Auto-Approve Disabled',
      { id: channel.channelId, title: channel.title },
      from.id
    );

    // Refresh view
    const me = await ctx.api.getMe();
    const deepLink = LinkService.getBotDeepLink(me.username || '', channel.startPayload);
    const statusText = channel.autoApproveEnabled ? '✅ <b>Active (ON)</b>' : '⏸️ <b>Disabled (OFF)</b>';

    const text =
      `📢 <b>Channel: ${escapeHtml(channel.title)}</b>\n\n` +
      `• <b>Channel ID:</b> <code>${channel.channelId}</code>\n` +
      `• <b>Username:</b> ${channel.username ? `@${channel.username}` : '<i>Private</i>'}\n` +
      `• <b>Auto-Approve:</b> ${statusText}\n` +
      `• <b>Total Requests:</b> <code>${channel.totalRequests || 0}</code>\n` +
      `• <b>Approved:</b> <code>${channel.totalApproved || 0}</code>\n\n` +
      `🔗 <b>Short Bot Deep-Link:</b>\n<code>${deepLink}</code>\n\n` +
      `📨 <b>Direct Channel Link:</b>\n<code>${channel.inviteLink || 'Not generated'}</code>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: AdminKeyboards.channelDetailMenu(channel),
    });
    return;
  }

  // 6. View / Copy Links for Channel
  if (data.startsWith('view_links_')) {
    const channelId = parseInt(data.replace('view_links_', ''), 10);
    const channel = await Channel.findOne({ channelId });
    if (!channel) return;

    if (!channel.startPayload || !channel.startPayload.startsWith('inv_')) {
      channel.startPayload = LinkService.generateStartPayload(8);
      await channel.save();
    }

    const me = await ctx.api.getMe();
    const deepLink = LinkService.getBotDeepLink(me.username || '', channel.startPayload);

    const text =
      `🔗 <b>Shareable Links for ${escapeHtml(channel.title)}</b>\n\n` +
      `1️⃣ <b>Short Bot Deep-Link (Recommended):</b>\n` +
      `<code>${deepLink}</code>\n` +
      `<i>👉 Directs user to start the bot, records them, and guides them to request entry.</i>\n\n` +
      `2️⃣ <b>Direct Channel Request Link:</b>\n` +
      `<code>${channel.inviteLink || 'Not available'}</code>\n` +
      `<i>👉 Directly opens the channel request popup.</i>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: AdminKeyboards.linksMenu(channel.channelId),
    });
    return;
  }

  // Regenerate Short Link for Channel
  if (data.startsWith('regen_link_')) {
    const channelId = parseInt(data.replace('regen_link_', ''), 10);
    const channel = await Channel.findOne({ channelId });
    if (!channel) return;

    // Generate fresh short code (inv_xxxxxxxx)
    channel.startPayload = LinkService.generateStartPayload(8);
    await channel.save();

    const me = await ctx.api.getMe();
    const deepLink = LinkService.getBotDeepLink(me.username || '', channel.startPayload);

    const text =
      `✨ <b>Fresh Short Link Generated!</b>\n\n` +
      `📢 <b>Channel:</b> <b>${escapeHtml(channel.title)}</b>\n\n` +
      `1️⃣ <b>Short Bot Deep-Link (Click to copy):</b>\n` +
      `<code>${deepLink}</code>\n\n` +
      `2️⃣ <b>Direct Channel Request Link:</b>\n` +
      `<code>${channel.inviteLink || 'Not available'}</code>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: AdminKeyboards.linksMenu(channel.channelId),
    });
    return;
  }

  // 7. Edit Welcome Message
  if (data.startsWith('edit_welcome_')) {
    const channelId = parseInt(data.replace('edit_welcome_', ''), 10);
    const channel = await Channel.findOne({ channelId });
    if (!channel) return;

    await setAdminSession(from.id, 'WAITING_WELCOME_MSG', { channelId });

    await ctx.reply(
      `✏️ <b>Edit Welcome Message for ${escapeHtml(channel.title)}</b>\n\n` +
      `Current Welcome Message:\n` +
      `<blockquote>${escapeHtml(channel.welcomeMessage || 'None')}</blockquote>\n\n` +
      `Please reply with the new welcome message text (HTML supported).\nSend /cancel to abort.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 8. Delete Channel
  if (data.startsWith('delete_channel_')) {
    const channelId = parseInt(data.replace('delete_channel_', ''), 10);
    const channel = await Channel.findOneAndDelete({ channelId });

    if (channel) {
      LoggerService.logChannelAction(
        ctx as any,
        'Channel Removed',
        { id: channel.channelId, title: channel.title },
        from.id
      );
    }

    await ctx.editMessageText('✅ Channel has been removed successfully.', {
      reply_markup: AdminKeyboards.backToChannels(),
    });
    return;
  }

  // 9. Add Channel Prompt
  if (data === 'admin_add_channel') {
    await setAdminSession(from.id, 'WAITING_CHANNEL_ID');
    await ctx.reply(
      `➕ <b>Add Channel Setup</b>\n\n` +
      `1. Make sure to add this bot to your Channel/Group as an <b>Administrator</b>.\n` +
      `2. Grant the bot permission: <b>"Invite Users via Link"</b>.\n` +
      `3. Now, send the <b>Channel ID</b> (e.g. <code>-1001234567890</code>) OR simply <b>forward any post</b> from that channel here.\n\n` +
      `Send /cancel to return.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 10. Link Center (Quick generate)
  if (data === 'admin_gen_link') {
    const channels = await Channel.find();
    if (channels.length === 0) {
      await ctx.editMessageText(
        '⚠️ You have not added any channels yet. Please add a channel first to generate links.',
        { reply_markup: AdminKeyboards.backToHome() }
      );
      return;
    }

    await ctx.editMessageText(
      '🔗 <b>Link Center</b>\n\nSelect a channel below to view or generate its links:',
      {
        parse_mode: 'HTML',
        reply_markup: AdminKeyboards.channelListMenu(channels),
      }
    );
    return;
  }

  // 11. Log Channel Settings
  if (data === 'admin_log_settings') {
    const currentLogId = await LoggerService.getLogChannelId();
    const statusText = currentLogId ? `<code>${currentLogId}</code>` : '<i>Not configured</i>';

    const text =
      `📋 <b>Log Channel Settings</b>\n\n` +
      `• <b>Current Log Channel:</b> ${statusText}\n\n` +
      `All user arrivals, join requests, auto-approvals, and administrative actions are logged in this channel in real time.\n\n` +
      `To configure a Log Channel, add the bot to your private log channel as admin, then click <b>Set / Change Log Channel</b>.`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: AdminKeyboards.logChannelMenu(!!currentLogId),
    });
    return;
  }

  // 12. Test Log Channel
  if (data === 'test_log_channel') {
    const currentLogId = await LoggerService.getLogChannelId();
    if (!currentLogId) {
      await ctx.reply('⚠️ No log channel configured.');
      return;
    }

    try {
      await ctx.api.sendMessage(
        currentLogId,
        `🧪 <b>Test Log Record</b>\n\n` +
        `• <b>Triggered By:</b> <a href="tg://user?id=${from.id}">${escapeHtml(from.first_name)}</a> (<code>${from.id}</code>)\n` +
        `• <b>Status:</b> ✅ Log delivery is working perfectly!`,
        { parse_mode: 'HTML' }
      );
      await ctx.reply('✅ Test log successfully sent to log channel!');
    } catch (err: any) {
      await ctx.reply(`❌ Failed to send test log: ${err.message}`);
    }
    return;
  }

  // 13. Set Log Channel Prompt
  if (data === 'set_log_channel') {
    await setAdminSession(from.id, 'WAITING_LOG_CHANNEL_ID');
    await ctx.reply(
      `📋 <b>Set Log Channel</b>\n\n` +
      `1. Add this bot to your Log Channel as an Administrator with <b>"Send Messages"</b> permission.\n` +
      `2. Send the <b>Log Channel ID</b> (e.g. <code>-1001234567890</code>) or <b>forward a post</b> from the log channel here.\n\n` +
      `Send /cancel to return.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 14. Broadcast Prompt
  if (data === 'admin_broadcast') {
    const userCount = await User.countDocuments();
    await setAdminSession(from.id, 'WAITING_BROADCAST_MSG');
    await ctx.reply(
      `📣 <b>Broadcast Message</b>\n\n` +
      `Total audience: <b>${userCount} users</b>.\n\n` +
      `Please reply with the message you would like to broadcast (text, photo, markdown, HTML supported).\nSend /cancel to abort.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 15. Auto-Update / Sync Telegram Commands
  if (data === 'admin_sync_commands') {
    const res = await updateBotCommands(ctx.api as any);
    if (res.success) {
      await ctx.reply(`✅ <b>Telegram Command Menu Updated!</b>\n\n${res.count} commands have been registered with Telegram and will now appear in the command menu for all users.`, {
        parse_mode: 'HTML',
        reply_markup: AdminKeyboards.backToHome(),
      });
    } else {
      await ctx.reply(`❌ <b>Failed to update commands:</b> ${res.error}`, {
        reply_markup: AdminKeyboards.backToHome(),
      });
    }
    return;
  }
}

/**
 * Handles incoming admin text/forward inputs according to session state
 */
export async function handleAdminInput(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  const text = ctx.message?.text?.trim();

  if (!from || !(await isAdmin(from.id))) return false;

  const session = await getAdminSession(from.id);
  if (!session) return false;

  // Handle cancel command
  if (text === '/cancel') {
    await clearAdminSession(from.id);
    await ctx.reply('❌ Action cancelled.', { reply_markup: AdminKeyboards.backToHome() });
    return true;
  }

  // State: WAITING_CHANNEL_ID
  if (session.state === 'WAITING_CHANNEL_ID') {
    let targetChannelId: number | undefined;

    // Check forwarded channel post
    const forwardChat = ctx.message?.forward_origin;
    if (forwardChat && forwardChat.type === 'channel' && forwardChat.chat) {
      targetChannelId = forwardChat.chat.id;
    } else if (text) {
      const parsed = parseInt(text, 10);
      if (!isNaN(parsed)) targetChannelId = parsed;
    }

    if (!targetChannelId) {
      await ctx.reply(
        '⚠️ Invalid Channel ID. Please provide a valid numeric channel ID (e.g. <code>-1001234567890</code>) or forward a post from the channel.',
        { parse_mode: 'HTML' }
      );
      return true;
    }

    const addingMsg = await ctx.reply('⏳ Validating bot permissions and setting up channel...');
    const result = await ChannelService.addChannel(ctx as any, targetChannelId);

    if (!result.success || !result.channel) {
      await ctx.api.editMessageText(ctx.chat!.id, addingMsg.message_id, `❌ <b>Setup Failed:</b>\n${result.error}`, {
        parse_mode: 'HTML',
      });
      return true;
    }

    await clearAdminSession(from.id);

    const me = await ctx.api.getMe();
    const deepLink = LinkService.getBotDeepLink(me.username || '', result.channel.startPayload);

    await ctx.api.editMessageText(
      ctx.chat!.id,
      addingMsg.message_id,
      `🎉 <b>Channel Added Successfully!</b>\n\n` +
      `• <b>Title:</b> <b>${escapeHtml(result.channel.title)}</b>\n` +
      `• <b>ID:</b> <code>${result.channel.channelId}</code>\n` +
      `• <b>Auto-Approve:</b> ✅ Enabled\n\n` +
      `🔗 <b>Your Generated Bot Deep-Link:</b>\n<code>${deepLink}</code>\n\n` +
      `📨 <b>Direct Join Request Link:</b>\n<code>${result.channel.inviteLink}</code>`,
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: AdminKeyboards.channelDetailMenu(result.channel),
      }
    );

    LoggerService.logChannelAction(
      ctx as any,
      'Channel Connected',
      { id: result.channel.channelId, title: result.channel.title },
      from.id
    );

    return true;
  }

  // State: WAITING_WELCOME_MSG
  if (session.state === 'WAITING_WELCOME_MSG') {
    const channelId = session.data?.channelId;
    if (!channelId || !text) {
      await ctx.reply('⚠️ Please provide a valid text message.');
      return true;
    }

    const channel = await Channel.findOne({ channelId });
    if (!channel) {
      await ctx.reply('⚠️ Channel not found.');
      await clearAdminSession(from.id);
      return true;
    }

    channel.welcomeMessage = text;
    await channel.save();
    await clearAdminSession(from.id);

    await ctx.reply(
      `✅ <b>Welcome message updated for ${escapeHtml(channel.title)}!</b>\n\nNew message:\n<blockquote>${escapeHtml(text)}</blockquote>`,
      {
        parse_mode: 'HTML',
        reply_markup: AdminKeyboards.channelDetailMenu(channel),
      }
    );
    return true;
  }

  // State: WAITING_LOG_CHANNEL_ID
  if (session.state === 'WAITING_LOG_CHANNEL_ID') {
    let logId: number | undefined;

    const forwardChat = ctx.message?.forward_origin;
    if (forwardChat && forwardChat.type === 'channel' && forwardChat.chat) {
      logId = forwardChat.chat.id;
    } else if (text) {
      const parsed = parseInt(text, 10);
      if (!isNaN(parsed)) logId = parsed;
    }

    if (!logId) {
      await ctx.reply('⚠️ Invalid Channel ID. Please provide a numeric ID (e.g. <code>-1001234567890</code>).', {
        parse_mode: 'HTML',
      });
      return true;
    }

    try {
      // Test sending message to ensure bot has permission
      await ctx.api.sendMessage(
        logId,
        `📋 <b>Log Channel Connected</b>\n\nThis channel is now configured to receive all action logs for the bot.`,
        { parse_mode: 'HTML' }
      );

      const settings = await getGlobalSettings();
      settings.logChannelId = logId;
      await settings.save();
      await clearAdminSession(from.id);

      await ctx.reply(
        `✅ <b>Log Channel successfully configured!</b>\nID: <code>${logId}</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: AdminKeyboards.backToHome(),
        }
      );
    } catch (err: any) {
      await ctx.reply(
        `❌ <b>Could not send message to channel ${logId}:</b>\n${err.message}\n\nPlease ensure the bot is an Administrator in the log channel with "Send Messages" permission.`
      );
    }
    return true;
  }

  // State: WAITING_BROADCAST_MSG
  if (session.state === 'WAITING_BROADCAST_MSG') {
    await clearAdminSession(from.id);

    const users = await User.find({ isBanned: false });
    const statusMsg = await ctx.reply(`🚀 Starting broadcast to <b>${users.length}</b> users...`, {
      parse_mode: 'HTML',
    });

    let success = 0;
    let failed = 0;

    for (const u of users) {
      try {
        await ctx.copyMessage(u.userId);
        success++;
      } catch {
        failed++;
      }
      // Small delay to respect Telegram rate limits
      await new Promise(r => setTimeout(r, 40));
    }

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `📣 <b>Broadcast Completed!</b>\n\n` +
      `• <b>Total Targets:</b> <code>${users.length}</code>\n` +
      `• <b>✅ Delivered:</b> <code>${success}</code>\n` +
      `• <b>❌ Failed / Blocked:</b> <code>${failed}</code>`,
      {
        parse_mode: 'HTML',
        reply_markup: AdminKeyboards.backToHome(),
      }
    );
    return true;
  }

  return false;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
