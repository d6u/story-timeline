# Security

## Report a vulnerability

Report security problems privately. Use the "Report a vulnerability" button on the Security tab of this GitHub repository. Do not open a public issue for a security problem.

## The API is local-only

The API has no authentication. Any client that can reach it can read and change every project.

- Run the API only on your own machine.
- Do not expose it to a network. Keep `HOST` at its default `127.0.0.1`, and do not put the API behind a public proxy.
- The API accepts browser requests only from `localhost`, `127.0.0.1`, or `[::1]` pages, and checks the `Host` header. These checks stop other web sites from sending requests through your browser. They do not replace authentication.

A report that the API is open to anyone who can reach it over a network is expected behavior, not a vulnerability. Reports about the browser and `Host` checks, or about data access outside the data folder, are welcome.
