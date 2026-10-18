import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  userId: number;
  state: string;
  data?: any;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema: Schema = new Schema(
  {
    userId: { type: Number, required: true, unique: true, index: true },
    state: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Auto-clean abandoned interactive sessions 1 hour after last activity
SessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 3600 });

export const Session =
  mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);
