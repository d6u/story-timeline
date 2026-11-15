import type { Plugin } from 'graphql-yoga';
import { GraphQLError, getOperationAST, type ExecutionResult } from 'graphql';
import { openDatabase, type Database } from '../db/client.js';
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
  /** `db` is the open transaction; `client` is the dedicated client that holds it. */
  connection: Connection;
  /** Ends the transaction: true commits, false rolls back. Resolves with the commit error, if any. */
  end: (commit: boolean) => Promise<Error | undefined>;
  release: () => void;
}

/** Thrown inside the transaction callback to make drizzle roll back. */
const ROLLBACK = Symbol('rollback');

/**
 * The write transaction of one mutation document. The first field that writes a project opens a
 * dedicated connection to its file and starts a transaction with `BEGIN IMMEDIATE`. Every later
 * field, and every read of that project in the same document, uses this transaction, so later
 * fields see earlier writes.
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
      return await writer.end(commit);
    } finally {
      writer.connection.client.close();
      writer.release();
    }
  }
}

/**
 * Opens a dedicated client and starts the write transaction with drizzle's `transaction()`. Since
 * `@libsql/client` 0.18, a `BEGIN` sent with `execute` is rolled back as soon as the statement
 * returns its connection to the pool, so the transaction must hold its connection through the
 * transaction API. The libsql default transaction mode is `write`, which is `BEGIN IMMEDIATE`: the
 * write lock is taken at the start, and `timeout` makes it wait for another process.
 * The transaction callback waits until `end` decides: it returns to commit and throws to roll back.
 */
async function begin(projectId: string, path: string): Promise<Writer> {
  const release = await lock(path);
  let connection: Connection | undefined;
  try {
    const opened = await openDatabase(path, { timeout: BUSY_TIMEOUT_MS });
    connection = opened;
    let decide!: (commit: boolean) => void;
    const decision = new Promise<boolean>((resolve) => (decide = resolve));
    let started!: (tx: Database) => void;
    let failed!: (error: unknown) => void;
    const transaction = new Promise<Database>((resolve, reject) => ((started = resolve), (failed = reject)));
    const done = opened.db.transaction(async (tx) => {
      started(tx);
      if (!(await decision)) throw ROLLBACK;
    });
    // A failed `BEGIN IMMEDIATE` (for example a busy file) rejects `done` before the callback runs.
    done.catch(failed);
    const tx = await transaction;
    const end = async (commit: boolean) => {
      decide(commit);
      try {
        await done;
        return undefined;
      } catch (error) {
        return commit && error !== ROLLBACK ? (error as Error) : undefined;
      }
    };
    return { projectId, connection: { ...opened, db: tx }, end, release };
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
