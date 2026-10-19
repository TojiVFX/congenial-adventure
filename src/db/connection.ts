import mongoose from 'mongoose';
import { config } from '../config.js';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Global cache across serverless warm lambdas
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    if (cached.conn.connection.readyState === 1) {
      return cached.conn;
    }
    // Socket was dropped or disconnected during serverless lambda freeze
    console.warn('[DB] Cached connection is no longer ready (readyState !== 1). Reconnecting...');
    cached.conn = null;
    cached.promise = null;
  }

  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    };

    cached.promise = mongoose.connect(config.mongodbUri, opts).then(mongooseInstance => {
      console.log('[DB] Connected to MongoDB Atlas');
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.conn = null;
    cached.promise = null;
    console.error('[DB] Error connecting to MongoDB:', e);
    throw e;
  }

  return cached.conn;
}
