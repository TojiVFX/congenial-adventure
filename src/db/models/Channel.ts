import mongoose, { Schema, Document } from 'mongoose';

export interface IChannel extends Document {
  channelId: number;
  title: string;
  username?: string;
  inviteLink?: string;
  startPayload: string;
  autoApproveEnabled: boolean;
  status: 'pending' | 'approved' | 'rejected';
  welcomeMessage?: string;
  welcomeMedia?: string;
  addedByUserId?: number;
  addedByUserName?: string;
  addedByUserUsername?: string;
  totalRequests: number;
  totalApproved: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelSchema: Schema = new Schema(
  {
    channelId: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    username: { type: String },
    inviteLink: { type: String },
    startPayload: { type: String, required: true, unique: true, index: true },
    autoApproveEnabled: { type: Boolean, default: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
    welcomeMessage: { type: String },
    welcomeMedia: { type: String },
    addedByUserId: { type: Number },
    addedByUserName: { type: String },
    addedByUserUsername: { type: String },
    totalRequests: { type: Number, default: 0 },
    totalApproved: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Channel = mongoose.models.Channel || mongoose.model<IChannel>('Channel', ChannelSchema);
