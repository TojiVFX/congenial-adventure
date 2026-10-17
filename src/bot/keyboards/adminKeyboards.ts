import { InlineKeyboard } from 'grammy';
import { IChannel } from '../../db/models/Channel.js';

export class AdminKeyboards {
  /**
   * Main Admin Dashboard Menu (Manual Smallcaps)
   */
  static mainMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📊 ᴀɴᴀʟʏᴛɪᴄs & sᴛᴀᴛs', 'admin_stats')
      .text('📢 ᴍᴀɴᴀɢᴇ ᴄʜᴀɴɴᴇʟs', 'admin_channels')
      .row()
      .text('🔗 ʟɪɴᴋ ᴄᴇɴᴛᴇʀ', 'admin_gen_link')
      .text('📋 ʟᴏɢ ᴄʜᴀɴɴᴇʟ', 'admin_log_settings')
      .row()
      .text('📣 ʙʀᴏᴀᴅᴄᴀsᴛ ᴍᴇssᴀɢᴇ', 'admin_broadcast')
      .text('⚡ sʏɴᴄ ᴄᴏᴍᴍᴀɴᴅs', 'admin_sync_commands')
      .row()
      .text('🔄 ʀᴇғʀᴇsʜ ᴅᴀsʜʙᴏᴀʀᴅ', 'admin_refresh');
  }

  /**
   * Channel List Menu
   */
  static channelListMenu(channels: IChannel[]): InlineKeyboard {
    const kb = new InlineKeyboard();

    for (const ch of channels) {
      let statusIcon = ch.autoApproveEnabled ? '✅' : '⏸️';
      let suffix = '';
      if (ch.status === 'pending') {
        statusIcon = '⏳';
        suffix = ' (ᴘᴇɴᴅɪɴɢ)';
      } else if (ch.status === 'rejected') {
        statusIcon = '❌';
        suffix = ' (ᴅᴇᴄʟɪɴᴇᴅ)';
      }
      kb.text(`${statusIcon} ${ch.title}${suffix}`, `channel_view_${ch.channelId}`).row();
    }

    kb.text('➕ ᴀᴅᴅ ɴᴇᴡ ᴄʜᴀɴɴᴇʟ', 'admin_add_channel')
      .row()
      .text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴅᴀsʜʙᴏᴀʀᴅ', 'admin_home');

    return kb;
  }

  /**
   * Single Channel Settings & Action Menu
   */
  static channelDetailMenu(channel: IChannel, deepLink?: string): InlineKeyboard {
    const toggleText = channel.autoApproveEnabled
      ? '✅ ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ: ᴏɴ (ᴄʟɪᴄᴋ ᴛᴏ ᴅɪsᴀʙʟᴇ)'
      : '⏸️ ᴀᴜᴛᴏ-ᴀᴘᴘʀᴏᴠᴇ: ᴏғғ (ᴄʟɪᴄᴋ ᴛᴏ ᴇɴᴀʙʟᴇ)';

    const kb = new InlineKeyboard()
      .text(toggleText, `toggle_approve_${channel.channelId}`)
      .row();

    // If deepLink is provided, add premium 1-tap copy button
    if (deepLink) {
      kb.copyText('📋 ᴄᴏᴘʏ ʙᴏᴛ ʟɪɴᴋ', deepLink);
      const copyChannel =
        channel.inviteLink ||
        channel.normalLink ||
        (channel.username ? `https://t.me/${channel.username.replace(/^@/, '')}` : undefined);
      if (copyChannel) {
        kb.copyText('📨 ᴄᴏᴘʏ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ', copyChannel);
      }
      kb.row();
    }

    kb.text('🔗 ᴠɪᴇᴡ ᴀʟʟ ʟɪɴᴋs', `view_links_${channel.channelId}`)
      .text('🔄 ɴᴇᴡ sʜᴏʀᴛ ʟɪɴᴋ', `regen_link_${channel.channelId}`)
      .row()
      .text('✏️ ᴇᴅɪᴛ ᴡᴇʟᴄᴏᴍᴇ ᴍᴇssᴀɢᴇ', `edit_welcome_${channel.channelId}`)
      .text('🗑️ ʀᴇᴍᴏᴠᴇ ᴄʜᴀɴɴᴇʟ', `delete_channel_${channel.channelId}`)
      .row()
      .text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴄʜᴀɴɴᴇʟs', 'admin_channels');

    return kb;
  }

  /**
   * Links Menu with Premium 1-Tap Copy Text Buttons
   */
  static linksMenu(channelId: number, deepLink: string, inviteLink?: string): InlineKeyboard {
    const kb = new InlineKeyboard();

    // Premium Telegram native 1-tap Copy Text button
    kb.copyText('📋 ᴄᴏᴘʏ ʙᴏᴛ ʟɪɴᴋ', deepLink).row();

    if (inviteLink) {
      kb.copyText('📨 ᴄᴏᴘʏ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ', inviteLink).row();
    }

    kb.text('🔄 ɢᴇɴᴇʀᴀᴛᴇ ɴᴇᴡ sʜᴏʀᴛ ʟɪɴᴋ', `regen_link_${channelId}`)
      .row()
      .text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴄʜᴀɴɴᴇʟ', `channel_view_${channelId}`);

    return kb;
  }

  /**
   * Back button to Main Dashboard
   */
  static backToHome(): InlineKeyboard {
    return new InlineKeyboard().text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴅᴀsʜʙᴏᴀʀᴅ', 'admin_home');
  }

  /**
   * Back button to Channel List
   */
  static backToChannels(): InlineKeyboard {
    return new InlineKeyboard().text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴄʜᴀɴɴᴇʟs', 'admin_channels');
  }

  /**
   * Log Channel Management Menu
   */
  static logChannelMenu(hasChannel: boolean): InlineKeyboard {
    const kb = new InlineKeyboard();
    if (hasChannel) {
      kb.text('🧪 sᴇɴᴅ ᴛᴇsᴛ ʟᴏɢ', 'test_log_channel').row();
    }
    kb.text('✏️ sᴇᴛ / ᴄʜᴀɴɢᴇ ʟᴏɢ ᴄʜᴀɴɴᴇʟ', 'set_log_channel')
      .row()
      .text('🔙 ʙᴀᴄᴋ ᴛᴏ ᴅᴀsʜʙᴏᴀʀᴅ', 'admin_home');
    return kb;
  }
}
