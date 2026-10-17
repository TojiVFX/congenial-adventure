import { Context, InlineKeyboard } from 'grammy';
import { Channel, IChannel } from '../../db/models/Channel.js';
import { config } from '../../config.js';
import {
  getGlobalSettings,
  getAdminSession,
  setAdminSession,
  clearAdminSession,
} from '../../db/models/Settings.js';
import { ChannelService } from '../services/channelService.js';
import { LinkService } from '../services/linkService.js';
import { LoggerService } from '../services/loggerService.js';
import { isAdmin } from './admin.js';

/**
 * Helper to edit existing prompt message or fallback to reply
 */
async function editOrReply(
  ctx: Context,
  chatId: number | undefined,
  messageId: number | undefined,
  text: string,
  options: any
): Promise<void> {
  if (chatId && messageId) {
    try {
      await ctx.api.editMessageText(chatId, messageId, text, options);
      return;
    } catch (e: any) {
      console.warn('[UserChannel] Edit message in-place failed, falling back to reply:', e.message);
    }
  }
  await ctx.reply(text, options);
}

/**
 * Entry point for /managechat command
 */
export async function handleManageChatCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  await clearAdminSession(from.id);

  const channels = await Channel.find({ addedByUserId: from.id }).sort({ createdAt: -1 });

  let text: string;
  let kb: InlineKeyboard;

  if (channels.length === 0) {
    text =
      `⚙️ <b>ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴅᴀsʜʙᴏᴀʀᴅ</b>\n\n` +
      `ʏᴏᴜ ʜᴀᴠᴇ ɴᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ ᴀɴʏ ᴄʜᴀɴɴᴇʟs ʏᴇᴛ.\n\n` +
      `• <b>ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ ᴍᴇᴍʙᴇʀs:</b> ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ᴀᴄᴄᴇᴘᴛ ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛs.\n` +
      `• <b>sʜᴀʀᴇᴀʙʟᴇ ᴅᴇᴇᴘ-ʟɪɴᴋs:</b> ɢᴇᴛ ᴘʀᴇᴍɪᴜᴍ sʜᴏʀᴛ ʟɪɴᴋs ғᴏʀ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ.\n` +
      `• <b>ᴘʀɪᴠᴀᴄʏ:</b> ʏᴏᴜ ᴍᴀɪɴᴛᴀɪɴ ғᴜʟʟ ᴄᴏɴᴛʀᴏʟ ᴏᴠᴇʀ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ sᴇᴛᴛɪɴɢs.`;

    kb = new InlineKeyboard()
      .text('➕ ᴀᴅᴅ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ', 'user_chan_add')
      .row();
  } else {
    const rendered = renderUserChannelList(channels);
    text = rendered.text;
    kb = rendered.keyboard;
  }

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      return;
    } catch {}
  }

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

/**
 * Renders channel list for a specific user
 */
function renderUserChannelList(channels: IChannel[]): { text: string; keyboard: InlineKeyboard } {
  const text =
    `⚙️ <b>ʏᴏᴜʀ ᴄᴏɴɴᴇᴄᴛᴇᴅ ᴄʜᴀɴɴᴇʟs</b>\n\n` +
    `sᴇʟᴇᴄᴛ ᴀ ᴄʜᴀɴɴᴇʟ ʙᴇʟᴏᴡ ᴛᴏ ᴍᴀɴᴀɢᴇ sᴇᴛᴛɪɴɢs, ᴄᴏᴘʏ ʟɪɴᴋs, ᴏʀ ᴛᴏɢɢʟᴇ ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴀʟ:`;

  const kb = new InlineKeyboard();

  for (const ch of channels) {
    let prefix = '📢';
    let suffix = '';
    if (ch.status === 'pending') {
      prefix = '⏳';
      suffix = ' (ᴘᴇɴᴅɪɴɢ)';
    } else if (ch.status === 'rejected') {
      prefix = '❌';
      suffix = ' (ᴅᴇᴄʟɪɴᴇᴅ)';
    } else if (ch.autoApproveEnabled) {
      prefix = '✅';
    } else {
      prefix = '⏸️';
    }

    const callback =
      ch.status === 'pending'
        ? `user_chan_pending:${ch._id}`
        : ch.status === 'rejected'
        ? `user_chan_rejected:${ch._id}`
        : `user_chan_view:${ch._id}`;

    kb.text(`${prefix} ${ch.title}${suffix}`, callback).row();
  }

  kb.text('➕ ᴀᴅᴅ ɴᴇᴡ ᴄʜᴀɴɴᴇʟ', 'user_chan_add')
    .text('🔄 ʀᴇғʀᴇsʜ', 'user_chan_list')
    .row();

  return { text, keyboard: kb };
}

