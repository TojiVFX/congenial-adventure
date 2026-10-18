import mongoose, { Schema, Document } from 'mongoose';

export interface IInviteLink extends Document {
  userId: number;
  channelId: number;
  inviteLink: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const InviteLinkSchema: Schema = new Schema(
  {
    userId: { type: Number, required: true, index: true },
    channelId: { type: Number, required: true, index: true },
    inviteLink: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-clean old records from MongoDB 1 hour after expiry
InviteLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

// Compound indexes for user link validation and bulk updates
InviteLinkSchema.index({ userId: 1, channelId: 1, used: 1, expiresAt: 1 });
InviteLinkSchema.index({ channelId: 1, used: 1 });

export const InviteLink =
  mongoose.models.InviteLink || mongoose.model<IInviteLink>('InviteLink', InviteLinkSchema);
