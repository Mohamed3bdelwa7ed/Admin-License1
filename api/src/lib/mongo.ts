import mongoose from "mongoose";

/**
 * MongoDB connection module (Mongoose). One connection is shared by the
 * whole process; never open a new connection per request.
 */

export async function connectMongo(uri: string): Promise<typeof mongoose> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Configure it in the environment (see .env.example).");
  }
  mongoose.set("strictQuery", true);
  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: true, // ensure indexes exist (cheap after first run)
  });
  return conn;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function mongoHealth(): { connected: boolean; name: string | null; host: string | null } {
  const ready = mongoose.connection.readyState === 1;
  return {
    connected: ready,
    name: ready ? mongoose.connection.name : null,
    host: ready ? mongoose.connection.host : null,
  };
}

/**
 * Runs `fn` inside a MongoDB transaction (requires a replica set —
 * MongoDB Atlas free tier M0 runs on a replica set, so this works
 * in production and on mongodb-memory-server in tests).
 */
export async function withTransaction<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } finally {
    session.endSession();
  }
}