/**
 * Renders details and controls for a single approved channel
 */
function renderUserChannelDetail(
  channel: IChannel,
  botUsername: string
): { text: string; keyboard: InlineKeyboard } {
  const botDeepLink = LinkService.getBotDeepLink(botUsername, channel.startPayload);
  const statusLabel = channel.autoApproveEnabled
    ? '✅ <b>ᴇɴᴀʙʟᴇᴅ (ɪɴsᴛᴀɴᴛ ᴀᴘᴘʀᴏᴠᴀʟ)</b>'
    : '⏸️ <b>ᴅɪsᴀʙʟᴇᴅ (ᴍᴀɴᴜᴀʟ ʀᴇᴠɪᴇᴡ)</b>';

  const text =
    `📢 <b>${escapeHtml(channel.title)}</b>\n\n` +
    `• <b>ᴄʜᴀɴɴᴇʟ ɪᴅ:</b> <code>${channel.channelId}</code>\n` +
    `• <b>ᴜsᴇʀɴᴀᴍᴇ:</b> ${channel.username ? `@${channel.username}` : '<i>ɴᴏɴᴇ</i>'}\n` +
    `• <b>ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴀʟ:</b> ${statusLabel}\n` +
    `• <b>ᴛᴏᴛᴀʟ ʀᴇǫᴜᴇsᴛs:</b> <code>${channel.totalRequests || 0}</code>\n` +
    `• <b>ᴛᴏᴛᴀʟ ᴀᴘᴘʀᴏᴠᴇᴅ:</b> <code>${channel.totalApproved || 0}</code>\n\n` +
    `🔗 <b>ʙᴏᴛ ᴅᴇᴇᴘ-ʟɪɴᴋ:</b>\n<code>${botDeepLink}</code>\n\n` +
    `📨 <b>ᴄʜᴀɴɴᴇʟ ɪɴᴠɪᴛᴇ ʟɪɴᴋ:</b>\n<code>${channel.inviteLink || 'Generating...'}</code>`;

  const toggleBtnText = channel.autoApproveEnabled
    ? '⏸️ ᴅɪsᴀʙʟᴇ ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ'
    : '✅ ᴇɴᴀʙʟᴇ ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ';

  const kb = new InlineKeyboard()
    .text(toggleBtnText, `user_chan_toggle:${channel._id}`)
    .row();

  // Premium 1-tap copy buttons
  kb.copyText('📋 ᴄᴏᴘʏ ʙᴏᴛ ʟɪɴᴋ', botDeepLink);
  if (channel.inviteLink) {
    kb.copyText('📨 ᴄᴏᴘʏ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ', channel.inviteLink);
  }
  kb.row();

  kb.text('🔄 ɴᴇᴡ sʜᴏʀᴛ ʟɪɴᴋ', `user_chan_regen:${channel._id}`)
    .text('🗑️ ʀᴇᴍᴏᴠᴇ ᴄʜᴀɴɴᴇʟ', `user_chan_del_confirm:${channel._id}`)
    .row()
    .text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴍʏ ᴄʜᴀɴɴᴇʟs', 'user_chan_list');

  return { text, keyboard: kb };
}

/**
 * Handles all user channel callback queries
 */
