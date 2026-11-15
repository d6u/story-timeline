import { createServer } from 'node:http';
import { createApp } from './graphql/yoga.js';
import { createProjectRegistry, defaultDataDir } from './projects/registry.js';

const dataDir = process.env.DATA_DIR ?? defaultDataDir;
const port = Number(process.env.PORT ?? 4000);
/** Loopback only by default. Set `HOST=0.0.0.0` (or one address) to listen on the network; there is no auth. */
const host = process.env.HOST || '127.0.0.1';
const everyInterface = host === '0.0.0.0' || host === '::';

const registry = createProjectRegistry(dataDir);
const yoga = createApp(registry, { extraHosts: everyInterface ? null : [host] });
const server = createServer(yoga);

server.listen(port, host, () => {
  const shown = host.includes(':') ? `[${host}]` : host;
  console.log(`GraphQL ready: http://${shown}:${port}${yoga.graphqlEndpoint}`);
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') console.warn(`Listening on ${host}. The API has no auth.`);
  console.log(`Data folder: ${dataDir}`);
});

async function shutdown() {
  server.close();
  await registry.close();
  process.exit(0);
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
