import { Bot, Api } from 'grammy';

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
 * Automatically updates and syncs the Telegram command menu button.
 * Accepts either a Bot instance, an Api instance, or a Context's api object.
 */
export async function updateBotCommands(
  botOrApi: Bot | Api | { api: Api }
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const api: Api =
      'api' in botOrApi && botOrApi.api
        ? (botOrApi.api as Api)
        : (botOrApi as Api);

    await api.setMyCommands(BOT_COMMANDS);
    console.log(`[CommandService] Successfully synced ${BOT_COMMANDS.length} commands with Telegram.`);
    return { success: true, count: BOT_COMMANDS.length };
  } catch (error: any) {
    console.error('[CommandService] Failed to set bot commands:', error);
    return { success: false, count: 0, error: error.message };
  }
}