export async function handleUserChannelCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const from = ctx.from;
  if (!data || !from) return;

  const botUsername = ctx.me.username;

  // 1. Back to channel list
  if (data === 'user_chan_list') {
    await ctx.answerCallbackQuery();
    await clearAdminSession(from.id);
    const channels = await Channel.find({ addedByUserId: from.id }).sort({ createdAt: -1 });
    if (channels.length === 0) {
      await handleManageChatCommand(ctx);
      return;
    }
    const { text, keyboard } = renderUserChannelList(channels);
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    return;
  }

  // 2. Add new channel initiation
  if (data === 'user_chan_add') {
    await ctx.answerCallbackQuery();
    const promptMsgId = ctx.callbackQuery?.message?.message_id;
    await setAdminSession(from.id, 'WAITING_USER_CHANNEL_INPUT', {
      promptMessageId: promptMsgId,
      chatId: ctx.chat?.id,
    });

    const promptText =
      `➕ <b>ᴄᴏɴɴᴇᴄᴛ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ</b>\n\n` +
      `<b>sᴛᴇᴘ 1:</b> ᴀᴅᴅ @${botUsername} ᴛᴏ ʏᴏᴜʀ ᴘʀɪᴠᴀᴛᴇ ᴄʜᴀɴɴᴇʟ ᴀs ᴀɴ <b>ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ</b>.\n` +
      `<i>(ᴍᴀᴋᴇ sᴜʀᴇ "ɪɴᴠɪᴛᴇ ᴜsᴇʀs ᴠɪᴀ ʟɪɴᴋ" ᴘᴇʀᴍɪssɪᴏɴ ɪs ᴇɴᴀʙʟᴇᴅ)</i>\n\n` +
      `<b>sᴛᴇᴘ 2:</b> ғᴏʀᴡᴀʀᴅ ᴀɴʏ ᴘᴏsᴛ ғʀᴏᴍ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ʜᴇʀᴇ, ᴏʀ sᴇɴᴅ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ɪᴅ (ᴇ.ɢ. <code>-1001234567890</code>).\n\n` +
      `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ ᴀᴛ ᴀɴʏ ᴛɪᴍᴇ.</i>`;

    const cancelKb = new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'user_chan_list');

    await ctx.editMessageText(promptText, { parse_mode: 'HTML', reply_markup: cancelKb });
    return;
  }

  // 3. View single approved channel
  if (data.startsWith('user_chan_view:')) {
    await ctx.answerCallbackQuery();
    const chanDbId = data.split(':')[1];
    const channel = await Channel.findById(chanDbId);

    if (!channel || (channel.addedByUserId !== from.id && !(await isAdmin(from.id)))) {
      await ctx.editMessageText('⚠️ <b>ᴄʜᴀɴɴᴇʟ ɴᴏᴛ ғᴏᴜɴᴅ ᴏʀ ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ.</b>', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 ʙᴀᴄᴋ', 'user_chan_list'),
      });
      return;
    }

    const { text, keyboard } = renderUserChannelDetail(channel, botUsername);
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    return;
  }

  // 4. Toggle auto-approval
  if (data.startsWith('user_chan_toggle:')) {
    const chanDbId = data.split(':')[1];
    const channel = await Channel.findById(chanDbId);

    if (!channel || (channel.addedByUserId !== from.id && !(await isAdmin(from.id)))) {
      await ctx.answerCallbackQuery({ text: 'Access denied.' });
      return;
    }

    channel.autoApproveEnabled = !channel.autoApproveEnabled;
    await channel.save();

    await ctx.answerCallbackQuery({
      text: channel.autoApproveEnabled ? 'Auto-approval enabled' : 'Auto-approval disabled',
    });

    const { text, keyboard } = renderUserChannelDetail(channel, botUsername);
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    return;
  }

  // 5. Regenerate short deep link
  if (data.startsWith('user_chan_regen:')) {
    const chanDbId = data.split(':')[1];
    const channel = await Channel.findById(chanDbId);

    if (!channel || (channel.addedByUserId !== from.id && !(await isAdmin(from.id)))) {
      await ctx.answerCallbackQuery({ text: 'Access denied.' });
      return;
    }

    // Generate clean short payload
    channel.startPayload = LinkService.generateStartPayload(8);

    // Refresh channel invite link
    try {
      channel.inviteLink = await LinkService.getOrCreateChannelInviteLink(
        ctx as any,
        channel.channelId,
        channel.title
      );
    } catch (e) {
      console.warn('[UserChannel] Could not refresh invite link:', e);
    }

    await channel.save();
    await ctx.answerCallbackQuery({ text: '✅ New short link generated!' });

    const { text, keyboard } = renderUserChannelDetail(channel, botUsername);
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    return;
  }

  // 6. Channel deletion confirmation
  if (data.startsWith('user_chan_del_confirm:')) {
    await ctx.answerCallbackQuery();
    const chanDbId = data.split(':')[1];
    const channel = await Channel.findById(chanDbId);

    if (!channel || (channel.addedByUserId !== from.id && !(await isAdmin(from.id)))) {
      await ctx.editMessageText('⚠️ <b>ᴄʜᴀɴɴᴇʟ ɴᴏᴛ ғᴏᴜɴᴅ ᴏʀ ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ.</b>', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 ʙᴀᴄᴋ', 'user_chan_list'),
      });
      return;
    }

    const confirmText =
      `⚠️ <b>ʀᴇᴍᴏᴠᴇ ᴄʜᴀɴɴᴇʟ?</b>\n\n` +
      `ᴀʀᴇ ʏᴏᴜ sᴜʀᴇ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴅɪsᴄᴏɴɴᴇᴄᴛ <b>${escapeHtml(channel.title)}</b>?\n\n` +
      `• ʏᴏᴜʀ ʙᴏᴛ ᴅᴇᴇᴘ-ʟɪɴᴋ ᴡɪʟʟ ʙᴇ ɪɴᴠᴀʟɪᴅᴀᴛᴇᴅ.\n` +
      `• ɴᴇᴡ ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛs ᴡɪʟʟ ɴᴏ ʟᴏɴɢᴇʀ ʙᴇ ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇᴅ.\n` +
      `• ʏᴏᴜʀ ᴛᴇʟᴇɢʀᴀᴍ ᴄʜᴀɴɴᴇʟ ɪᴛsᴇʟғ ᴡɪʟʟ ɴᴏᴛ ʙᴇ ᴅᴇʟᴇᴛᴇᴅ.`;

    const confirmKb = new InlineKeyboard()
      .text('🗑️ ʏᴇs, ʀᴇᴍᴏᴠᴇ', `user_chan_del:${channel._id}`)
      .row()
      .text('🔙 ᴄᴀɴᴄᴇʟ', `user_chan_view:${channel._id}`);

    await ctx.editMessageText(confirmText, { parse_mode: 'HTML', reply_markup: confirmKb });
    return;
  }

  // 7. Confirmed channel deletion
  if (data.startsWith('user_chan_del:')) {
    const chanDbId = data.split(':')[1];
    const channel = await Channel.findById(chanDbId);

    if (!channel || (channel.addedByUserId !== from.id && !(await isAdmin(from.id)))) {
      await ctx.answerCallbackQuery({ text: 'Access denied.' });
      return;
    }

    const title = channel.title;
    const channelId = channel.channelId;
    await Channel.deleteOne({ _id: channel._id });

    await ctx.answerCallbackQuery({ text: 'Channel removed successfully.' });

    LoggerService.logChannelAction(
      ctx as any,
      'Channel Removed by Owner',
      { id: channelId, title },
      from.id
    );

    const deletedText =
      `✅ <b>ᴄʜᴀɴɴᴇʟ ʀᴇᴍᴏᴠᴇᴅ!</b>\n\n` +
      `<b>${escapeHtml(title)}</b> ʜᴀs ʙᴇᴇɴ ᴅɪsᴄᴏɴɴᴇᴄᴛᴇᴅ ғʀᴏᴍ ᴛʜᴇ ʙᴏᴛ.\n\n` +
      `ʏᴏᴜ ᴄᴀɴ ᴀᴅᴅ ɪᴛ ᴏʀ ᴀɴᴏᴛʜᴇʀ ᴄʜᴀɴɴᴇʟ ᴀɢᴀɪɴ ᴀɴʏᴛɪᴍᴇ.`;

    const backKb = new InlineKeyboard().text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴍʏ ᴄʜᴀɴɴᴇʟs', 'user_chan_list');

    await ctx.editMessageText(deletedText, { parse_mode: 'HTML', reply_markup: backKb });
    return;
  }

  // 8. Pending channel review info
  if (data.startsWith('user_chan_pending:')) {
    await ctx.answerCallbackQuery();
    const chanDbId = data.split(':')[1];
    const channel = await Channel.findById(chanDbId);

    const text =
      `⏳ <b>ᴄʜᴀɴɴᴇʟ ᴘᴇɴᴅɪɴɢ ʀᴇᴠɪᴇᴡ</b>\n\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ:</b> <b>${escapeHtml(channel?.title || 'Your Channel')}</b>\n` +
      `• <b>sᴛᴀᴛᴜs:</b> ⏳ <b>ᴜɴᴅᴇʀ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ ʀᴇᴠɪᴇᴡ</b>\n\n` +
      `ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ʜᴀs ʙᴇᴇɴ sᴜʙᴍɪᴛᴛᴇᴅ ᴀɴᴅ ɪs ᴡᴀɪᴛɪɴɢ ғᴏʀ ᴀᴘᴘʀᴏᴠᴀʟ. ʏᴏᴜ ᴡɪʟʟ ʀᴇᴄᴇɪᴠᴇ ᴀ ɴᴏᴛɪғɪᴄᴀᴛɪᴏɴ ʜᴇʀᴇ ᴀs sᴏᴏɴ ᴀs ɪᴛ ɪs ᴀᴄᴄᴇᴘᴛᴇᴅ!`;

    const kb = new InlineKeyboard()
      .text('🗑️ ᴄᴀɴᴄᴇʟ ʀᴇǫᴜᴇsᴛ', `user_chan_del_confirm:${chanDbId}`)
      .row()
      .text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴍʏ ᴄʜᴀɴɴᴇʟs', 'user_chan_list');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    return;
  }

  // 9. Rejected channel info
  if (data.startsWith('user_chan_rejected:')) {
    await ctx.answerCallbackQuery();
    const chanDbId = data.split(':')[1];
    const channel = await Channel.findById(chanDbId);

    const text =
      `❌ <b>ᴄʜᴀɴɴᴇʟ ʀᴇǫᴜᴇsᴛ ᴅᴇᴄʟɪɴᴇᴅ</b>\n\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ:</b> <b>${escapeHtml(channel?.title || 'Your Channel')}</b>\n` +
      `• <b>sᴛᴀᴛᴜs:</b> ❌ <b>ᴅᴇᴄʟɪɴᴇᴅ ʙʏ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ</b>\n\n` +
      `ʏᴏᴜ ᴄᴀɴ ʀᴇᴍᴏᴠᴇ ᴛʜɪs ᴇɴᴛʀʏ ᴏʀ ᴄᴏɴᴛᴀᴄᴛ sᴜᴘᴘᴏʀᴛ ᴠɪᴀ /contact.`;

    const kb = new InlineKeyboard()
      .text('🗑️ ʀᴇᴍᴏᴠᴇ ᴇɴᴛʀʏ', `user_chan_del:${chanDbId}`)
      .row()
      .text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴍʏ ᴄʜᴀɴɴᴇʟs', 'user_chan_list');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    return;
  }
}

