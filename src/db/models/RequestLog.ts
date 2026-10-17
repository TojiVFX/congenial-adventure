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

export const RequestLog = mongoose.models.RequestLog || mongoose.model<IRequestLog>('RequestLog', RequestLogSchema);
