import { InlineKeyboard } from 'grammy';
import { IChannel } from '../../db/models/Channel.js';

export class AdminKeyboards {
  /**
   * Main Admin Dashboard Menu
   */
  static mainMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📊 Analytics & Stats', 'admin_stats')
      .text('📢 Manage Channels', 'admin_channels')
      .row()
      .text('🔗 Link Center', 'admin_gen_link')
      .text('📋 Log Channel', 'admin_log_settings')
      .row()
      .text('📣 Broadcast Message', 'admin_broadcast')
      .text('⚡ Sync Commands', 'admin_sync_commands')
      .row()
      .text('🔄 Refresh Dashboard', 'admin_refresh');
  }

  /**
   * Channel List Menu
   */
  static channelListMenu(channels: IChannel[]): InlineKeyboard {
    const kb = new InlineKeyboard();

    for (const ch of channels) {
      const statusIcon = ch.autoApproveEnabled ? '✅' : '⏸️';
      kb.text(`${statusIcon} ${ch.title}`, `channel_view_${ch.channelId}`).row();
    }

    kb.text('➕ Add New Channel', 'admin_add_channel')
      .row()
      .text('🔙 Back to Dashboard', 'admin_home');

    return kb;
  }

  /**
   * Single Channel Settings & Action Menu
   */
  static channelDetailMenu(channel: IChannel): InlineKeyboard {
    const toggleText = channel.autoApproveEnabled
      ? '✅ Auto-Approve: ON (Click to Disable)'
      : '⏸️ Auto-Approve: OFF (Click to Enable)';

    return new InlineKeyboard()
      .text(toggleText, `toggle_approve_${channel.channelId}`)
      .row()
      .text('🔗 View / Copy Links', `view_links_${channel.channelId}`)
      .row()
      .text('✏️ Edit Welcome Message', `edit_welcome_${channel.channelId}`)
      .text('🗑️ Remove Channel', `delete_channel_${channel.channelId}`)
      .row()
      .text('🔙 Back to Channels', 'admin_channels');
  }

  /**
   * Links Menu with Regenerate Action
   */
  static linksMenu(channelId: number): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔄 Generate New Short Link', `regen_link_${channelId}`)
      .row()
      .text('🔙 Back to Channel', `channel_view_${channelId}`);
  }

  /**
   * Back button to Main Dashboard
   */
  static backToHome(): InlineKeyboard {
    return new InlineKeyboard().text('🔙 Back to Dashboard', 'admin_home');
  }

  /**
   * Back button to Channel List
   */
  static backToChannels(): InlineKeyboard {
    return new InlineKeyboard().text('🔙 Back to Channels', 'admin_channels');
  }

  /**
   * Log Channel Management Menu
   */
  static logChannelMenu(hasChannel: boolean): InlineKeyboard {
    const kb = new InlineKeyboard();
    if (hasChannel) {
      kb.text('🧪 Send Test Log', 'test_log_channel').row();
    }
    kb.text('✏️ Set / Change Log Channel', 'set_log_channel')
      .row()
      .text('🔙 Back to Dashboard', 'admin_home');
    return kb;
  }
}