/**
 * Handles incoming messages when a user is in WAITING_USER_CHANNEL_INPUT state
 */
export async function handleUserChannelInput(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const session = await getAdminSession(from.id);
  if (!session || session.state !== 'WAITING_USER_CHANNEL_INPUT') {
    return false;
  }

  const promptMessageId = session.data?.promptMessageId;
  const chatId = session.data?.chatId || ctx.chat?.id;

  // Clean up user's typed message or forwarded post so chat remains clean
  try {
    await ctx.deleteMessage();
  } catch {}

  const text = ctx.message?.text?.trim();

  // Cancel action: restore view in the SAME message
  if (text === '/cancel') {
    await clearAdminSession(from.id);
    const channels = await Channel.find({ addedByUserId: from.id }).sort({ createdAt: -1 });
    if (channels.length === 0) {
      const cancelText =
        `⚙️ <b>ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴅᴀsʜʙᴏᴀʀᴅ</b>\n\n` +
        `ʏᴏᴜ ʜᴀᴠᴇ ɴᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ ᴀɴʏ ᴄʜᴀɴɴᴇʟs ʏᴇᴛ.\n\n` +
        `• <b>ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ ᴍᴇᴍʙᴇʀs:</b> ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ᴀᴄᴄᴇᴘᴛ ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛs.\n` +
        `• <b>sʜᴀʀᴇᴀʙʟᴇ ᴅᴇᴇᴘ-ʟɪɴᴋs:</b> ɢᴇᴛ ᴘʀᴇᴍɪᴜᴍ sʜᴏʀᴛ ʟɪɴᴋs ғᴏʀ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ.`;
      const kb = new InlineKeyboard().text('➕ ᴀᴅᴅ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ', 'user_chan_add').row();
      await editOrReply(ctx, chatId, promptMessageId, cancelText, { parse_mode: 'HTML', reply_markup: kb });
      return true;
    }
    const { text: listText, keyboard: listKb } = renderUserChannelList(channels);
    await editOrReply(ctx, chatId, promptMessageId, listText, { parse_mode: 'HTML', reply_markup: listKb });
    return true;
  }

  let channelId: number | undefined;

  // Option A: Forwarded channel post
  const forwardOrigin = ctx.message?.forward_origin;
  if (forwardOrigin && forwardOrigin.type === 'channel' && forwardOrigin.chat) {
    channelId = forwardOrigin.chat.id;
  }

  // Option B: Numeric Channel ID (e.g. -1001234567890)
  if (!channelId && text) {
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed)) {
      channelId = parsed;
    }
  }

  // Option C: Channel Username (e.g. @MyChannel)
  if (!channelId && text && text.startsWith('@')) {
    try {
      const chat = await ctx.api.getChat(text);
      channelId = chat.id;
    } catch {
      // Handled below
    }
  }

  if (!channelId) {
    const retryText =
      `⚠️ <b>ɪɴᴠᴀʟɪᴅ ɪɴᴘᴜᴛ</b>\n\n` +
      `ᴘʟᴇᴀsᴇ ғᴏʀᴡᴀʀᴅ ᴀ ᴘᴏsᴛ ғʀᴏᴍ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴏʀ sᴇɴᴅ ɪᴛs ᴄʜᴀɴɴᴇʟ ɪᴅ (ᴇ.ɢ. <code>-1001234567890</code>).\n\n` +
      `<i>sᴇɴᴅ /cancel ᴛᴏ ᴀʙᴏʀᴛ.</i>`;
    const cancelKb = new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'user_chan_list');
    await editOrReply(ctx, chatId, promptMessageId, retryText, { parse_mode: 'HTML', reply_markup: cancelKb });
    return true;
  }

  const botUsername = ctx.me.username;

  // Validate and submit channel for admin approval
  const result = await ChannelService.submitUserChannel(ctx as any, channelId, {
    id: from.id,
    name: from.first_name,
    username: from.username,
  });

  if (!result.success || !result.channel) {
    const errorText =
      `❌ <b>ᴄᴏᴜʟᴅ ɴᴏᴛ ᴄᴏɴɴᴇᴄᴛ ᴄʜᴀɴɴᴇʟ</b>\n\n` +
      `${escapeHtml(result.error || 'Verification failed')}\n\n` +
      `💡 <b>ǫᴜɪᴄᴋ ᴄʜᴇᴄᴋʟɪsᴛ:</b>\n` +
      `1. ᴀᴅᴅ @${botUsername} ᴛᴏ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴀs ᴀɴ <b>ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ</b>.\n` +
      `2. ᴇɴsᴜʀᴇ <b>"ɪɴᴠɪᴛᴇ ᴜsᴇʀs ᴠɪᴀ ʟɪɴᴋ"</b> ɪs ᴇɴᴀʙʟᴇᴅ.\n` +
      `3. ғᴏʀᴡᴀʀᴅ ᴀ ᴘᴏsᴛ ᴏʀ sᴇɴᴅ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ɪᴅ ᴀɢᴀɪɴ.`;
    const cancelKb = new InlineKeyboard().text('🔙 ᴄᴀɴᴄᴇʟ', 'user_chan_list');
    await editOrReply(ctx, chatId, promptMessageId, errorText, { parse_mode: 'HTML', reply_markup: cancelKb });
    return true;
  }

  await clearAdminSession(from.id);

  // Edit in place to show success!
  const successText =
    `⏳ <b>ʀᴇǫᴜᴇsᴛ sᴜʙᴍɪᴛᴛᴇᴅ ғᴏʀ ʀᴇᴠɪᴇᴡ!</b>\n\n` +
    `ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ <b>${escapeHtml(result.channel.title)}</b> ʜᴀs ʙᴇᴇɴ sᴜʙᴍɪᴛᴛᴇᴅ ᴛᴏ ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ.\n\n` +
    `ʏᴏᴜ ᴡɪʟʟ ʀᴇᴄᴇɪᴠᴇ ᴀ ɴᴏᴛɪғɪᴄᴀᴛɪᴏɴ ʜᴇʀᴇ ᴀs sᴏᴏɴ ᴀs ɪᴛ ɪs ᴀᴄᴄᴇᴘᴛᴇᴅ.`;

  const viewKb = new InlineKeyboard().text('⚙️ ᴠɪᴇᴡ ᴍʏ ᴄʜᴀɴɴᴇʟs', 'user_chan_list');
  await editOrReply(ctx, chatId, promptMessageId, successText, { parse_mode: 'HTML', reply_markup: viewKb });

  // Dispatch interactive approval card to admins and log channel
  await sendChannelApprovalRequestToAdmins(ctx, result.channel);

  return true;
}

