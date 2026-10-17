import { Bot } from 'grammy';

export interface CommandDefinition {
  command: string;
  description: string;
}

export const BOT_COMMANDS: CommandDefinition[] = [
  { command: 'start', description: 'sᴛᴀʀᴛ ᴛʜᴇ ʙᴏᴛ & ɢᴇᴛ ɪɴᴠɪᴛᴇ ʟɪɴᴋ' },
  { command: 'help', description: 'ɢᴜɪᴅᴇ & ɪɴsᴛʀᴜᴄᴛɪᴏɴs ᴏɴ ʜᴏᴡ ᴛᴏ ᴜsᴇ' },
  { command: 'contact', description: 'ᴄᴏɴᴛᴀᴄᴛ ᴀᴅᴍɪɴ ᴛᴏ ᴀᴅᴅ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟ' },
  { command: 'admin', description: 'ᴀᴅᴍɪɴ ᴄᴏɴᴛʀᴏʟ ᴅᴀsʜʙᴏᴀʀᴅ' },
];

/**
 * Automatically updates and syncs the Telegram command menu button
 */
export async function updateBotCommands(bot: Bot): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    await bot.api.setMyCommands(BOT_COMMANDS);
    console.log(`[CommandService] Successfully synced ${BOT_COMMANDS.length} commands with Telegram.`);
    return { success: true, count: BOT_COMMANDS.length };
  } catch (error: any) {
    console.error('[CommandService] Failed to set bot commands:', error);
    return { success: false, count: 0, error: error.message };
  }
}
