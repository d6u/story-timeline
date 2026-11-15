import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../db/client.js';

export type Connection = Awaited<ReturnType<typeof createDatabase>>;

export interface ProjectInfo {
  id: string;
  name: string;
}

export interface ProjectRegistry {
  readonly dataDir: string;
  /** Lists the projects in the data folder. One `*.sqlite` file is one project. */
  list(): Promise<ProjectInfo[]>;
  /** Opens a project and applies pending migrations. Returns undefined for an unknown id. */
  open(id: string): Promise<Connection | undefined>;
  /** Closes every open connection. */
  close(): Promise<void>;
}

/** The default data folder: `apps/api/data`. */
export const defaultDataDir = fileURLToPath(new URL('../../data/', import.meta.url));

const EXTENSION = '.sqlite';
/** Letters and digits of any script, plus `_`, `.`, and `-`. Path separators are never allowed. */
const VALID_ID = /^[\p{L}\p{N}_.-]+$/u;

export function createProjectRegistry(dataDir: string = defaultDataDir): ProjectRegistry {
  const connections = new Map<string, Promise<Connection>>();

  async function list(): Promise<ProjectInfo[]> {
    let entries: string[];
    try {
      entries = await readdir(dataDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return entries
      .filter((file) => file.endsWith(EXTENSION))
      .map((file) => basename(file, EXTENSION))
      .filter((id) => VALID_ID.test(id))
      .sort()
      .map((id) => ({ id, name: id }));
  }

  async function open(id: string): Promise<Connection | undefined> {
    if (!VALID_ID.test(id)) return undefined;
    const existing = connections.get(id);
    if (existing) return existing;
    const known = (await list()).some((project) => project.id === id);
    if (!known) return undefined;
    const pending = createDatabase(join(dataDir, `${id}${EXTENSION}`));
    connections.set(id, pending);
    pending.catch(() => connections.delete(id));
    return pending;
  }

  async function close() {
    const pending = [...connections.values()];
    connections.clear();
    for (const connection of pending) {
      try {
        (await connection).client.close();
      } catch {
        // A connection that failed to open has nothing to close.
      }
    }
  }

  return { dataDir, list, open, close };
}
