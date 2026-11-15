import { createYoga, type Plugin } from 'graphql-yoga';
import { useAtomicMutations } from './batch.js';
import { createContext, type Context } from './context.js';
import { schema } from './schema.js';
import type { ProjectRegistry } from '../projects/registry.js';

export interface AppOptions {
  /**
   * Extra host names the `Host` header may name, besides `localhost`, `127.0.0.1`, and `::1`.
   * The server passes its `HOST` setting here. `null` turns the `Host` check off (the server listens on every interface).
   */
  extraHosts?: string[] | null;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** True for an `Origin` header of a page served from this machine: `http(s)://localhost`, `127.0.0.1`, or `[::1]`, any port. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && LOOPBACK.has(url.hostname);
  } catch {
    return false;
  }
}

/** The host name of a `Host` header without the port: `localhost:4000` gives `localhost`, `[::1]:4000` gives `[::1]`. */
function hostName(host: string): string {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return '';
  }
}

/**
 * Blocks requests from other sites. A browser sends `Origin` on every cross-site POST, also on a
 * "simple" form POST (`application/x-www-form-urlencoded`, `multipart/form-data`) that needs no
 * preflight, so a request with a non-local `Origin` is refused before Yoga parses it. Requests with
 * no `Origin` (curl, scripts, GraphiQL page loads, same-origin GET) pass. The `Host` check stops
 * DNS rebinding, where a foreign page reaches this server under its own host name.
 */
function useLocalOnly(allowedHosts: Set<string> | null): Plugin {
  return {
    onRequest({ request, fetchAPI, endResponse }) {
      const refuse = (message: string) =>
        endResponse(new fetchAPI.Response(JSON.stringify({ errors: [{ message }] }), { status: 403, headers: { 'content-type': 'application/json' } }));
      const origin = request.headers.get('origin');
      if (origin !== null && !isLocalOrigin(origin)) return refuse(`Origin not allowed: ${origin}. The API accepts browser requests only from localhost pages.`);
      const host = request.headers.get('host');
      if (allowedHosts && host !== null && !allowedHosts.has(hostName(host))) return refuse(`Host not allowed: ${host}.`);
    },
  };
}

/** Builds the GraphQL app. GraphiQL and introspection stay on so agents can discover the schema. */
export function createApp(registry: ProjectRegistry, options: AppOptions = {}) {
  const extra = options.extraHosts === undefined ? [] : options.extraHosts;
  const allowedHosts = extra === null ? null : new Set([...LOOPBACK, ...extra.map((host) => hostName(host.includes(':') && !host.startsWith('[') ? `[${host}]` : host))]);
  return createYoga<object, Context>({
    schema,
    graphqlEndpoint: '/graphql',
    graphiql: true,
    // No file uploads: refuse multipart bodies, one of the content types a form can send without preflight.
    multipart: false,
    cors: (request) => {
      const origin = request.headers.get('origin');
      return origin !== null && isLocalOrigin(origin) ? { origin: [origin] } : false;
    },
    plugins: [useLocalOnly(allowedHosts), useAtomicMutations()],
    context: () => createContext(registry),
  });
}