/**
 * Sends an interactive approval notification to Admins and Log Channel
 */
async function sendChannelApprovalRequestToAdmins(
  ctx: Context,
  channel: IChannel
): Promise<void> {
  const from = ctx.from!;
  const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const adminText =
    `📢 <b>ɴᴇᴡ ᴄʜᴀɴɴᴇʟ ᴀᴘᴘʀᴏᴠᴀʟ ʀᴇǫᴜᴇsᴛ</b>\n\n` +
    `• <b>ᴄʜᴀɴɴᴇʟ:</b> <b>${escapeHtml(channel.title)}</b>\n` +
    `• <b>ᴄʜᴀɴɴᴇʟ ɪᴅ:</b> <code>${channel.channelId}</code>\n` +
    `• <b>ᴜsᴇʀɴᴀᴍᴇ:</b> ${channel.username ? `@${channel.username}` : '<i>ɴᴏɴᴇ</i>'}\n` +
    `• <b>sᴜʙᴍɪᴛᴛᴇᴅ ʙʏ:</b> <a href="tg://user?id=${from.id}">${escapeHtml(from.first_name)}</a> (<code>${from.id}</code>)\n` +
    `• <b>ᴜsᴇʀ ʜᴀɴᴅʟᴇ:</b> ${from.username ? `@${from.username}` : '<i>ɴᴏɴᴇ</i>'}\n` +
    `• <b>ᴛɪᴍᴇ:</b> <code>${time} UTC</code>\n` +
    `• <b>sᴛᴀᴛᴜs:</b> ⏳ <b>ᴘᴇɴᴅɪɴɢ ʀᴇᴠɪᴇᴡ</b>\n\n` +
    `ᴘʟᴇᴀsᴇ ʀᴇᴠɪᴇᴡ ᴛʜɪs ʀᴇǫᴜᴇsᴛ ᴀɴᴅ ᴀᴄᴄᴇᴘᴛ ᴏʀ ʀᴇᴊᴇᴄᴛ:`;

  const approvalKb = new InlineKeyboard()
    .text('✅ ᴀᴄᴄᴇᴘᴛ', `admin_approve_chan:${channel._id}`)
    .text('❌ ʀᴇᴊᴇᴄᴛ', `admin_reject_chan:${channel._id}`);

  const settings = await getGlobalSettings();
  const allAdmins = Array.from(new Set([...config.adminIds, ...(settings.admins || [])]));

  for (const adminId of allAdmins) {
    try {
      await ctx.api.sendMessage(adminId, adminText, {
        parse_mode: 'HTML',
        reply_markup: approvalKb,
      });
    } catch (e) {
      console.warn(`[Approval] Could not deliver to admin ${adminId}:`, e);
    }
  }

  const logChannelId = await LoggerService.getLogChannelId();
  if (logChannelId) {
    try {
      await ctx.api.sendMessage(logChannelId, adminText, {
        parse_mode: 'HTML',
        reply_markup: approvalKb,
      });
    } catch (e) {
      console.warn('[Approval] Could not deliver to log channel:', e);
    }
  }
}

