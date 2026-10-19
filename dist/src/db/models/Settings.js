"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
exports.invalidateSettingsCache = invalidateSettingsCache;
exports.getGlobalSettings = getGlobalSettings;
exports.getAdminSession = getAdminSession;
exports.setAdminSession = setAdminSession;
exports.clearAdminSession = clearAdminSession;
const mongoose_1 = __importStar(require("mongoose"));
const Session_js_1 = require("./Session.js");
const SettingsSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, default: 'global' },
    logChannelId: { type: Number },
    admins: { type: [Number], default: [] },
    defaultWelcomeMessage: { type: String },
    adminSessions: { type: Map, of: Object, default: {} },
}, { timestamps: true });
exports.Settings = mongoose_1.default.models.Settings || mongoose_1.default.model('Settings', SettingsSchema);
let cachedSettings = null;
const CACHE_TTL_MS = 60 * 1000;
function invalidateSettingsCache() {
    cachedSettings = null;
}
async function getGlobalSettings(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedSettings && cachedSettings.expiresAt > now) {
        return cachedSettings.settings;
    }
    let settings = await exports.Settings.findOne({ key: 'global' });
    if (!settings) {
        settings = await exports.Settings.create({ key: 'global' });
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
async function getAdminSession(userId) {
    const session = await Session_js_1.Session.findOne({ userId });
    if (!session)
        return null;
    return { state: session.state, data: session.data };
}
async function setAdminSession(userId, state, data) {
    await Session_js_1.Session.findOneAndUpdate({ userId }, { state, data, updatedAt: new Date() }, { upsert: true, new: true });
}
async function clearAdminSession(userId) {
    await Session_js_1.Session.deleteOne({ userId });
}
