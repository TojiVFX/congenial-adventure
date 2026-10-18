import mongoose, { Schema, Document } from 'mongoose';
import { classifyError } from '../../bot/utils/errors.js';

export interface ISystemError extends Document {
  category: string;
  message: string;
  code?: number;
  context?: string;
  stack?: string;
  createdAt: Date;
}

const SystemErrorSchema: Schema = new Schema(
  {
    category: { type: String, required: true, index: true },
    message: { type: String, required: true },
    code: { type: Number },
    context: { type: String },
    stack: { type: String },
  },
  { timestamps: true }
);

// Auto-clean error logs after 7 days
SystemErrorSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

export const SystemError =
  mongoose.models.SystemError || mongoose.model<ISystemError>('SystemError', SystemErrorSchema);

/**
 * Persists an error into the database for admin status reporting.
 * Benign errors (e.g. unmodified text, blocked DMs) are filtered out automatically.
 */
export async function recordSystemError(
  error: any,
  context?: string
): Promise<void> {
  try {
    const classified = classifyError(error);
    if (classified.isBenign) return; // Do not record benign errors

    const message = (error?.description || error?.message || String(error)).substring(0, 500);
    const stack = error?.stack ? String(error.stack).substring(0, 1000) : undefined;
    const code = error?.error_code || error?.code;

    await SystemError.create({
      category: classified.category,
      message,
      code: typeof code === 'number' ? code : undefined,
      context: context ? context.substring(0, 200) : undefined,
      stack,
    });
  } catch (err) {
    console.warn('[SystemError] Failed to record error log to DB:', err);
  }
}
