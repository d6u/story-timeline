import type { Plugin } from 'graphql-yoga';
import { GraphQLError, getOperationAST, type ExecutionResult } from 'graphql';
import { openDatabase } from '../db/client.js';
import type { Connection, ProjectRegistry } from '../projects/registry.js';
import type { Context } from './context.js';

/** How long a write waits for a lock that another process (a script, a second server) holds. */
const BUSY_TIMEOUT_MS = 2000;

/**
 * One write transaction per project file inside this process. SQLite allows one writer per file,
 * and the libsql client runs statements synchronously, so a second `BEGIN IMMEDIATE` on the same
 * file would block the event loop. Mutation documents for the same file wait here instead.
 */
const locks = new Map<string, Promise<void>>();

async function lock(path: string): Promise<() => void> {
  const previous = locks.get(path) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => (release = resolve));
  const tail = previous.then(() => current);
  locks.set(path, tail);
  await previous;
  return () => {
    release();
    if (locks.get(path) === tail) locks.delete(path);
  };
}

interface Writer {
  projectId: string;
  connection: Connection;
  release: () => void;
}

/**
 * The write transaction of one mutation document. The first field that writes a project opens a
 * dedicated connection to its file and runs `BEGIN IMMEDIATE`. Every later field, and every read
 * of that project in the same document, uses this connection, so later fields see earlier writes.
 * `finish` commits when the document has no errors and rolls back otherwise.
 */
export class WriteBatch {
  #writer: Promise<Writer | undefined> | undefined;
  #projectId: string | undefined;

  /** The open transaction connection of the project, or undefined when this document has not written it. */
  async reader(projectId: string): Promise<Connection | undefined> {
    if (this.#projectId !== projectId) return undefined;
    return (await this.#writer)?.connection;
  }

  /** The transaction connection for a write. Undefined for an unknown project. */
  async open(registry: ProjectRegistry, projectId: string): Promise<Connection | undefined> {
    if (this.#projectId !== undefined && this.#projectId !== projectId) {
      throw new GraphQLError(
        `One mutation document writes one project. This document already writes project ${this.#projectId}, so it cannot write project ${projectId}. Send one document per project.`,
        { extensions: { code: 'MULTIPLE_PROJECTS' } },
      );
    }
    if (!this.#writer) {
      const shared = await registry.open(projectId);
      if (!shared) return undefined;
      this.#projectId = projectId;
      this.#writer = begin(projectId, shared.path);
    }
    const writer = await this.#writer;
    return writer?.connection;
  }

  /** Whether a field of this document opened a transaction. */
  get started() {
    return this.#writer !== undefined;
  }

  /** Commits or rolls back. Returns the commit error, if any. A rollback error is not reported: the data stays unchanged either way. */
  async finish(commit: boolean): Promise<Error | undefined> {
    const pending = this.#writer;
    this.#writer = undefined;
    const writer = await pending?.catch(() => undefined);
    if (!writer) return undefined;
    try {
      if (commit) await writer.connection.client.execute('COMMIT');
      else await writer.connection.client.execute('ROLLBACK');
      return undefined;
    } catch (error) {
      try {
        await writer.connection.client.execute('ROLLBACK');
      } catch {
        // No transaction left to roll back.
      }
      return commit ? (error as Error) : undefined;
    } finally {
      writer.connection.client.close();
      writer.release();
    }
  }
}

async function begin(projectId: string, path: string): Promise<Writer> {
  const release = await lock(path);
  let connection: Connection | undefined;
  try {
    connection = await openDatabase(path);
    await connection.client.execute(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    await connection.client.execute('BEGIN IMMEDIATE');
    return { projectId, connection, release };
  } catch (error) {
    connection?.client.close();
    release();
    throw new GraphQLError(`Could not start the write transaction: ${(error as Error).message}`, { extensions: { code: 'TRANSACTION_FAILED' } });
  }
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

/**
 * Makes one mutation document one transaction. When any field has an error, nothing of the
 * document is written. The response keeps the field errors and adds
 * `extensions.transaction: "rolledBack"`; a written document gets `"committed"`.
 */
export function useAtomicMutations(): Plugin<Context> {
  return {
    onExecute({ args, executeFn, setExecuteFn }) {
      const operation = getOperationAST(args.document, args.operationName);
      if (operation?.operation !== 'mutation') return;
      setExecuteFn(async (execution) => {
        const batch = new WriteBatch();
        (execution.contextValue as Context).batch = batch;
        let result: Awaited<ReturnType<typeof executeFn>>;
        try {
          result = await executeFn(execution);
        } catch (error) {
          await batch.finish(false);
          throw error;
        } finally {
          (execution.contextValue as Context).batch = undefined;
        }
        if (isAsyncIterable(result)) {
          await batch.finish(false);
          return { errors: [new GraphQLError('Mutations with incremental delivery are not supported. Nothing was written.')] };
        }
        if (!batch.started) {
          await batch.finish(false);
          return result;
        }
        const failed = (result.errors?.length ?? 0) > 0;
        const commitError = await batch.finish(!failed);
        if (commitError) {
          return {
            data: null,
            errors: [new GraphQLError(`Database rejected the commit: ${commitError.message}. Nothing was written.`, { extensions: { code: 'DATABASE_CONSTRAINT' } })],
            extensions: { ...result.extensions, transaction: 'rolledBack' },
          } satisfies ExecutionResult;
        }
        return { ...result, extensions: { ...result.extensions, transaction: failed ? 'rolledBack' : 'committed' } };
      });
    },
  };
}
