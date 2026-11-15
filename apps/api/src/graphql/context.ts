import type { ProjectRegistry } from '../projects/registry.js';
import { loadSnapshot, type Snapshot } from '../projects/snapshot.js';
import type { WriteBatch } from './batch.js';

/**
 * Per-request state. `snapshots` memoises one full read per project per request.
 * `batch` is the write transaction while a mutation document runs; reads of the project it writes go through it.
 */
export interface Context {
  registry: ProjectRegistry;
  snapshots: Map<string, Promise<Snapshot | undefined>>;
  batch?: WriteBatch;
}

export function createContext(registry: ProjectRegistry): Context {
  return { registry, snapshots: new Map() };
}

export function snapshotFor(context: Context, projectId: string): Promise<Snapshot | undefined> {
  let pending = context.snapshots.get(projectId);
  if (!pending) {
    const batch = context.batch;
    pending = (async () => {
      const connection = (await batch?.reader(projectId)) ?? (await context.registry.open(projectId));
      return connection ? loadSnapshot(projectId, connection) : undefined;
    })();
    context.snapshots.set(projectId, pending);
  }
  return pending;
}

/** Forgets the memoised snapshot of a project after a write, so the next read in the same request sees the new rows. */
export function invalidate(context: Context, projectId: string) {
  context.snapshots.delete(projectId);
}