/**
 * Handles Admin [✅ Accept] and [❌ Reject] buttons
 */
export async function handleAdminApprovalCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const from = ctx.from;
  if (!data || !from || !(await isAdmin(from.id))) {
    await ctx.answerCallbackQuery({ text: 'Access denied.' });
    return;
  }

  const isApprove = data.startsWith('admin_approve_chan:');
  const isReject = data.startsWith('admin_reject_chan:');
  if (!isApprove && !isReject) return;

  const chanDbId = data.split(':')[1];
  const channel = await Channel.findById(chanDbId);

  if (!channel) {
    await ctx.answerCallbackQuery({ text: 'Channel not found.' });
    return;
  }

  if (channel.status !== 'pending') {
    await ctx.answerCallbackQuery({
      text: `This channel has already been ${channel.status}.`,
    });
    // Remove action buttons if already processed
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
    } catch {}
    return;
  }

  const botUsername = ctx.me.username;

  if (isApprove) {
    // 1. Generate direct Telegram join request invite link
    let inviteLink = channel.inviteLink;
    try {
      inviteLink = await LinkService.getOrCreateChannelInviteLink(
        ctx as any,
        channel.channelId,
        channel.title
      );
    } catch (e) {
      console.warn('[Approve] Could not create invite link:', e);
    }

    channel.status = 'approved';
    channel.inviteLink = inviteLink;
    if (!channel.startPayload) {
      channel.startPayload = LinkService.generateStartPayload(8);
    }
    await channel.save();

    await ctx.answerCallbackQuery({ text: 'Channel approved successfully!' });

    // 2. Update Admin notification message: display approved banner and remove buttons
    const updatedAdminText =
      `📢 <b>ᴄʜᴀɴɴᴇʟ ᴀᴘᴘʀᴏᴠᴀʟ ʀᴇǫᴜᴇsᴛ</b>\n\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ:</b> <b>${escapeHtml(channel.title)}</b>\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ ɪᴅ:</b> <code>${channel.channelId}</code>\n` +
      `• <b>sᴜʙᴍɪᴛᴛᴇᴅ ʙʏ:</b> <a href="tg://user?id=${channel.addedByUserId}">${escapeHtml(channel.addedByUserName || 'User')}</a> (<code>${channel.addedByUserId}</code>)\n` +
      `• <b>sᴛᴀᴛᴜs:</b> ✅ <b>ᴀᴘᴘʀᴏᴠᴇᴅ ʙʏ ${escapeHtml(from.first_name)}</b>`;

    try {
      await ctx.editMessageText(updatedAdminText, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard(),
      });
    } catch {}

    // 3. Notify Channel Owner with links and 1-tap copy buttons
    if (channel.addedByUserId) {
      const botDeepLink = LinkService.getBotDeepLink(botUsername, channel.startPayload);

      const ownerText =
        `🎉 <b>ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ ʜᴀs ʙᴇᴇɴ ᴀᴘᴘʀᴏᴠᴇᴅ!</b>\n\n` +
        `<b>${escapeHtml(channel.title)}</b> ɪs ɴᴏᴡ ᴀᴄᴛɪᴠᴇ ᴀɴᴅ ʀᴇᴀᴅʏ ᴛᴏ ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ ᴍᴇᴍʙᴇʀs!\n\n` +
        `🔗 <b>ʏᴏᴜʀ ʙᴏᴛ ɪɴᴠɪᴛᴇ ʟɪɴᴋ:</b>\n` +
        `<code>${botDeepLink}</code>\n\n` +
        `📨 <b>ᴄʜᴀɴɴᴇʟ ɪɴᴠɪᴛᴇ ʟɪɴᴋ:</b>\n` +
        `<code>${channel.inviteLink || ''}</code>\n\n` +
        `ʏᴏᴜ ᴄᴀɴ ᴍᴀɴᴀɢᴇ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ, ᴛᴏɢɢʟᴇ ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴀʟ, ᴏʀ ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ʟɪɴᴋs ᴀɴʏᴛɪᴍᴇ ᴠɪᴀ /managechat.`;

      const ownerKb = new InlineKeyboard()
        .copyText('📋 ᴄᴏᴘʏ ʙᴏᴛ ʟɪɴᴋ', botDeepLink)
        .row();

      if (channel.inviteLink) {
        ownerKb.copyText('📨 ᴄᴏᴘʏ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ', channel.inviteLink).row();
      }

      ownerKb.text('⚙️ ᴍᴀɴᴀɢᴇ ᴄʜᴀɴɴᴇʟ', `user_chan_view:${channel._id}`);

      try {
        await ctx.api.sendMessage(channel.addedByUserId, ownerText, {
          parse_mode: 'HTML',
          reply_markup: ownerKb,
        });
      } catch (dmErr) {
        console.warn(`[Approve] Could not DM channel owner ${channel.addedByUserId}:`, dmErr);
      }
    }

    LoggerService.logChannelAction(
      ctx as any,
      'Channel Approved by Admin',
      { id: channel.channelId, title: channel.title },
      from.id
    );
  } else {
    // REJECT
    channel.status = 'rejected';
    await channel.save();

    await ctx.answerCallbackQuery({ text: 'Channel rejected.' });

    // Update Admin notification message
    const updatedAdminText =
      `📢 <b>ᴄʜᴀɴɴᴇʟ ᴀᴘᴘʀᴏᴠᴀʟ ʀᴇǫᴜᴇsᴛ</b>\n\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ:</b> <b>${escapeHtml(channel.title)}</b>\n` +
      `• <b>ᴄʜᴀɴɴᴇʟ ɪᴅ:</b> <code>${channel.channelId}</code>\n` +
      `• <b>sᴜʙᴍɪᴛᴛᴇᴅ ʙʏ:</b> <a href="tg://user?id=${channel.addedByUserId}">${escapeHtml(channel.addedByUserName || 'User')}</a> (<code>${channel.addedByUserId}</code>)\n` +
      `• <b>sᴛᴀᴛᴜs:</b> ❌ <b>ʀᴇᴊᴇᴄᴛᴇᴅ ʙʏ ${escapeHtml(from.first_name)}</b>`;

    try {
      await ctx.editMessageText(updatedAdminText, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard(),
      });
    } catch {}

    // Notify Channel Owner
    if (channel.addedByUserId) {
      const ownerText =
        `⚠️ <b>ᴄʜᴀɴɴᴇʟ ʀᴇǫᴜᴇsᴛ ᴅᴇᴄʟɪɴᴇᴅ</b>\n\n` +
        `ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ ᴛᴏ ᴄᴏɴɴᴇᴄᴛ <b>${escapeHtml(channel.title)}</b> ᴡᴀs ᴅᴇᴄʟɪɴᴇᴅ ʙʏ ᴛʜᴇ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ.\n\n` +
        `ɪғ ʏᴏᴜ ʜᴀᴠᴇ ǫᴜᴇsᴛɪᴏɴs ᴏʀ ᴡᴏᴜʟᴅ ʟɪᴋᴇ ᴛᴏ ᴀᴘᴘᴇᴀʟ, ᴘʟᴇᴀsᴇ sᴇɴᴅ /contact.`;

      try {
        await ctx.api.sendMessage(channel.addedByUserId, ownerText, { parse_mode: 'HTML' });
      } catch (dmErr) {
        console.warn(`[Reject] Could not DM channel owner ${channel.addedByUserId}:`, dmErr);
      }
    }

    LoggerService.logChannelAction(
      ctx as any,
      'Channel Rejected by Admin',
      { id: channel.channelId, title: channel.title },
      from.id
    );
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
