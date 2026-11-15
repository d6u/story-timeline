import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { printSortedSchema } from '../src/graphql/print.js';

const schemaFile = fileURLToPath(new URL('../schema.graphql', import.meta.url));
await writeFile(schemaFile, printSortedSchema());
console.log(`Schema written: ${schemaFile}`);
