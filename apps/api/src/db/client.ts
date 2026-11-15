import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type ResultSet } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle/', import.meta.url));

/** The query API of a project file. An open write transaction offers the same API. */
export type Database = BaseSQLiteDatabase<'async', ResultSet, typeof schema>;

export interface OpenOptions {
  /** Busy timeout in milliseconds: how long a statement waits for a lock that another connection holds. */
  timeout?: number;
}

/**
 * Opens a client with exactly one SQLite connection. Since `@libsql/client` 0.18 a client keeps a
 * pool of connections, and `PRAGMA foreign_keys = ON` applies only to the connection that runs it.
 * With one connection, the pragma holds for every statement of the client, so the foreign keys
 * (and their `ON UPDATE CASCADE`) always work. The libsql client runs statements synchronously, so
 * a larger pool would not run them in parallel anyway.
 */
export async function openDatabase(filePath: string, options: OpenOptions = {}) {
  const path = resolve(filePath);
  mkdirSync(dirname(path), { recursive: true });
  const client = createClient({ url: `file:${path}`, concurrency: 1, timeout: options.timeout });
  try {
    await client.execute('PRAGMA foreign_keys = ON');
    const db = drizzle(client, { schema });
    return { db, client, path };
  } catch (error) {
    client.close();
    throw error;
  }
}

export async function createDatabase(filePath: string) {
  const connection = await openDatabase(filePath);
  try {
    await migrate(connection.db, { migrationsFolder });
    await connection.client.execute('PRAGMA foreign_keys = ON');
    return connection;
  } catch (error) {
    connection.client.close();
    throw error;
  }
}
