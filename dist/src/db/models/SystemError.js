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
exports.SystemError = void 0;
exports.recordSystemError = recordSystemError;
const mongoose_1 = __importStar(require("mongoose"));
const errors_js_1 = require("../../bot/utils/errors.js");
const SystemErrorSchema = new mongoose_1.Schema({
    category: { type: String, required: true, index: true },
    message: { type: String, required: true },
    code: { type: Number },
    context: { type: String },
    stack: { type: String },
}, { timestamps: true });
// Auto-clean error logs after 7 days
SystemErrorSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });
exports.SystemError = mongoose_1.default.models.SystemError || mongoose_1.default.model('SystemError', SystemErrorSchema);
/**
 * Persists an error into the database for admin status reporting.
 * Benign errors (e.g. unmodified text, blocked DMs) are filtered out automatically.
 */
async function recordSystemError(error, context) {
    try {
        const classified = (0, errors_js_1.classifyError)(error);
        if (classified.isBenign)
            return; // Do not record benign errors
        const message = (error?.description || error?.message || String(error)).substring(0, 500);
        const stack = error?.stack ? String(error.stack).substring(0, 1000) : undefined;
        const code = error?.error_code || error?.code;
        await exports.SystemError.create({
            category: classified.category,
            message,
            code: typeof code === 'number' ? code : undefined,
            context: context ? context.substring(0, 200) : undefined,
            stack,
        });
    }
    catch (err) {
        console.warn('[SystemError] Failed to record error log to DB:', err);
    }
}
