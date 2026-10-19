"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function parseAdminIds(raw) {
    if (!raw)
        return [];
    return raw
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id));
}
function parseChannelId(raw) {
    if (!raw)
        return undefined;
    const parsed = parseInt(raw.trim(), 10);
    return isNaN(parsed) ? undefined : parsed;
}
exports.config = {
    botToken: process.env.BOT_TOKEN || '',
    mongodbUri: process.env.MONGODB_URI || '',
    adminIds: parseAdminIds(process.env.ADMIN_IDS),
    logChannelId: parseChannelId(process.env.LOG_CHANNEL_ID),
    appUrl: process.env.APP_URL?.replace(/\/$/, '') || '',
    webhookSecret: process.env.WEBHOOK_SECRET || '',
};
function validateConfig() {
    const missing = [];
    if (!exports.config.botToken)
        missing.push('BOT_TOKEN');
    if (!exports.config.mongodbUri)
        missing.push('MONGODB_URI');
    if (missing.length > 0) {
        console.warn(`[Config Warning] Missing environment variables: ${missing.join(', ')}`);
    }
}
