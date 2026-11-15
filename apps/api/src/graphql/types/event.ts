import { builder } from '../builder.js';
import { Confidence, Exit, LinkKind, Presence } from '../enums.js';
import { LearningCharacter } from './inner.js';
import { EventSource } from './references.js';
import type { EventCharacterRow, EventLinkRow, EventRow, Scoped } from '../../projects/snapshot.js';

export const EventCharacter = builder.objectRef<EventCharacterRow>('EventCharacter').implement({
  description: 'Core module, with fields from the people module. One character taking part in one event. At most one row per character per event. Primary key: (`eventKey`, `characterKey`).',
  fields: (t) => ({
    characterKey: t.exposeID('characterKey', { description: 'Key of the character. Resolve against `Project.characters[].key`.' }),
    position: t.exposeInt('position', { nullable: true, description: 'Order of the character inside the event. Null keeps the stored order.' }),
    presence: t.field({ type: Presence, nullable: true, description: 'How the character takes part: body, mind, spirit, mentioned, or related. Null means not recorded.', resolve: (row) => row.presence }),
    exit: t.field({ type: Exit, nullable: true, description: 'Set when the character dies or leaves the story at this event.', resolve: (row) => row.exit }),
  }),
});

export const EventLink = builder.objectRef<EventLinkRow>('EventLink').implement({
  description: 'Core module. A directed link from the owning event to `toKey` with a free-text label and an optional explicit `kind`. The same pair can have several rows with different labels, but not two rows with the same `relation` in the same direction. An event never links to itself. Primary key: (`eventKey`, `position`).',
  fields: (t) => ({
    position: t.exposeInt('position', { description: 'Order of the link inside the owning event.' }),
    toKey: t.exposeID('toKey', { description: 'Key of the target event. Resolve against `Project.events[].key`.' }),
    relation: t.exposeString('relation', { nullable: true, description: 'The link label, free text, such as `causes`, `reveals`, `same time`, `flashback of`.' }),
    mutual: t.exposeBoolean('mutual', { description: 'True when the link reads the same in both directions, such as `same time`.' }),
    note: t.exposeString('note', { nullable: true, description: 'Why the events are linked.' }),
    kind: t.field({ type: LinkKind, nullable: true, description: 'The explicit kind of the link: cause, setup, reveal, or echo. When it is set, it wins over the `relation` word and over `mutual`. Null means no kind is stored: classify the `relation` word instead, and read a `mutual` link as an echo.', resolve: (row) => row.kind }),
  }),
});

export const Event = builder.objectRef<Scoped<EventRow>>('Event').implement({
  description: 'Core module, with fields from the setting and references modules. An event or a scene. Each event belongs to one act and may happen at one place. Action in several places at once is several events joined by `links`. Primary key: `key`. Every reference to an event in this API uses `key`, not `id`.',
  fields: (t) => ({
    key: t.exposeID('key', { description: 'The readable key, such as `coronation`. Every `sinceKey`, `untilKey`, and `toKey` field references this value.' }),
    id: t.exposeID('id', { nullable: true, description: 'A stable UUID supplied by the author. May be null. Not used by reference fields.' }),
    title: t.exposeString('title', { nullable: true, description: 'A short title for the event.' }),
    description: t.exposeString('description', { nullable: true, description: 'What happens in the event.' }),
    isCore: t.exposeBoolean('isCore', { description: 'True for an event that the main plot cannot do without. Default: false.' }),
    sortOrder: t.exposeInt('sortOrder', { nullable: true, description: 'Story order. Lower happens first. This can differ from the order the text tells the events. `Project.events` is already sorted by this value.' }),
    actName: t.string({ description: 'Name of the act the event belongs to. Resolve against `Project.acts[].name`.', resolve: (row) => row.act }),
    time: t.exposeString('time', { nullable: true, description: 'A free-text story time, such as `day 3, dawn` or `1890-04-12`. Compare by `sortOrder`, not by this text.' }),
    placeKey: t.id({ nullable: true, description: 'Key of the place where the event happens. Null when unknown or not relevant. Resolve against `Project.places[].key`.', resolve: (row) => row.placeKey }),
    confidence: t.field({ type: Confidence, nullable: true, description: 'How sure the author is about the event. Null means the event is certain.', resolve: (row) => row.confidence }),
    participants: t.field({
      type: [EventCharacter],
      description: 'The characters that take part, in position order. Empty means a world event: it happens without an actor and changes the setting for later events.',
      resolve: (row) => row.snapshot.participantsByEvent.get(row.key) ?? [],
    }),
    links: t.field({
      type: [EventLink],
      description: 'Outgoing links only, in position order. To see links that point at this event, scan `links` of the other events for `toKey` equal to this `key`.',
      resolve: (row) => row.snapshot.linksByEvent.get(row.key) ?? [],
    }),
    sources: t.field({
      type: [EventSource],
      description: 'The sources that give evidence for this event, in `position` order. Citations without a position come last, by `sourceKey`.',
      resolve: (row) => row.snapshot.sourcesByEvent.get(row.key) ?? [],
    }),
    learnings: t.field({
      type: [LearningCharacter],
      description: 'Learning intervals that start (`sinceKey`) or end (`untilKey`) at this event. Resolve `learningKey` against `Project.learnings[].key` and `characterKey` against `Project.characters[].key`.',
      resolve: (row) => row.snapshot.learningCharactersByEvent.get(row.key) ?? [],
    }),
  }),
});
