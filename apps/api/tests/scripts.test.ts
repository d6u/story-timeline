import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const apiDir = fileURLToPath(new URL('..', import.meta.url));

/** Runs a script the way `pnpm db:*` does: from `apps/api`, with node and tsx. Every call names its target file, so `data/` is never touched. */
function run(script: string, args: string[]) {
  const { DATABASE_FILE: _ignored, ...env } = process.env;
  const result = spawnSync(process.execPath, ['--import', 'tsx', `scripts/${script}`, ...args], { cwd: apiDir, encoding: 'utf8', env });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

async function withTemp(check: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'story-scripts-'));
  try {
    await check(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('db:example refuses to replace an existing file without --force', async () => {
  await withTemp(async (dir) => {
    const kept = join(dir, '画皮.sqlite');
    await writeFile(kept, 'keep me');
    const refused = run('seed-example.ts', [dir]);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /Refusing to replace .*画皮\.sqlite: the file exists/);
    assert.match(refused.stderr, /--force/);
    assert.equal(await readFile(kept, 'utf8'), 'keep me');
    assert.deepEqual(await readdir(dir), ['画皮.sqlite'], 'a refusal builds no other file either');

    const forced = run('seed-example.ts', ['--', dir, '--force']);
    assert.equal(forced.status, 0, forced.stderr);
    assert.equal(forced.stdout.match(/Example project ready/g)?.length, 2);
    assert.notEqual(await readFile(kept, 'utf8'), 'keep me');
    assert.deepEqual((await readdir(dir)).sort(), ['odyssey.sqlite', '画皮.sqlite']);
  });
});

test('db:import refuses to replace an existing file without --force', async () => {
  await withTemp(async (dir) => {
    const source = join(dir, 'yaml');
    await mkdir(source);
    await writeFile(join(source, 'acts.yaml'), '- act-1\n');
    const file = join(dir, 'story.sqlite');
    await writeFile(file, 'keep me');

    const refused = run('import-yaml.ts', [source, file]);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /Refusing to replace .*story\.sqlite: the file exists/);
    assert.equal(await readFile(file, 'utf8'), 'keep me');

    const missing = run('import-yaml.ts', [join(dir, 'no-such-folder'), file, '--force']);
    assert.notEqual(missing.status, 0);
    assert.equal(await readFile(file, 'utf8'), 'keep me', 'a wrong source folder never deletes the target');

    const forced = run('import-yaml.ts', [source, file, '--force']);
    assert.equal(forced.status, 0, forced.stderr);
    assert.notEqual(await readFile(file, 'utf8'), 'keep me');
  });
});
