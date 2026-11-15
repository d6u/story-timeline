import { and, eq, max } from 'drizzle-orm';
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { GraphQLError } from 'graphql';
import type { Connection } from './registry.js';

/** Row values for an upsert. `undefined` means "not given": keep the stored value, or use the column default on insert. `null` clears the value. */
export type Patch = Record<string, unknown>;

/** Keeps only the keys that were given. Omitted keys never reach the database. */
function defined(values: Patch): Patch {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

/**
 * Inserts a row, or updates the given fields of the row with the same primary key.
 * `pkColumns` is the primary key, `values` must contain every primary key column.
 * Call it inside a write transaction (the mutation document's `WriteBatch`), so the check and the
 * write see the same data. A plain `ON CONFLICT DO UPDATE` is not used,
 * because SQLite checks NOT NULL before it detects the conflict, which would make a patch fail
 * whenever a required column such as `events.act` is omitted.
 */
export async function upsertRow(connection: Connection, table: SQLiteTable, pkColumns: AnySQLiteColumn[], values: Patch) {
  const given = defined(values);
  const pkNames = pkColumns.map((column) => keyOf(table, column));
  const where = and(...pkColumns.map((column, i) => eq(column, given[pkNames[i]] as string | number)));
  const set = Object.fromEntries(Object.entries(given).filter(([key]) => !pkNames.includes(key)));
  await run(async () => {
    const [existing] = await connection.db.select().from(table).where(where).limit(1);
    if (!existing) await connection.db.insert(table).values(given);
    else if (Object.keys(set).length > 0) await connection.db.update(table).set(set).where(where);
  });
}

/** Deletes the rows that match every given column value. Returns true when at least one row was removed. */
export async function deleteRows(connection: Connection, table: SQLiteTable, where: [AnySQLiteColumn, string | number][]) {
  const result = await run(() => connection.db.delete(table).where(and(...where.map(([column, value]) => eq(column, value)))));
  return result.rowsAffected > 0;
}

/**
 * Changes the primary key of one parent row from `from` to `to`. Every foreign key that points at
 * the column is `ON UPDATE CASCADE`, so SQLite moves the child rows to the new key in the same
 * statement. This needs `PRAGMA foreign_keys = ON` on the connection: without it the key changes
 * and the children keep the old key. `what` names the row in errors, such as `Character`.
 */
export async function renameKey(connection: Connection, table: SQLiteTable, column: AnySQLiteColumn, from: string, to: string, what: string) {
  if (to.trim() === '') throw new GraphQLError(`The new key of ${what} ${from} is empty. Give a non-empty key.`, { extensions: { code: 'BAD_KEY' } });
  if (to === from) throw new GraphQLError(`The new key of ${what} ${from} is the same as the old key. Nothing was renamed.`, { extensions: { code: 'KEY_UNCHANGED' } });
  const [existing] = await connection.db.select().from(table).where(eq(column, from)).limit(1);
  if (!existing) throw new GraphQLError(`${what} not found: ${from}. Nothing was renamed.`, { extensions: { code: 'NOT_FOUND' } });
  const [taken] = await connection.db.select().from(table).where(eq(column, to)).limit(1);
  if (taken) throw new GraphQLError(`${what} ${to} already exists. Pick a key that no other row uses. Nothing was renamed.`, { extensions: { code: 'KEY_EXISTS' } });
  await run(() => connection.db.update(table).set({ [keyOf(table, column)]: to }).where(eq(column, from)));
}

/** The next free position for child rows of one parent: `max(position) + 1`, or 1 when the parent has no rows. */
export async function nextPosition(connection: Connection, table: SQLiteTable, position: AnySQLiteColumn, parent: AnySQLiteColumn, parentKey: string) {
  const [row] = await connection.db.select({ max: max(position) }).from(table).where(eq(parent, parentKey));
  return Number(row?.max ?? 0) + 1;
}

/** The property name of a column inside its table, such as `placeKey` for `events.place_key`. */
function keyOf(table: SQLiteTable, column: AnySQLiteColumn): string {
  for (const [name, candidate] of Object.entries(table)) {
    if (candidate === column) return name;
  }
  throw new Error(`Column ${column.name} is not in its table`);
}

/** The integrity rules with a name of their own, and what each one means for the caller. */
const RULES: Record<string, string> = {
  member_is_one_way: 'A member relation is never mutual: `member` and `mutual` cannot both be true.',
  character_relations_not_self: 'A character cannot have a relation to itself: `otherKey` must differ from the owning `characterKey`.',
  event_links_not_self: 'An event cannot link to itself: `toKey` must differ from the owning `eventKey`.',
  places_not_own_parent: 'A place cannot be its own parent: `parentKey` must differ from `key`.',
  event_links_pair_relation_unique: 'An event has at most one link to the same `toKey` with the same `relation`. Patch the existing link by its `position` instead of adding a second one.',
};

/** The unique indexes over several columns, by the column list SQLite prints in its error. */
const UNIQUE_RULES: Record<string, string> = {
  'event_links.event_key, event_links.to_key, event_links.relation': 'event_links_pair_relation_unique',
};

/** The name of the rule that a constraint error reports, when the rule has one. */
function ruleOf(message: string): string | undefined {
  const check = /CHECK constraint failed: (\w+)/.exec(message);
  if (check) return check[1];
  const unique = /UNIQUE constraint failed: (.+)$/.exec(message);
  return unique ? UNIQUE_RULES[unique[1].trim()] : undefined;
}

/**
 * Runs a write and turns a database error (foreign key, check, unique, not null) into a GraphQL
 * error with the same message. A named rule adds its name and meaning, and `extensions.rule`.
 */
async function run<T>(write: () => PromiseLike<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const message = rootMessage(error);
    const rule = ruleOf(message);
    const meaning = rule && RULES[rule];
    throw new GraphQLError(`Database rejected the write: ${message}${meaning ? `. Rule ${rule}: ${meaning}` : ''}`, {
      extensions: { code: 'DATABASE_CONSTRAINT', ...(rule ? { rule } : {}) },
    });
  }
}

/** The innermost message of an error chain. Drizzle wraps the SQLite error, whose own message names the failed constraint. */
function rootMessage(error: unknown): string {
  let current = error;
  while (current instanceof Error && current.cause instanceof Error) current = current.cause;
  return current instanceof Error ? current.message : String(current);
}
