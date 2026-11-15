import { builder } from '../builder.js';
import { snapshotFor } from '../context.js';
import { Character } from './character.js';
import { Event } from './event.js';
import { Learning } from './inner.js';
import { Source } from './references.js';
import { Act, Place } from './setting.js';
import type { ProjectInfo } from '../../projects/registry.js';

async function snapshot(project: ProjectInfo, context: Parameters<typeof snapshotFor>[0]) {
  const result = await snapshotFor(context, project.id);
  if (!result) throw new Error(`Project not found: ${project.id}`);
  return result;
}

export const Project = builder.objectRef<ProjectInfo>('Project').implement({
  description: 'One story. One project is one SQLite database file in the data folder of the server. All lists are complete, so one query can read the whole story.',
  fields: (t) => ({
    id: t.exposeID('id', { description: 'The project id: the database file name without `.sqlite`. Use it as the `id` argument of `Query.project`.' }),
    name: t.exposeString('name', { description: 'The display name of the project. The same as `id` for now.' }),
    acts: t.field({ type: [Act], description: 'All acts, in position order.', resolve: (p, _args, ctx) => snapshot(p, ctx).then((s) => s.acts) }),
    places: t.field({ type: [Place], description: 'All places, in position order.', resolve: (p, _args, ctx) => snapshot(p, ctx).then((s) => s.places) }),
    characters: t.field({ type: [Character], description: 'All characters, in position order.', resolve: (p, _args, ctx) => snapshot(p, ctx).then((s) => s.characters) }),
    events: t.field({ type: [Event], description: 'All events, in story order (`sortOrder`).', resolve: (p, _args, ctx) => snapshot(p, ctx).then((s) => s.events) }),
    learnings: t.field({ type: [Learning], description: 'All learnings, in position order.', resolve: (p, _args, ctx) => snapshot(p, ctx).then((s) => s.learnings) }),
    sources: t.field({ type: [Source], description: 'All sources, in priority order.', resolve: (p, _args, ctx) => snapshot(p, ctx).then((s) => s.sources) }),
  }),
});

builder.queryType({
  description: [
    'Read-only access to story data stored in SQLite.',
    'How to read a story: 1. Call `projects` to list the project ids. 2. Call `project(id:)` and select `acts`, `places`, `characters`, `events`, `learnings`, and `sources` with their nested lists; the whole story fits in one query. 3. Resolve every `*Key` and `actName` field on the client against the matching list: `characters[].key`, `events[].key`, `places[].key`, `learnings[].key`, `sources[].key`, `acts[].name`.',
    'Modules: core (characters, relations, events, participants, links), setting (acts, places), people (names, presence, exit), inner (learnings, arc stages), references (sources).',
  ].join('\n\n'),
  fields: (t) => ({
    projects: t.field({
      type: [Project],
      description: 'List the story projects the server can open. One project is one `*.sqlite` file in the data folder. Use `id` with `project(id:)`.',
      resolve: (_root, _args, ctx) => ctx.registry.list(),
    }),
    project: t.field({
      type: Project,
      nullable: true,
      description: 'Read one story project. Returns null when the id is unknown. Pending migrations are applied on first access.',
      args: { id: t.arg.id({ required: true, description: 'The project id from `projects`.' }) },
      resolve: async (_root, { id }, ctx) => {
        const projectId = String(id);
        const projects = await ctx.registry.list();
        return projects.find((p) => p.id === projectId) ?? null;
      },
    }),
  }),
});
