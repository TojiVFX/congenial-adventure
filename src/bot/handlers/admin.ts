import { Context, Bot, InlineKeyboard } from 'grammy';
import { config } from '../../config.js';
import { Channel } from '../../db/models/Channel.js';
import { User } from '../../db/models/User.js';
import { RequestLog } from '../../db/models/RequestLog.js';
import {
  getGlobalSettings,
  invalidateSettingsCache,
  getAdminSession,
  setAdminSession,
  clearAdminSession,
} from '../../db/models/Settings.js';
import { AdminKeyboards } from '../keyboards/adminKeyboards.js';
import { ChannelService } from '../services/channelService.js';
import { LinkService } from '../services/linkService.js';
import { LoggerService } from '../services/loggerService.js';
import { updateBotCommands } from '../services/commandService.js';
import { escapeHtml } from '../utils/html.js';
import { editOrReply } from '../utils/telegram.js';

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
    await ctx.reply('⛔ <b>ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ</b>: ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴀᴜᴛʜᴏʀɪᴢᴇᴅ ᴛᴏ ᴀᴄᴄᴇss ᴛʜɪs ᴄᴏɴᴛʀᴏʟ ᴘᴀɴᴇʟ.', {
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
        RequestLog.find().sort({ createdAt: -1 }).limit(10),
      ]);

    const approvalRate =
      totalRequests > 0 ? ((totalApproved / totalRequests) * 100).toFixed(1) : '0';

    let statsText =
      `📊 <b>ᴅᴇᴛᴀɪʟᴇᴅ ʙᴏᴛ ᴀɴᴀʟʏᴛɪᴄs</b>\n\n` +
      `• <b>ᴛᴏᴛᴀʟ ᴜsᴇʀs:</b> <code>${totalUsers}</code>\n` +
      `• <b>ᴀᴄᴛɪᴠᴇ ᴄʜᴀɴɴᴇʟs:</b> <code>${totalChannels}</code>\n` +
      `• <b>ᴛᴏᴛᴀʟ ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛs:</b> <code>${totalRequests}</code>\n` +
      `• <b>✅ ᴀᴘᴘʀᴏᴠᴇᴅ:</b> <code>${totalApproved}</code> (${approvalRate}%)\n` +
      `• <b>⏸️ ᴘᴇɴᴅɪɴɢ:</b> <code>${totalPending}</code>\n\n` +
      `🕒 <b>ʟᴀsᴛ 10 ʀᴇᴄᴇɴᴛ ᴀᴄᴛɪᴏɴs:</b>\n`;

    if (recentLogs.length === 0) {
      statsText += `<i>ɴᴏ ʀᴇǫᴜᴇsᴛs ʀᴇᴄᴏʀᴅᴇᴅ ʏᴇᴛ.</i>\n`;
    } else {
      for (const log of recentLogs) {
        const icon = log.status === 'approved' ? '🟢' : log.status === 'rejected' ? '❌' : '🟡';
        const time = new Date(log.createdAt).toISOString().substring(11, 16);
        statsText += `${icon} <code>${time}</code> <a href="tg://user?id=${log.userId}">${escapeHtml(log.userName)}</a> → <i>${escapeHtml(log.channelTitle)}</i> [${log.status}]\n`;
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
        `📢 <b>ᴄʜᴀɴɴᴇʟ ᴍᴀɴᴀɢᴇᴍᴇɴᴛ</b>\n\nɴᴏ ᴄʜᴀɴɴᴇʟs ʜᴀᴠᴇ ʙᴇᴇɴ ᴄᴏɴɴᴇᴄᴛᴇᴅ ʏᴇᴛ.\nᴄʟɪᴄᴋ <b>ᴀᴅᴅ ɴᴇᴡ ᴄʜᴀɴɴᴇʟ</b> ᴛᴏ ᴄᴏɴɴᴇᴄᴛ ʏᴏᴜʀ ғɪʀsᴛ ᴄʜᴀɴɴᴇʟ.`,
        {
          parse_mode: 'HTML',
          reply_markup: AdminKeyboards.channelListMenu([]),
        }
      );
      return;
    }

    await ctx.editMessageText(
      `📢 <b>ᴄᴏɴɴᴇᴄᴛᴇᴅ ᴄʜᴀɴɴᴇʟs (${channels.length})</b>\n\nᴄʟɪᴄᴋ ᴏɴ ᴀɴʏ ᴄʜᴀɴɴᴇʟ ʙᴇʟᴏᴡ ᴛᴏ ᴠɪᴇᴡ sᴇᴛᴛɪɴɢs, ᴄᴏᴘʏ ʟɪɴᴋs, ᴏʀ ᴛᴏɢɢʟᴇ ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴀʟ:`,
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
    const statusText = channel.autoApproveEnabled ? '✅ <b>ᴀᴄᴛɪᴠᴇ (ᴏɴ)</b>' : '⏸️ <b>ᴅɪsᴀʙʟᴇᴅ (ᴏғғ)</b>';
    const approvalStatusText = channel.status === 'pending'
      ? '⏳ <b>ᴘᴇɴᴅɪɴɢ ʀᴇᴠɪᴇᴡ</b>'
      : channel.status === 'rejected'
      ? '❌ <b>ᴅᴇᴄʟɪɴᴇᴅ</b>'
      : '✅ <b>ᴀᴘᴘʀᴏᴠᴇᴅ</b>';
    const ownerDisplay = channel.addedByUserName
      ? `<a href="tg://user?id=${channel.addedByUserId}">${escapeHtml(channel.addedByUserName)}</a> (<code>${channel.addedByUserId}</code>)`
      : '<i>ɴᴏᴛ ʀᴇɢɪsᴛᴇʀᴇᴅ</i>';

    const normalLinkDisplay =
      channel.normalLink || (channel.username ? `https://t.me/${channel.username.replace(/^@/, '')}` : undefined);

    const text =
      `📢 <b>ᴄʜᴀɴɴᴇʟ: ${escapeHtml(channel.title)}</b>\n\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ ɪᴅ:</b> <code>${channel.channelId}</code>\n` +
      `• <b>ᴜsᴇʀɴᴀᴍᴇ:</b> ${channel.username ? `@${channel.username.replace(/^@/, '')}` : '<i>ᴘʀɪᴠᴀᴛᴇ</i>'}\n` +
      (normalLinkDisplay ? `• <b>ɴᴏʀᴍᴀʟ ʟɪɴᴋ:</b> ${normalLinkDisplay}\n` : '') +
      `• <b>ᴀᴅᴅᴇᴅ ʙʏ:</b> ${ownerDisplay}\n` +
      `• <b>sᴛᴀᴛᴜs:</b> ${approvalStatusText}\n` +
      `• <b>ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ:</b> ${statusText}\n` +
      `• <b>ᴛᴏᴛᴀʟ ʀᴇǫᴜᴇsᴛs:</b> <code>${channel.totalRequests || 0}</code>\n` +
      `• <b>ᴀᴘᴘʀᴏᴠᴇᴅ:</b> <code>${channel.totalApproved || 0}</code>\n\n` +
      `🔗 <b>sʜᴏʀᴛ ʙᴏᴛ ʟɪɴᴋ:</b>\n<code>${deepLink}</code>\n\n` +
      `📨 <b>ᴊᴏɪɴ-ʀᴇǫᴜᴇsᴛ ʟɪɴᴋ:</b>\n<code>${channel.inviteLink || normalLinkDisplay || 'ɴᴏᴛ ɢᴇɴᴇʀᴀᴛᴇᴅ'}</code>\n\n` +
      `<i>👉 ᴛᴀᴘ ᴛʜᴇ ᴄᴏᴘʏ ʙᴜᴛᴛᴏɴ ʙᴇʟᴏᴡ ᴛᴏ ɪɴsᴛᴀɴᴛʟʏ ᴄᴏᴘʏ ᴛʜᴇ ʟɪɴᴋ.</i>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: AdminKeyboards.channelDetailMenu(channel, deepLink),
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
      ctx,
      channel.autoApproveEnabled ? 'Auto-Approve Enabled' : 'Auto-Approve Disabled',
      { id: channel.channelId, title: channel.title },
      from.id
    );

    // Refresh view
    const me = await ctx.api.getMe();
    const deepLink = LinkService.getBotDeepLink(me.username || '', channel.startPayload);
    const statusText = channel.autoApproveEnabled ? '✅ <b>ᴀᴄᴛɪᴠᴇ (ᴏɴ)</b>' : '⏸️ <b>ᴅɪsᴀʙʟᴇᴅ (ᴏғғ)</b>';
    const ownerDisplay = channel.addedByUserName
      ? `<a href="tg://user?id=${channel.addedByUserId}">${escapeHtml(channel.addedByUserName)}</a> (<code>${channel.addedByUserId}</code>)`
      : '<i>ɴᴏᴛ ʀᴇɢɪsᴛᴇʀᴇᴅ</i>';

    const normalLinkDisplay =
      channel.normalLink || (channel.username ? `https://t.me/${channel.username.replace(/^@/, '')}` : undefined);

    const text =
      `📢 <b>ᴄʜᴀɴɴᴇʟ: ${escapeHtml(channel.title)}</b>\n\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ ɪᴅ:</b> <code>${channel.channelId}</code>\n` +
      `• <b>ᴜsᴇʀɴᴀᴍᴇ:</b> ${channel.username ? `@${channel.username.replace(/^@/, '')}` : '<i>ᴘʀɪᴠᴀᴛᴇ</i>'}\n` +
      (normalLinkDisplay ? `• <b>ɴᴏʀᴍᴀʟ ʟɪɴᴋ:</b> ${normalLinkDisplay}\n` : '') +
      `• <b>ᴀᴅᴅᴇᴅ ʙʏ:</b> ${ownerDisplay}\n` +
      `• <b>ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ:</b> ${statusText}\n` +
      `• <b>ᴛᴏᴛᴀʟ ʀᴇǫᴜᴇsᴛs:</b> <code>${channel.totalRequests || 0}</code>\n` +
      `• <b>ᴀᴘᴘʀᴏᴠᴇᴅ:</b> <code>${channel.totalApproved || 0}</code>\n\n` +
      `🔗 <b>sʜᴏʀᴛ ʙᴏᴛ ʟɪɴᴋ:</b>\n<code>${deepLink}</code>\n\n` +
      `📨 <b>ᴊᴏɪɴ-ʀᴇǫᴜᴇsᴛ ʟɪɴᴋ:</b>\n<code>${channel.inviteLink || normalLinkDisplay || 'ɴᴏᴛ ɢᴇɴᴇʀᴀᴛᴇᴅ'}</code>\n\n` +
      `<i>👉 ᴛᴀᴘ ᴛʜᴇ ᴄᴏᴘʏ ʙᴜᴛᴛᴏɴ ʙᴇʟᴏᴡ ᴛᴏ ɪɴsᴛᴀɴᴛʟʏ ᴄᴏᴘʏ ᴛʜᴇ ʟɪɴᴋ.</i>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: AdminKeyboards.channelDetailMenu(channel, deepLink),
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
      `🔗 <b>sʜᴀʀᴇᴀʙʟᴇ ʟɪɴᴋs ғᴏʀ ${escapeHtml(channel.title)}</b>\n\n` +
      `1️⃣ <b>sʜᴏʀᴛ ʙᴏᴛ ᴅᴇᴇᴘ-ʟɪɴᴋ (ʀᴇᴄᴏᴍᴍᴇɴᴅᴇᴅ):</b>\n` +
      `<code>${deepLink}</code>\n` +
      `<i>👉 ᴅɪʀᴇᴄᴛs ᴜsᴇʀ ᴛᴏ sᴛᴀʀᴛ ᴛʜᴇ ʙᴏᴛ, ʀᴇɢɪsᴛᴇʀs ᴛʜᴇᴍ, ᴀɴᴅ ɢᴜɪᴅᴇs ᴛʜᴇᴍ ᴛᴏ ʀᴇǫᴜᴇsᴛ ᴇɴᴛʀʏ.</i>\n\n` +
      `2️⃣ <b>ᴅɪʀᴇᴄᴛ ᴄʜᴀɴɴᴇʟ ʀᴇǫᴜᴇsᴛ ʟɪɴᴋ:</b>\n` +
      `<code>${channel.inviteLink || 'ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ'}</code>\n\n` +
      `<i>✨ ᴜsᴇ ᴛʜᴇ 1-ᴛᴀᴘ ᴄᴏᴘʏ ʙᴜᴛᴛᴏɴs ʙᴇʟᴏᴡ:</i>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: AdminKeyboards.linksMenu(channel.channelId, deepLink, channel.inviteLink),
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
      `✨ <b>ғʀᴇsʜ sʜᴏʀᴛ ʟɪɴᴋ ɢᴇɴᴇʀᴀᴛᴇᴅ!</b>\n\n` +
      `📢 <b>ᴄʜᴀɴɴᴇʟ:</b> <b>${escapeHtml(channel.title)}</b>\n\n` +
      `1️⃣ <b>sʜᴏʀᴛ ʙᴏᴛ ʟɪɴᴋ:</b>\n` +
      `<code>${deepLink}</code>\n\n` +
      `2️⃣ <b>ᴅɪʀᴇᴄᴛ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ:</b>\n` +
      `<code>${channel.inviteLink || 'ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ'}</code>\n\n` +
      `<i>✨ ᴛᴀᴘ ʙᴇʟᴏᴡ ᴛᴏ ᴄᴏᴘʏ ᴛʜᴇ ɴᴇᴡ ʟɪɴᴋ:</i>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: AdminKeyboards.linksMenu(channel.channelId, deepLink, channel.inviteLink),
    });
    return;
  }

  // 7. Edit Welcome Message
  if (data.startsWith('edit_welcome_')) {
    const channelId = parseInt(data.replace('edit_welcome_', ''), 10);
    const channel = await Channel.findOne({ channelId });
    if (!channel) return;

    const promptMsgId = ctx.callbackQuery?.message?.message_id;
    await setAdminSession(from.id, 'WAITING_WELCOME_MSG', {
      channelId,
      promptMessageId: promptMsgId,
      chatId: ctx.chat?.id,
    });

    const cancelKb = new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', `channel_view_${channelId}`);

    await ctx.editMessageText(
      `✏️ <b>Edit Welcome Message for ${escapeHtml(channel.title)}</b>\n\n` +
      `Current Welcome Message:\n` +
      `<blockquote>${escapeHtml(channel.welcomeMessage || 'None')}</blockquote>\n\n` +
      `Please send the new welcome message text below.\n<i>Send /cancel to abort.</i>`,
      { parse_mode: 'HTML', reply_markup: cancelKb }
    );
    return;
  }

  // 8. Delete Channel
  if (data.startsWith('delete_channel_')) {
    const channelId = parseInt(data.replace('delete_channel_', ''), 10);
    const channel = await Channel.findOneAndDelete({ channelId });

    if (channel) {
      LoggerService.logChannelAction(
        ctx,
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
    const promptMsgId = ctx.callbackQuery?.message?.message_id;
    await setAdminSession(from.id, 'WAITING_CHANNEL_ID', {
      promptMessageId: promptMsgId,
      chatId: ctx.chat?.id,
    });

    const cancelKb = new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'admin_channels');

    await ctx.editMessageText(
      `➕ <b>ᴀᴅᴅ ᴄʜᴀɴɴᴇʟ sᴇᴛᴜᴘ</b>\n\n` +
      `1. ᴀᴅᴅ ᴛʜɪs ʙᴏᴛ ᴛᴏ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴀs ᴀɴ <b>ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ</b>.\n` +
      `2. ɢʀᴀɴᴛ ᴘᴇʀᴍɪssɪᴏɴ: <b>"ɪɴᴠɪᴛᴇ ᴜsᴇʀs ᴠɪᴀ ʟɪɴᴋ"</b>.\n` +
      `3. sᴇɴᴅ ᴛʜᴇ <b>ᴄʜᴀɴɴᴇʟ ɪᴅ</b> (ᴇ.ɢ. <code>-1001234567890</code>) ᴏʀ <b>ғᴏʀᴡᴀʀᴅ ᴀ ᴘᴏsᴛ</b> ғʀᴏᴍ ᴛʜᴇ ᴄʜᴀɴɴᴇʟ ʜᴇʀᴇ.\n\n` +
      `<i>sᴇɴᴅ /cancel ᴛᴏ ʀᴇᴛᴜʀɴ.</i>`,
      { parse_mode: 'HTML', reply_markup: cancelKb }
    );
    return;
  }

  // 10. Link Center (Quick generate)
  if (data === 'admin_gen_link') {
    const channels = await Channel.find();
    if (channels.length === 0) {
      await ctx.editMessageText(
        '⚠️ ɴᴏ ᴄʜᴀɴɴᴇʟs ʜᴀᴠᴇ ʙᴇᴇɴ ᴄᴏɴɴᴇᴄᴛᴇᴅ ʏᴇᴛ. ᴘʟᴇᴀsᴇ ᴀᴅᴅ ᴀ ᴄʜᴀɴɴᴇʟ ғɪʀsᴛ.',
        { reply_markup: AdminKeyboards.backToHome() }
      );
      return;
    }

    await ctx.editMessageText(
      '🔗 <b>ʟɪɴᴋ ᴄᴇɴᴛᴇʀ</b>\n\nsᴇʟᴇᴄᴛ ᴀ ᴄʜᴀɴɴᴇʟ ʙᴇʟᴏᴡ ᴛᴏ ᴠɪᴇᴡ ᴏʀ ᴄᴏᴘʏ ɪᴛs sʜᴏʀᴛ ʟɪɴᴋs:',
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
    const statusText = currentLogId ? `<code>${currentLogId}</code>` : '<i>ɴᴏᴛ ᴄᴏɴғɪɢᴜʀᴇᴅ</i>';

    const text =
      `📋 <b>ʟᴏɢ ᴄʜᴀɴɴᴇʟ sᴇᴛᴛɪɴɢs</b>\n\n` +
      `• <b>ᴄᴜʀʀᴇɴᴛ ʟᴏɢ ᴄʜᴀɴɴᴇʟ:</b> ${statusText}\n\n` +
      `ᴀʟʟ ᴜsᴇʀ ᴀʀʀɪᴠᴀʟs, ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛs, ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴀʟs, ᴀɴᴅ ᴀᴅᴍɪɴ ᴀᴄᴛɪᴏɴs ᴀʀᴇ ʟᴏɢɢᴇᴅ ɪɴ ᴛʜɪs ᴄʜᴀɴɴᴇʟ ɪɴ ʀᴇᴀʟ ᴛɪᴍᴇ.\n\n` +
      `ᴛᴏ ᴄᴏɴғɪɢᴜʀᴇ, ᴀᴅᴅ ᴛʜᴇ ʙᴏᴛ ᴛᴏ ʏᴏᴜʀ ᴘʀɪᴠᴀᴛᴇ ʟᴏɢ ᴄʜᴀɴɴᴇʟ ᴀs ᴀᴅᴍɪɴ, ᴛʜᴇɴ ᴄʟɪᴄᴋ <b>sᴇᴛ / ᴄʜᴀɴɢᴇ ʟᴏɢ ᴄʜᴀɴɴᴇʟ</b>.`;

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
      await ctx.reply('⚠️ ɴᴏ ʟᴏɢ ᴄʜᴀɴɴᴇʟ ᴄᴏɴғɪɢᴜʀᴇᴅ.');
      return;
    }

    try {
      await ctx.api.sendMessage(
        currentLogId,
        `🧪 <b>ᴛᴇsᴛ ʟᴏɢ ʀᴇᴄᴏʀᴅ</b>\n\n` +
        `• <b>ᴛʀɪɢɢᴇʀᴇᴅ ʙʏ:</b> <a href="tg://user?id=${from.id}">${escapeHtml(from.first_name)}</a> (<code>${from.id}</code>)\n` +
        `• <b>sᴛᴀᴛᴜs:</b> ✅ ʟᴏɢ ᴅᴇʟɪᴠᴇʀʏ ɪs ᴡᴏʀᴋɪɴɢ ᴘᴇʀғᴇᴄᴛʟʏ!`,
        { parse_mode: 'HTML' }
      );
      await ctx.answerCallbackQuery({ text: '✅ Test log successfully sent to log channel!' });
    } catch (err: any) {
      await ctx.answerCallbackQuery({ text: `❌ Failed to send test log: ${err.message}` });
    }
    return;
  }

  // 13. Set Log Channel Prompt
  if (data === 'set_log_channel') {
    const promptMsgId = ctx.callbackQuery?.message?.message_id;
    await setAdminSession(from.id, 'WAITING_LOG_CHANNEL_ID', {
      promptMessageId: promptMsgId,
      chatId: ctx.chat?.id,
    });

    const cancelKb = new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'admin_log_settings');

    await ctx.editMessageText(
      `📋 <b>sᴇᴛ ʟᴏɢ ᴄʜᴀɴɴᴇʟ</b>\n\n` +
      `1. ᴀᴅᴅ ᴛʜɪs ʙᴏᴛ ᴛᴏ ʏᴏᴜʀ ʟᴏɢ ᴄʜᴀɴɴᴇʟ ᴀs ᴀɴ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ᴡɪᴛʜ <b>"sᴇɴᴅ ᴍᴇssᴀɢᴇs"</b> ᴘᴇʀᴍɪssɪᴏɴ.\n` +
      `2. sᴇɴᴅ ᴛʜᴇ <b>ʟᴏɢ ᴄʜᴀɴɴᴇʟ ɪᴅ</b> (ᴇ.ɢ. <code>-1001234567890</code>) ᴏʀ <b>ғᴏʀᴡᴀʀᴅ ᴀ ᴘᴏsᴛ</b> ғʀᴏᴍ ᴛʜᴇ ʟᴏɢ ᴄʜᴀɴɴᴇʟ ʜᴇʀᴇ.\n\n` +
      `<i>sᴇɴᴅ /cancel ᴛᴏ ʀᴇᴛᴜʀɴ.</i>`,
      { parse_mode: 'HTML', reply_markup: cancelKb }
    );
    return;
  }

  // 14. Broadcast Prompt
  if (data === 'admin_broadcast') {
    const userCount = await User.countDocuments({ isBanned: false });
    const promptMsgId = ctx.callbackQuery?.message?.message_id;
    await setAdminSession(from.id, 'WAITING_BROADCAST_MSG', {
      promptMessageId: promptMsgId,
      chatId: ctx.chat?.id,
    });

    const cancelKb = new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'admin_home');

    await ctx.editMessageText(
      `📣 <b>ʙʀᴏᴀᴅᴄᴀsᴛ ᴍᴇssᴀɢᴇ</b>\n\n` +
      `ᴛᴏᴛᴀʟ ᴀᴜᴅɪᴇɴᴄᴇ: <b>${userCount} ᴜsᴇʀs</b>.\n\n` +
      `ᴘʟᴇᴀsᴇ sᴇɴᴅ ᴛʜᴇ ᴍᴇssᴀɢᴇ ʏᴏᴜ ᴡᴏᴜʟᴅ ʟɪᴋᴇ ᴛᴏ ʙʀᴏᴀᴅᴄᴀsᴛ ʙᴇʟᴏᴡ (ᴛᴇxᴛ, ᴘʜᴏᴛᴏ, ᴍᴀʀᴋᴅᴏᴡɴ, ʜᴛᴍʟ sᴜᴘᴘᴏʀᴛᴇᴅ).\n\n` +
      `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ.</i>`,
      { parse_mode: 'HTML', reply_markup: cancelKb }
    );
    return;
  }

  // 15. Auto-Update / Sync Telegram Commands
  if (data === 'admin_sync_commands') {
    const res = await updateBotCommands(ctx.api);
    if (res.success) {
      await ctx.editMessageText(
        `✅ <b>ᴛᴇʟᴇɢʀᴀᴍ ᴄᴏᴍᴍᴀɴᴅ ᴍᴇɴᴜ ᴜᴘᴅᴀᴛᴇᴅ!</b>\n\n` +
        `• <b>${res.count} ᴄᴏᴍᴍᴀɴᴅs</b> ʜᴀᴠᴇ ʙᴇᴇɴ sᴜᴄᴄᴇssғᴜʟʟʏ sʏɴᴄᴇᴅ ᴡɪᴛʜ ᴛᴇʟᴇɢʀᴀᴍ.\n` +
        `• ᴛʜᴇʏ ᴡɪʟʟ ɴᴏᴡ ᴀᴘᴘᴇᴀʀ ɪɴ ᴛʜᴇ <b>[/]</b> ᴍᴇɴᴜ ʙᴜᴛᴛᴏɴ ғᴏʀ ᴀʟʟ ᴜsᴇʀs.`,
        {
          parse_mode: 'HTML',
          reply_markup: AdminKeyboards.backToHome(),
        }
      );
    } else {
      await ctx.editMessageText(`❌ <b>ғᴀɪʟᴇᴅ ᴛᴏ ᴜᴘᴅᴀᴛᴇ ᴄᴏᴍᴍᴀɴᴅs:</b> ${res.error}`, {
        parse_mode: 'HTML',
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
  if (!session || !session.state) return false;

  const promptMessageId = session.data?.promptMessageId;
  const chatId = session.data?.chatId || ctx.chat?.id;

  // Clean up admin's typed or forwarded message so chat history is kept in one message
  // NOTE: Preserve message during WAITING_BROADCAST_MSG because ctx.copyMessage requires source message to exist!
  if (session.state !== 'WAITING_BROADCAST_MSG') {
    try {
      await ctx.deleteMessage();
    } catch {}
  }

  // Handle cancel command
  if (text === '/cancel') {
    await clearAdminSession(from.id);
    const dashText = await getDashboardText();
    await editOrReply(ctx, chatId, promptMessageId, dashText, {
      parse_mode: 'HTML',
      reply_markup: AdminKeyboards.mainMenu(),
    });
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
      if (!isNaN(parsed)) {
        targetChannelId = parsed;
      } else {
        // Support @username or t.me/username link
        const linkMatch = text.match(/(?:https?:\/\/)?(?:www\.)?t\.me\/([a-zA-Z0-9_]{4,})/);
        const rawUsername = linkMatch ? linkMatch[1] : (text.startsWith('@') ? text.slice(1) : undefined);
        if (rawUsername && !['joinchat', 'addstickers'].includes(rawUsername.toLowerCase())) {
          try {
            const chat = await ctx.api.getChat(`@${rawUsername}`);
            targetChannelId = chat.id;
          } catch {}
        }
      }
    }

    if (!targetChannelId) {
      const retryText =
        '⚠️ <b>Invalid Channel ID or Link.</b> Please provide a numeric channel ID (e.g. <code>-1001234567890</code>), public link (<code>t.me/yourchannel</code>), or forward a post from the channel.\n\n<i>Send /cancel to return.</i>';
      const cancelKb = new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'admin_channels');
      await editOrReply(ctx, chatId, promptMessageId, retryText, {
        parse_mode: 'HTML',
        reply_markup: cancelKb,
      });
      return true;
    }

    const result = await ChannelService.addChannel(ctx, targetChannelId, {
      id: from.id,
      name: from.first_name,
      username: from.username,
    });

    if (!result.success || !result.channel) {
      const errorText = `❌ <b>sᴇᴛᴜᴘ ғᴀɪʟᴇᴅ:</b>\n${result.error}\n\n<i>Send /cancel to return.</i>`;
      const cancelKb = new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'admin_channels');
      await editOrReply(ctx, chatId, promptMessageId, errorText, {
        parse_mode: 'HTML',
        reply_markup: cancelKb,
      });
      return true;
    }

    await clearAdminSession(from.id);

    const me = await ctx.api.getMe();
    const deepLink = LinkService.getBotDeepLink(me.username || '', result.channel.startPayload);

    const successText =
      `🎉 <b>ᴄʜᴀɴɴᴇʟ ᴀᴅᴅᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ!</b>\n\n` +
      `• <b>ᴛɪᴛʟᴇ:</b> <b>${escapeHtml(result.channel.title)}</b>\n` +
      `• <b>ɪᴅ:</b> <code>${result.channel.channelId}</code>\n` +
      `• <b>ᴀᴅᴅᴇᴅ ʙʏ:</b> ${escapeHtml(from.first_name)} (<code>${from.id}</code>)\n` +
      `• <b>ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ:</b> ✅ ᴇɴᴀʙʟᴇᴅ\n\n` +
      `🔗 <b>sʜᴏʀᴛ ʙᴏᴛ ʟɪɴᴋ:</b>\n<code>${deepLink}</code>\n\n` +
      `📨 <b>ᴅɪʀᴇᴄᴛ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ:</b>\n<code>${result.channel.inviteLink}</code>\n\n` +
      `<i>✨ ᴛᴀᴘ ᴛʜᴇ ᴄᴏᴘʏ ʙᴜᴛᴛᴏɴ ʙᴇʟᴏᴡ ᴛᴏ ɪɴsᴛᴀɴᴛʟʏ ᴄᴏᴘʏ ᴛʜᴇ ʟɪɴᴋ.</i>`;

    await editOrReply(ctx, chatId, promptMessageId, successText, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: AdminKeyboards.channelDetailMenu(result.channel, deepLink),
    });

    LoggerService.logChannelAction(
      ctx,
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
      await editOrReply(ctx, chatId, promptMessageId, '⚠️ Please provide a valid text message.', {
        reply_markup: new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', `channel_view_${channelId}`),
      });
      return true;
    }

    const channel = await Channel.findOne({ channelId });
    if (!channel) {
      await clearAdminSession(from.id);
      await editOrReply(ctx, chatId, promptMessageId, '⚠️ Channel not found.', {
        reply_markup: AdminKeyboards.backToChannels(),
      });
      return true;
    }

    channel.welcomeMessage = text;
    await channel.save();
    await clearAdminSession(from.id);

    const updatedText =
      `✅ <b>Welcome message updated for ${escapeHtml(channel.title)}!</b>\n\nNew message:\n<blockquote>${escapeHtml(text)}</blockquote>`;

    await editOrReply(ctx, chatId, promptMessageId, updatedText, {
      parse_mode: 'HTML',
      reply_markup: AdminKeyboards.channelDetailMenu(channel),
    });
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
      const retryText =
        '⚠️ <b>Invalid Channel ID.</b> Please provide a numeric ID (e.g. <code>-1001234567890</code>).\n\n<i>Send /cancel to return.</i>';
      await editOrReply(ctx, chatId, promptMessageId, retryText, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'admin_log_settings'),
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
      invalidateSettingsCache();
      await clearAdminSession(from.id);

      const successText = `✅ <b>Log Channel successfully configured!</b>\nID: <code>${logId}</code>`;
      await editOrReply(ctx, chatId, promptMessageId, successText, {
        parse_mode: 'HTML',
        reply_markup: AdminKeyboards.backToHome(),
      });
    } catch (err: any) {
      const failText = `❌ <b>Could not send message to channel ${logId}:</b>\n${err.message}\n\nPlease ensure the bot is an Administrator in the log channel with "Send Messages" permission.`;
      await editOrReply(ctx, chatId, promptMessageId, failText, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'admin_log_settings'),
      });
    }
    return true;
  }

  // State: WAITING_BROADCAST_MSG
  if (session.state === 'WAITING_BROADCAST_MSG') {
    await clearAdminSession(from.id);

    const users = await User.find({ isBanned: false });
    const statusText = `🚀 Starting broadcast to <b>${users.length}</b> users...`;
    await editOrReply(ctx, chatId, promptMessageId, statusText, { parse_mode: 'HTML' });

    const started = Date.now();
    const TIME_BUDGET_MS = 18000;
    let success = 0;
    let failed = 0;
    let processed = 0;
    let rateLimited = false;

    for (const u of users) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      processed++;

      try {
        await ctx.copyMessage(u.userId);
        success++;
      } catch (err: any) {
        if (err?.error_code === 429) {
          rateLimited = true;
          processed--;
          break;
        }
        failed++;
      }
      await new Promise(r => setTimeout(r, 40));
    }

    // Now that copyMessage is complete, safely clean up admin's typed/forwarded broadcast message
    try {
      await ctx.deleteMessage();
    } catch {}

    const remaining = users.length - processed;
    let doneText =
      `📣 <b>Broadcast ${remaining > 0 ? 'Paused' : 'Completed'}!</b>\n\n` +
      `• <b>Total Targets:</b> <code>${users.length}</code>\n` +
      `• <b>✅ Delivered:</b> <code>${success}</code>\n` +
      `• <b>❌ Failed / Blocked:</b> <code>${failed}</code>`;

    if (remaining > 0) {
      doneText +=
        `\n• <b>⏳ Remaining:</b> <code>${remaining}</code>\n\n` +
        (rateLimited ? `⚠️ Telegram rate limit reached. ` : `⏳ Serverless time budget reached. `) +
        `Send the broadcast again to continue with the remaining users.`;
    }

    await editOrReply(ctx, chatId, promptMessageId, doneText, {
      parse_mode: 'HTML',
      reply_markup: AdminKeyboards.backToHome(),
    });
    return true;
  }

  return false;
}
