import type { IncomingMessage, ServerResponse } from 'http';
import { connectDB } from '../src/db/connection.js';

export default async function (req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  let dbStatus = 'disconnected';
  try {
    const db = await connectDB();
    dbStatus = db.connection.readyState === 1 ? 'connected' : 'connecting';
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
  }

  res.statusCode = 200;
  res.end(
    JSON.stringify(
      {
        status: 'online',
        service: 'Telegram Auto Request Accept Bot',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        vercel: true,
      },
      null,
      2
    )
  );
}
