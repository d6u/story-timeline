import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: `file:${resolve(process.env.DATABASE_FILE ?? 'data/story.sqlite')}`,
  },
});
