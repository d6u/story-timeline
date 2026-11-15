import { existsSync, rmSync } from 'node:fs';

/** Splits script arguments into `--force` and positional arguments. A bare `--` (pnpm may pass it through) is ignored. */
export function parseArgs(argv: string[], usage: string): { force: boolean; positional: string[] } {
  const args = argv.filter((arg) => arg !== '--');
  const unknown = args.filter((arg) => arg.startsWith('-') && arg !== '--force');
  if (unknown.length > 0) fail(`Unknown option: ${unknown.join(' ')}\n${usage}`);
  return { force: args.includes('--force'), positional: args.filter((arg) => arg !== '--force') };
}

/**
 * Makes room for a new database file. When the file exists, the script stops with exit code 1,
 * unless `force` is true; then the file and its SQLite journal files are deleted.
 */
export function clearTarget(file: string, force: boolean, rerun: string) {
  if (!existsSync(file)) return;
  if (!force) fail(`Refusing to replace ${file}: the file exists.\nTo delete it and build it again, run: ${rerun}`);
  for (const path of [file, `${file}-journal`, `${file}-wal`, `${file}-shm`]) rmSync(path, { force: true });
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
