import { createDatabase } from '../src/db/client.js';

const args = process.argv.slice(2);
if (args.length > 1) {
  throw new Error('Use: pnpm db:create [database-file]');
}

const { client, path } = await createDatabase(
  args[0] ?? process.env.DATABASE_FILE ?? 'data/story.sqlite',
);
try {
  console.log(`Database ready: ${path}`);
} finally {
  client.close();
}
