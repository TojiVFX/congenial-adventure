import mongoose, { Schema, Document } from 'mongoose';
import { Session } from './Session.js';

export interface ISettings extends Document {
  key: string;
  logChannelId?: number;
  admins: number[];
  defaultWelcomeMessage?: string;
  adminSessions?: Map<string, { state: string; data?: any }>;
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

// In-Memory Warm Lambda Cache with 60s TTL
interface SettingsCache {
  settings: ISettings;
  expiresAt: number;
}

let cachedSettings: SettingsCache | null = null;
const CACHE_TTL_MS = 60 * 1000;

export function invalidateSettingsCache(): void {
  cachedSettings = null;
}

export async function getGlobalSettings(forceRefresh: boolean = false): Promise<ISettings> {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && cachedSettings.expiresAt > now) {
    return cachedSettings.settings;
  }

  let settings = await Settings.findOne({ key: 'global' });
  if (!settings) {
    settings = await Settings.create({ key: 'global' });
  }

  cachedSettings = {
    settings,
    expiresAt: now + CACHE_TTL_MS,
  };

  return settings;
}

/**
 * Dedicated, atomic Session management backed by TTL-indexed Session model.
 * Retains exact API compatibility with existing handlers.
 */
export async function getAdminSession(userId: number): Promise<{ state: string; data?: any } | null> {
  const session = await Session.findOne({ userId });
  if (!session) return null;
  return { state: session.state, data: session.data };
}

export async function setAdminSession(userId: number, state: string, data?: any): Promise<void> {
  await Session.findOneAndUpdate(
    { userId },
    { state, data, updatedAt: new Date() },
    { upsert: true, new: true }
  );
}

export async function clearAdminSession(userId: number): Promise<void> {
  await Session.deleteOne({ userId });
}
