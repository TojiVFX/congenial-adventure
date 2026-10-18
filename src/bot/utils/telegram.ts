import { Context, InlineKeyboard } from 'grammy';

/**
 * Checks whether an InlineKeyboard has at least one button.
 * Telegram rejects messages where inline_keyboard is empty ([]).
 */
export function hasButtons(keyboard?: InlineKeyboard): boolean {
  if (!keyboard || !keyboard.inline_keyboard) return false;
  return keyboard.inline_keyboard.some(row => row.length > 0);
}

/**
 * Helper to edit an existing prompt message in-place, or fallback to a reply
 * if the message was already deleted or cannot be modified.
 */
export async function editOrReply(
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
      console.warn('[TelegramUtil] Edit message in-place failed, falling back to reply:', e.message);
    }
  }
  await ctx.reply(text, options);
}
