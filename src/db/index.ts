import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Lazy database client.
 *
 * The pool is created on FIRST use (runtime), never at module import time —
 * so `next build` on platforms like Vercel succeeds even before environment
 * variables are attached. If DATABASE_URL is missing at runtime, queries fail
 * with a clear, actionable error.
 */

const globalForDb = globalThis as typeof globalThis & {
  __tbPool?: Pool;
  __tbDrizzle?: NodePgDatabase;
};

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Set it in your environment — Vercel: Project Settings → Environment Variables; local: .env"
    );
  }
  return new Pool({
    connectionString: databaseUrl,
    max: process.env.VERCEL ? 4 : 10,
  });
}

export function getPool(): Pool {
  if (!globalForDb.__tbPool) {
    globalForDb.__tbPool = createPool();
  }
  return globalForDb.__tbPool;
}

function getDb(): NodePgDatabase {
  if (!globalForDb.__tbDrizzle) {
    globalForDb.__tbDrizzle = drizzle(getPool());
  }
  return globalForDb.__tbDrizzle;
}

// Proxy that forwards every property/method to the lazily-created client.
export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop, receiver) {
    const instance = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});

export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const instance = getPool() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});
