"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasButtons = hasButtons;
exports.editOrReply = editOrReply;
/**
 * Checks whether an InlineKeyboard has at least one button.
 * Telegram rejects messages where inline_keyboard is empty ([]).
 */
function hasButtons(keyboard) {
    if (!keyboard || !keyboard.inline_keyboard)
        return false;
    return keyboard.inline_keyboard.some(row => row.length > 0);
}
/**
 * Helper to edit an existing prompt message in-place, or fallback to a reply
 * if the message was already deleted or cannot be modified.
 */
async function editOrReply(ctx, chatId, messageId, text, options) {
    if (chatId && messageId) {
        try {
            await ctx.api.editMessageText(chatId, messageId, text, options);
            return;
        }
        catch (e) {
            console.warn('[TelegramUtil] Edit message in-place failed, falling back to reply:', e.message);
        }
    }
    await ctx.reply(text, options);
}
