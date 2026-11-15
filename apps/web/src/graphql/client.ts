import { Client, cacheExchange, fetchExchange } from '@urql/core'

/** Same-origin endpoint. Vite proxies it to the API in development; set VITE_GRAPHQL_URL to point elsewhere. */
export const client = new Client({
  url: import.meta.env.VITE_GRAPHQL_URL ?? '/graphql',
  exchanges: [cacheExchange, fetchExchange],
})
