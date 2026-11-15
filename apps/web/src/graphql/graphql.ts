import { initGraphQLTada } from 'gql.tada'
import type { introspection } from './graphql-env.d.ts'

/** Typed query builder. The types come from apps/api/schema.graphql through graphql-env.d.ts. */
export const graphql = initGraphQLTada<{ introspection: introspection }>()

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada'
