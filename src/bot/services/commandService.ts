import { Bot, Api } from 'grammy';
import { config } from '../../config.js';
import { getGlobalSettings } from '../../db/models/Settings.js';

export interface CommandDefinition {
  command: string;
  description: string;
}

// Public commands visible to regular users (NO admin/dashboard commands shown)
export const PUBLIC_COMMANDS: CommandDefinition[] = [
  { command: 'start', description: 'sᴛᴀʀᴛ ᴛʜᴇ ʙᴏᴛ & ɢᴇᴛ ɪɴᴠɪᴛᴇ ʟɪɴᴋ' },
  { command: 'managechat', description: 'ᴍᴀɴᴀɢᴇ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟs & ʟɪɴᴋs' },
  { command: 'help', description: 'ɢᴜɪᴅᴇ & ɪɴsᴛʀᴜᴄᴛɪᴏɴs ᴏɴ ʜᴏᴡ ᴛᴏ ᴜsᴇ' },
  { command: 'contact', description: 'ᴄᴏɴᴛᴀᴄᴛ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ' },
];

// Admin-only commands (registered exclusively for authorized admin chat IDs)
export const ADMIN_COMMANDS: CommandDefinition[] = [
  { command: 'start', description: 'sᴛᴀʀᴛ ᴛʜᴇ ʙᴏᴛ' },
  { command: 'dashboard', description: 'ᴀᴅᴍɪɴ ᴄᴏɴᴛʀᴏʟ ᴅᴀsʜʙᴏᴀʀᴅ' },
  { command: 'managechat', description: 'ᴍᴀɴᴀɢᴇ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟs & ʟɪɴᴋs' },
  { command: 'help', description: 'ɢᴜɪᴅᴇ & ɪɴsᴛʀᴜᴄᴛɪᴏɴs' },
  { command: 'contact', description: 'ᴄᴏɴᴛᴀᴄᴛ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ' },
];

/**
 * Automatically updates and syncs the Telegram command menu button.
 * Regular users ONLY see public commands (/start, /help, /contact).
 * Authorized administrators receive /dashboard privately.
 */
export async function updateBotCommands(
  botOrApi: Bot | Api | { api: Api }
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const api: Api =
      'api' in botOrApi && botOrApi.api
        ? (botOrApi.api as Api)
        : (botOrApi as Api);

    // 1. Set global public commands (hides admin/dashboard commands from everyone)
    await api.setMyCommands(PUBLIC_COMMANDS, { scope: { type: 'default' } });

    // 2. Set admin-only scoped commands exclusively for authorized admin chat IDs
    let adminCount = 0;
    try {
      const settings = await getGlobalSettings();
      const allAdmins = Array.from(new Set([...config.adminIds, ...(settings.admins || [])]));

      for (const adminId of allAdmins) {
        try {
          await api.setMyCommands(ADMIN_COMMANDS, {
            scope: { type: 'chat', chat_id: adminId },
          });
          adminCount++;
        } catch {
          // Admin might not have started a private chat with the bot yet
        }
      }
    } catch (e) {
      console.warn('[CommandService] Could not set scoped admin commands:', e);
    }

    console.log(`[CommandService] Synced public commands and ${adminCount} admin scoped menus.`);
    return { success: true, count: PUBLIC_COMMANDS.length };
  } catch (error: any) {
    console.error('[CommandService] Failed to set bot commands:', error);
    return { success: false, count: 0, error: error.message };
  }
}
