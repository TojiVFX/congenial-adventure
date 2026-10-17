import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  key: string;
  logChannelId?: number;
  admins: number[];
  defaultWelcomeMessage?: string;
  adminSessions: Map<string, { state: string; data?: any }>;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema: Schema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    logChannelId: { type: Number },
    admins: { type: [Number], default: [] },
    defaultWelcomeMessage: { type: String },
    adminSessions: { type: Map, of: Object, default: {} },
  },
  { timestamps: true }
);

export const Settings = mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

export async function getGlobalSettings(): Promise<ISettings> {
  let settings = await Settings.findOne({ key: 'global' });
  if (!settings) {
    settings = await Settings.create({ key: 'global' });
  }
  return settings;
}

export async function getAdminSession(adminId: number): Promise<{ state: string; data?: any } | null> {
  const settings = await getGlobalSettings();
  if (!settings.adminSessions) return null;
  return settings.adminSessions.get(String(adminId)) || null;
}

export async function setAdminSession(adminId: number, state: string, data?: any): Promise<void> {
  const settings = await getGlobalSettings();
  if (!settings.adminSessions) {
    settings.adminSessions = new Map();
  }
  settings.adminSessions.set(String(adminId), { state, data });
  settings.markModified('adminSessions');
  await settings.save();
}

export async function clearAdminSession(adminId: number): Promise<void> {
  const settings = await getGlobalSettings();
  if (settings.adminSessions && settings.adminSessions.has(String(adminId))) {
    settings.adminSessions.delete(String(adminId));
    settings.markModified('adminSessions');
    await settings.save();
  }
}
