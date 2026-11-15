import { lexicographicSortSchema, printSchema } from 'graphql';
import { schema } from './schema.js';

/** The SDL text committed to `apps/api/schema.graphql`. Descriptions are kept. */
export function printSortedSchema() {
  return `${printSchema(lexicographicSortSchema(schema))}\n`;
}
