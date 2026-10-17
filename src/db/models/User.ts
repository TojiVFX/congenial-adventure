import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  userId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  sourcePayload?: string;
  isBanned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    userId: { type: Number, required: true, unique: true, index: true },
    username: { type: String },
    firstName: { type: String, required: true },
    lastName: { type: String },
    sourcePayload: { type: String },
    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
