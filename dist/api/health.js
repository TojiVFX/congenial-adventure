"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const connection_js_1 = require("../src/db/connection.js");
async function default_1(req, res) {
    res.setHeader('Content-Type', 'application/json');
    let dbStatus = 'disconnected';
    try {
        const db = await (0, connection_js_1.connectDB)();
        dbStatus = db.connection.readyState === 1 ? 'connected' : 'connecting';
    }
    catch (err) {
        dbStatus = `error: ${err.message}`;
    }
    res.statusCode = 200;
    res.end(JSON.stringify({
        status: 'online',
        service: 'Telegram Auto Request Accept Bot',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        vercel: true,
    }, null, 2));
}
