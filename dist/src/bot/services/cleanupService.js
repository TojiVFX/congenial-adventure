"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const v8_1 = __importDefault(require("v8"));
const vm_1 = __importDefault(require("vm"));
const RequestLog_js_1 = require("../../db/models/RequestLog.js");
const InviteLink_js_1 = require("../../db/models/InviteLink.js");
const Session_js_1 = require("../../db/models/Session.js");
const SystemError_js_1 = require("../../db/models/SystemError.js");
const channelService_js_1 = require("./channelService.js");
// Ensure V8 GC flag is enabled dynamically
try {
    v8_1.default.setFlagsFromString('--expose-gc');
}
catch { }
let cleanupTimer = null;
let memoryWatchTimer = null;
class CleanupService {
    /**
     * Triggers V8 Garbage Collection safely
     */
    static triggerGC() {
        try {
            if (typeof global.gc === 'function') {
                global.gc();
                return true;
            }
            vm_1.default.runInNewContext('gc')();
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Performs a comprehensive Disk and RAM cleanup cycle
     */
    static async performCleanup(options = {}) {
        const startTime = Date.now();
        const memBefore = process.memoryUsage();
        const ramBeforeMb = memBefore.rss / 1024 / 1024;
        // 1. Invalidate in-memory channel cache
        channelService_js_1.ChannelService.invalidateChannelCache();
        // 2. Prune old MongoDB records
        const retentionDays = options.logRetentionDays || 30;
        const logCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        const now = new Date();
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        let dbLogsRemoved = 0;
        let expiredLinksRemoved = 0;
        let sessionsRemoved = 0;
        let errorsRemoved = 0;
        try {
            const [logRes, linkRes, sessRes, errRes] = await Promise.all([
                RequestLog_js_1.RequestLog.deleteMany({ createdAt: { $lt: logCutoff } }),
                InviteLink_js_1.InviteLink.deleteMany({ expiresAt: { $lt: now } }),
                Session_js_1.Session.deleteMany({ updatedAt: { $lt: twoHoursAgo } }),
                SystemError_js_1.SystemError.deleteMany({ createdAt: { $lt: fourteenDaysAgo } }),
            ]);
            dbLogsRemoved = logRes.deletedCount || 0;
            expiredLinksRemoved = linkRes.deletedCount || 0;
            sessionsRemoved = sessRes.deletedCount || 0;
            errorsRemoved = errRes.deletedCount || 0;
        }
        catch (err) {
            console.warn('[CleanupService] DB prune error:', err);
        }
        // 3. Disk log cleaner: inspect root directory for oversized log files
        let diskBytesCleaned = 0;
        try {
            const rootDir = process.cwd();
            const files = fs_1.default.readdirSync(rootDir);
            for (const file of files) {
                if (file.endsWith('.log') && !file.includes('node_modules')) {
                    const filePath = path_1.default.join(rootDir, file);
                    try {
                        const stats = fs_1.default.statSync(filePath);
                        // If log file exceeds 5 MB, truncate it to save disk space
                        if (stats.size > 5 * 1024 * 1024) {
                            diskBytesCleaned += stats.size;
                            fs_1.default.writeFileSync(filePath, '', 'utf8');
                        }
                    }
                    catch { }
                }
            }
        }
        catch (diskErr) {
            console.warn('[CleanupService] Disk log prune error:', diskErr);
        }
        // 4. Force V8 Garbage Collection to release memory back to OS
        this.triggerGC();
        const memAfter = process.memoryUsage();
        const ramAfterMb = memAfter.rss / 1024 / 1024;
        const ramFreedMb = Math.max(0, ramBeforeMb - ramAfterMb);
        const durationMs = Date.now() - startTime;
        return {
            ramBeforeMb,
            ramAfterMb,
            ramFreedMb,
            dbLogsRemoved,
            expiredLinksRemoved,
            sessionsRemoved,
            errorsRemoved,
            diskBytesCleaned,
            durationMs,
        };
    }
    /**
     * Starts background recurring cleanup task and memory watchdog
     */
    static startAutoCleanup(intervalMinutes = 30) {
        if (cleanupTimer)
            clearInterval(cleanupTimer);
        if (memoryWatchTimer)
            clearInterval(memoryWatchTimer);
        // 1. Periodic cleanup every intervalMinutes (default 30 min)
        cleanupTimer = setInterval(async () => {
            try {
                const result = await CleanupService.performCleanup();
                console.log(`[AutoCleanup] Pruned ${result.dbLogsRemoved} DB logs, ${result.expiredLinksRemoved} links | RAM: ${result.ramBeforeMb.toFixed(1)}MB -> ${result.ramAfterMb.toFixed(1)}MB (Freed ${result.ramFreedMb.toFixed(1)}MB) in ${result.durationMs}ms`);
            }
            catch (err) {
                console.error('[AutoCleanup] Periodic error:', err);
            }
        }, intervalMinutes * 60 * 1000);
        // 2. High-memory watchdog (runs every 2 mins): prevents VPS out-of-memory crashes
        memoryWatchTimer = setInterval(() => {
            const rssMb = process.memoryUsage().rss / 1024 / 1024;
            if (rssMb > 350) {
                console.warn(`[AutoCleanup Watchdog] High RAM usage detected (${rssMb.toFixed(1)} MB). Forcing GC...`);
                CleanupService.triggerGC();
                const afterMb = process.memoryUsage().rss / 1024 / 1024;
                console.log(`[AutoCleanup Watchdog] RAM reduced to ${afterMb.toFixed(1)} MB.`);
            }
        }, 2 * 60 * 1000);
        // Initial background run 30 seconds after startup
        setTimeout(() => {
            CleanupService.performCleanup().catch(() => { });
        }, 30 * 1000);
    }
    /**
     * Stops auto cleanup timers (useful during graceful shutdown)
     */
    static stopAutoCleanup() {
        if (cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }
        if (memoryWatchTimer) {
            clearInterval(memoryWatchTimer);
            memoryWatchTimer = null;
        }
    }
}
exports.CleanupService = CleanupService;
