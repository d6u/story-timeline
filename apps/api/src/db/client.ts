import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle/', import.meta.url));

export async function openDatabase(filePath: string) {
  const path = resolve(filePath);
  mkdirSync(dirname(path), { recursive: true });
  const client = createClient({ url: `file:${path}` });
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
