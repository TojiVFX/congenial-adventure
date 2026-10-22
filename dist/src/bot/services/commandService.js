"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_COMMANDS = exports.PUBLIC_COMMANDS = void 0;
exports.updateBotCommands = updateBotCommands;
const config_js_1 = require("../../config.js");
const Settings_js_1 = require("../../db/models/Settings.js");
// Public commands visible to regular users (NO admin/dashboard commands shown)
exports.PUBLIC_COMMANDS = [
    { command: 'start', description: 'sᴛᴀʀᴛ ᴛʜᴇ ʙᴏᴛ & ɢᴇᴛ ɪɴᴠɪᴛᴇ ʟɪɴᴋ' },
    { command: 'managechat', description: 'ᴍᴀɴᴀɢᴇ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟs & ʟɪɴᴋs' },
    { command: 'acceptall', description: 'ᴀᴄᴄᴇᴘᴛ ᴀʟʟ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛs' },
    { command: 'help', description: 'ɢᴜɪᴅᴇ & ɪɴsᴛʀᴜᴄᴛɪᴏɴs ᴏɴ ʜᴏᴡ ᴛᴏ ᴜsᴇ' },
    { command: 'contact', description: 'ᴄᴏɴᴛᴀᴄᴛ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ' },
];
// Admin-only commands (registered exclusively for authorized admin chat IDs)
exports.ADMIN_COMMANDS = [
    { command: 'start', description: 'sᴛᴀʀᴛ ᴛʜᴇ ʙᴏᴛ' },
    { command: 'dashboard', description: 'ᴀᴅᴍɪɴ ᴄᴏɴᴛʀᴏʟ ᴅᴀsʜʙᴏᴀʀᴅ' },
    { command: 'status', description: 'sʏsᴛᴇᴍ sᴛᴀᴛᴜs & ᴇʀʀᴏʀ ʟᴏɢs' },
    { command: 'clean', description: 'ᴄʟᴇᴀɴ ʀᴀᴍ & ᴅɪsᴋ sᴛᴏʀᴀɢᴇ' },
    { command: 'managechat', description: 'ᴍᴀɴᴀɢᴇ ʏᴏᴜʀ ᴄʜᴀɴɴᴇʟs & ʟɪɴᴋs' },
    { command: 'acceptall', description: 'ᴀᴄᴄᴇᴘᴛ ᴀʟʟ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛs' },
    { command: 'reply', description: 'ʀᴇᴘʟʏ ᴛᴏ ᴜsᴇʀ: /reply <id> <msg>' },
    { command: 'help', description: 'ɢᴜɪᴅᴇ & ɪɴsᴛʀᴜᴄᴛɪᴏɴs' },
    { command: 'contact', description: 'ᴄᴏɴᴛᴀᴄᴛ ᴀᴅᴍɪɴɪsᴛʀᴀᴛᴏʀ' },
];
/**
 * Automatically updates and syncs the Telegram command menu button.
 * Regular users ONLY see public commands (/start, /help, /contact).
 * Authorized administrators receive /dashboard privately.
 */
async function updateBotCommands(botOrApi) {
    try {
        const api = 'api' in botOrApi && botOrApi.api
            ? botOrApi.api
            : botOrApi;
        // 1. Set global public commands (hides admin/dashboard commands from everyone)
        await api.setMyCommands(exports.PUBLIC_COMMANDS, { scope: { type: 'default' } });
        // 2. Set admin-only scoped commands exclusively for authorized admin chat IDs
        let adminCount = 0;
        try {
            const settings = await (0, Settings_js_1.getGlobalSettings)();
            const allAdmins = Array.from(new Set([...config_js_1.config.adminIds, ...(settings.admins || [])]));
            for (const adminId of allAdmins) {
                try {
                    await api.setMyCommands(exports.ADMIN_COMMANDS, {
                        scope: { type: 'chat', chat_id: adminId },
                    });
                    adminCount++;
                }
                catch {
                    // Admin might not have started a private chat with the bot yet
                }
            }
        }
        catch (e) {
            console.warn('[CommandService] Could not set scoped admin commands:', e);
        }
        console.log(`[CommandService] Synced public commands and ${adminCount} admin scoped menus.`);
        return { success: true, count: exports.PUBLIC_COMMANDS.length };
    }
    catch (error) {
        console.error('[CommandService] Failed to set bot commands:', error);
        return { success: false, count: 0, error: error.message };
    }
}
