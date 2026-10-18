import mongoose, { Schema, Document } from 'mongoose';

export interface IRequestLog extends Document {
  userId: number;
  userName: string;
  userUsername?: string;
  channelId: number;
  channelTitle: string;
  status: 'approved' | 'pending' | 'rejected';
  reason?: string;
  createdAt: Date;
}

const RequestLogSchema: Schema = new Schema(
  {
    userId: { type: Number, required: true, index: true },
    userName: { type: String, required: true },
    userUsername: { type: String },
    channelId: { type: Number, required: true, index: true },
    channelTitle: { type: String, required: true },
    status: { type: String, enum: ['approved', 'pending', 'rejected'], required: true },
    reason: { type: String },
  },
  { timestamps: true }
);

// High-performance compound indexes for filtering by channel and status
RequestLogSchema.index({ channelId: 1, status: 1 });
RequestLogSchema.index({ channelId: 1, userId: 1, status: 1 });
RequestLogSchema.index({ status: 1 });

export const RequestLog = mongoose.models.RequestLog || mongoose.model<IRequestLog>('RequestLog', RequestLogSchema);
