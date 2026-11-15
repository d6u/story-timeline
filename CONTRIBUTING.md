# Contributing

Thank you for your help. This page tells you how to set up the project, check your change, and open a pull request.

## License of contributions

You contribute under the AGPL-3.0-only license of this project. There is no contributor license agreement (CLA) to sign.

## Setup

Use Node.js 22 or later and pnpm. The pnpm version is in the `packageManager` field of `package.json`. Run all commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Check your change

Run both commands before you open a pull request. CI runs them too.

```sh
pnpm typecheck
pnpm test
```

## GraphQL changes

- Every GraphQL type, field, argument, and enum value needs a description. AI agents read the schema to learn the story model, so write the description for them. A test fails when a description is missing.
- After a change in `apps/api/src/graphql/`, run `pnpm schema`. It writes `apps/api/schema.graphql` and `apps/web/src/graphql/graphql-env.d.ts`. Commit both files.

## Database changes

The database schema is fixed by design. Open an issue before you change `apps/api/src/db/schema.ts`. If the change is accepted, follow "Change the database schema" in the [README](README.md).

## Pull requests

- Keep one pull request to one topic.
- Add or update tests for the behavior you change.
- Update the README or the files in `docs/` when the behavior or the schema changes.
- Do not commit your own project databases. Git ignores `apps/api/data/*.sqlite`, except the example databases.
- Do not add copyrighted story data. Example data must be original or have a license that allows it.
- Write short, plain sentences in docs and descriptions. Lead with the point.
