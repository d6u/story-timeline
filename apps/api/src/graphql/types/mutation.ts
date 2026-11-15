import { GraphQLError } from 'graphql';
import * as schema from '../../db/schema.js';
import type { Connection } from '../../projects/registry.js';
import type { Snapshot } from '../../projects/snapshot.js';
import { deleteRows, nextPosition, renameKey, upsertRow } from '../../projects/write.js';
import { builder } from '../builder.js';
import { invalidate, snapshotFor, type Context } from '../context.js';
import {
  ActInput, ArcStageInput, CharacterInput, CharacterNameInput, CharacterRelationInput, EventCharacterInput,
  EventInput, EventLinkInput, EventSourceInput, LearningCharacterInput, LearningInput, PlaceInput, SourceInput,
} from '../inputs.js';
import { Character, CharacterName, CharacterRelation } from './character.js';
import { Event, EventCharacter, EventLink } from './event.js';
import { ArcStage, Learning, LearningCharacter } from './inner.js';
import { EventSource, Source } from './references.js';
import { Act, Place } from './setting.js';

type Id = string | number;
const id = (value: Id | null | undefined) => (value === null || value === undefined ? value : String(value));

async function open(ctx: Context, projectId: Id): Promise<[Connection, string]> {
  const key = String(projectId);
  if (!ctx.batch) throw new GraphQLError('A mutation ran outside the write transaction.', { extensions: { code: 'INTERNAL' } });
  const connection = await ctx.batch.open(ctx.registry, key);
  if (!connection) throw new GraphQLError(`Project not found: ${key}`, { extensions: { code: 'PROJECT_NOT_FOUND' } });
  return [connection, key];
}

/** Reads the project again after a write and returns the row that `pick` selects. */
async function fresh<T>(ctx: Context, projectId: string, pick: (snapshot: Snapshot) => T | undefined, what: string): Promise<T> {
  invalidate(ctx, projectId);
  const snapshot = await snapshotFor(ctx, projectId);
  const row = snapshot && pick(snapshot);
  if (!row) throw new GraphQLError(`Row not found after write: ${what}`);
  return row;
}

const PROJECT = { required: true, description: 'The project id from `projects`.' } as const;
const POSITION = { required: true, description: 'The `position` of the row to delete.' } as const;
const RENAME = 'Runs inside the write transaction of the document, so a later failure in the same document undoes the rename. Fails when the old key is not found or the new key already exists; nothing is renamed then.';

builder.mutationType({
  description: [
    'Write access to the same story data `Query` reads. Every field takes a `projectId`. `upsert*` and `delete*` write one row of one table; `rename*` changes one primary key and every reference to it.',
    'How to edit a story: 1. Read the project with `Query.project` and build the key maps; never invent a key that is not in the lists. 2. Write parents before children, in this order inside one document: acts, places, characters, sources, learnings; then events; then names, relations, arc stages, participants, links, citations, learning intervals. GraphQL runs the fields of a mutation document one after the other, in document order. 3. Read the project again and check that every `*Key` resolves.',
    'Semantics: `upsert*` inserts the row when its primary key is new and otherwise updates only the fields you give (PATCH). Omitted fields keep their value; `null` clears a field. A batch that gives every primary key, including `position`, can be resent safely; a row sent without `position` is appended again on every resend (a link with a `relation` word fails on resend instead, because of the unique link rule, and the whole document rolls back). `delete*` removes one row and returns true when it existed. Nothing cascades on delete: delete child rows before their parent, or the database rejects the delete and the error says which foreign key failed. CHECK constraints (enum values such as `tone` and `kind`, `member` never together with `mutual`, no relation from a character to itself, no link from an event to itself, no place that is its own parent) and the unique link rule (one link per `eventKey`, `toKey`, and `relation`) are reported the same way; the error names the rule and `extensions.rule` holds its name. One mutation document is one transaction and writes one project: when any field fails, nothing of the document is written, `errors` names the failed field, and `data` is null. The response `extensions.transaction` is `committed` or `rolledBack`.',
    'Keys: an upsert with a new key inserts a new row; it never renames. To change a key, call `renameAct(name, newName)` or `renamePlace`, `renameCharacter`, `renameEvent`, `renameLearning`, `renameSource` with (`key`, `newKey`). Every foreign key is ON UPDATE CASCADE, so every child row and every reference (relations at both ends, links at both ends, `sinceKey`, `untilKey`, `placeKey`, `parentKey`, `actName`, citations) moves to the new key in the same statement. The old key is gone afterwards; use the new key in later fields of the same document.',
    'Link kind, relation tone, and citation order: `EventLinkInput.kind` stores the explicit kind of a link (cause, setup, reveal, echo). `CharacterRelationInput.tone` stores the explicit tone of a relation (family, love, friend, work, hostile, other). Set either one when the `relation` word does not say it clearly; `other` means none of the named tones. Null clears it, and readers then classify the `relation` word. A `member` relation needs no tone. `EventSourceInput.position` orders the citations of an event; `Event.sources` returns them by position, with unnumbered ones last.',
    'Positions: for relations, links, arc stages, and learning intervals the primary key includes `position`. Omit it to append after the last row of that parent, or read the existing rows first and give explicit positions when the batch may run twice. Participants and names have no append: give `position` by hand.',
  ].join('\n\n'),
  fields: (t) => ({
    upsertAct: t.field({
      type: Act, description: 'Insert or update one act by `name`.',
      args: { projectId: t.arg.id(PROJECT), input: t.arg({ type: ActInput, required: true, description: 'The act fields.' }) },
      resolve: async (_r, { projectId, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        await upsertRow(c, schema.acts, [schema.acts.name], input);
        return fresh(ctx, p, (s) => s.acts.find((a) => a.name === input.name), `act ${input.name}`);
      },
    }),
    deleteAct: t.boolean({
      description: 'Delete one act by `name`. Fails while events still reference it.',
      args: { projectId: t.arg.id(PROJECT), name: t.arg.string({ required: true, description: 'The act name.' }) },
      resolve: async (_r, { projectId, name }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.acts, [[schema.acts.name, name]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertPlace: t.field({
      type: Place, description: 'Insert or update one place by `key`.',
      args: { projectId: t.arg.id(PROJECT), input: t.arg({ type: PlaceInput, required: true, description: 'The place fields.' }) },
      resolve: async (_r, { projectId, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const { parentKey, ...rest } = input;
        await upsertRow(c, schema.places, [schema.places.key], { ...rest, key: id(input.key), parent: id(parentKey) });
        return fresh(ctx, p, (s) => s.places.find((row) => row.key === id(input.key)), `place ${input.key}`);
      },
    }),
    deletePlace: t.boolean({
      description: 'Delete one place by `key`. Fails while events or child places still reference it.',
      args: { projectId: t.arg.id(PROJECT), key: t.arg.id({ required: true, description: 'The place key.' }) },
      resolve: async (_r, { projectId, key }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.places, [[schema.places.key, String(key)]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertCharacter: t.field({
      type: Character, description: 'Insert or update one character by `key`.',
      args: { projectId: t.arg.id(PROJECT), input: t.arg({ type: CharacterInput, required: true, description: 'The character fields.' }) },
      resolve: async (_r, { projectId, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        await upsertRow(c, schema.characters, [schema.characters.key], { ...input, key: id(input.key), id: id(input.id) });
        return fresh(ctx, p, (s) => s.characters.find((row) => row.key === id(input.key)), `character ${input.key}`);
      },
    }),
    deleteCharacter: t.boolean({
      description: 'Delete one character by `key`. Fails while names, relations, arc stages, participants, or learning intervals still reference it.',
      args: { projectId: t.arg.id(PROJECT), key: t.arg.id({ required: true, description: 'The character key.' }) },
      resolve: async (_r, { projectId, key }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.characters, [[schema.characters.key, String(key)]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertEvent: t.field({
      type: Event, description: 'Insert or update one event by `key`. `actName` is required for a new event.',
      args: { projectId: t.arg.id(PROJECT), input: t.arg({ type: EventInput, required: true, description: 'The event fields.' }) },
      resolve: async (_r, { projectId, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const { actName, placeKey, ...rest } = input;
        await upsertRow(c, schema.events, [schema.events.key], { ...rest, key: id(input.key), id: id(input.id), act: actName, placeKey: id(placeKey) });
        return fresh(ctx, p, (s) => s.events.find((row) => row.key === id(input.key)), `event ${input.key}`);
      },
    }),
    deleteEvent: t.boolean({
      description: 'Delete one event by `key`. Fails while participants, links, citations, relations, arc stages, or learning intervals still reference it.',
      args: { projectId: t.arg.id(PROJECT), key: t.arg.id({ required: true, description: 'The event key.' }) },
      resolve: async (_r, { projectId, key }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.events, [[schema.events.key, String(key)]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertLearning: t.field({
      type: Learning, description: 'Insert or update one learning by `key`.',
      args: { projectId: t.arg.id(PROJECT), input: t.arg({ type: LearningInput, required: true, description: 'The learning fields.' }) },
      resolve: async (_r, { projectId, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        await upsertRow(c, schema.learnings, [schema.learnings.key], { ...input, key: id(input.key) });
        return fresh(ctx, p, (s) => s.learnings.find((row) => row.key === id(input.key)), `learning ${input.key}`);
      },
    }),
    deleteLearning: t.boolean({
      description: 'Delete one learning by `key`. Fails while learning intervals still reference it.',
      args: { projectId: t.arg.id(PROJECT), key: t.arg.id({ required: true, description: 'The learning key.' }) },
      resolve: async (_r, { projectId, key }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.learnings, [[schema.learnings.key, String(key)]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertSource: t.field({
      type: Source, description: 'Insert or update one source by `key`.',
      args: { projectId: t.arg.id(PROJECT), input: t.arg({ type: SourceInput, required: true, description: 'The source fields.' }) },
      resolve: async (_r, { projectId, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        await upsertRow(c, schema.sources, [schema.sources.key], { ...input, key: id(input.key) });
        return fresh(ctx, p, (s) => s.sources.find((row) => row.key === id(input.key)), `source ${input.key}`);
      },
    }),
    deleteSource: t.boolean({
      description: 'Delete one source by `key`. Fails while citations still reference it.',
      args: { projectId: t.arg.id(PROJECT), key: t.arg.id({ required: true, description: 'The source key.' }) },
      resolve: async (_r, { projectId, key }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.sources, [[schema.sources.key, String(key)]]);
        invalidate(ctx, p);
        return removed;
      },
    }),

    renameAct: t.field({
      type: Act, description: `Rename one act: change its primary key \`name\` to \`newName\`. Every event with this \`actName\` follows. Returns the renamed act. ${RENAME}`,
      args: { projectId: t.arg.id(PROJECT), name: t.arg.string({ required: true, description: 'The current act name. Must exist in `Project.acts`.' }), newName: t.arg.string({ required: true, description: 'The new act name. No other act may have it.' }) },
      resolve: async (_r, { projectId, name, newName }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        await renameKey(c, schema.acts, schema.acts.name, name, newName, 'Act');
        return fresh(ctx, p, (s) => s.acts.find((a) => a.name === newName), `act ${newName}`);
      },
    }),
    renamePlace: t.field({
      type: Place, description: `Rename one place: change its primary key \`key\` to \`newKey\`. Events (\`placeKey\`) and child places (\`parentKey\`) follow. Returns the renamed place. ${RENAME}`,
      args: { projectId: t.arg.id(PROJECT), key: t.arg.id({ required: true, description: 'The current place key. Must exist in `Project.places`.' }), newKey: t.arg.id({ required: true, description: 'The new place key. No other place may have it.' }) },
      resolve: async (_r, { projectId, key, newKey }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        await renameKey(c, schema.places, schema.places.key, String(key), String(newKey), 'Place');
        return fresh(ctx, p, (s) => s.places.find((row) => row.key === String(newKey)), `place ${newKey}`);
      },
    }),
    renameCharacter: t.field({
      type: Character, description: `Rename one character: change its primary key \`key\` to \`newKey\`. Names, relations at both ends (\`characterKey\` and \`otherKey\`), arc stages, participants, and learning intervals follow. The \`id\` does not change. Returns the renamed character. ${RENAME}`,
      args: { projectId: t.arg.id(PROJECT), key: t.arg.id({ required: true, description: 'The current character key. Must exist in `Project.characters`.' }), newKey: t.arg.id({ required: true, description: 'The new character key. No other character may have it.' }) },
      resolve: async (_r, { projectId, key, newKey }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        await renameKey(c, schema.characters, schema.characters.key, String(key), String(newKey), 'Character');
        return fresh(ctx, p, (s) => s.characters.find((row) => row.key === String(newKey)), `character ${newKey}`);
      },
    }),
    renameEvent: t.field({
      type: Event, description: `Rename one event: change its primary key \`key\` to \`newKey\`. Participants, links at both ends (\`eventKey\` and \`toKey\`), citations, and every \`sinceKey\` and \`untilKey\` of relations, arc stages, and learning intervals follow. The \`id\` does not change. Returns the renamed event. ${RENAME}`,
      args: { projectId: t.arg.id(PROJECT), key: t.arg.id({ required: true, description: 'The current event key. Must exist in `Project.events`.' }), newKey: t.arg.id({ required: true, description: 'The new event key. No other event may have it.' }) },
      resolve: async (_r, { projectId, key, newKey }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        await renameKey(c, schema.events, schema.events.key, String(key), String(newKey), 'Event');
        return fresh(ctx, p, (s) => s.events.find((row) => row.key === String(newKey)), `event ${newKey}`);
      },
    }),
    renameLearning: t.field({
      type: Learning, description: `Rename one learning: change its primary key \`key\` to \`newKey\`. Its learning intervals follow. Returns the renamed learning. ${RENAME}`,
      args: { projectId: t.arg.id(PROJECT), key: t.arg.id({ required: true, description: 'The current learning key. Must exist in `Project.learnings`.' }), newKey: t.arg.id({ required: true, description: 'The new learning key. No other learning may have it.' }) },
      resolve: async (_r, { projectId, key, newKey }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        await renameKey(c, schema.learnings, schema.learnings.key, String(key), String(newKey), 'Learning');
        return fresh(ctx, p, (s) => s.learnings.find((row) => row.key === String(newKey)), `learning ${newKey}`);
      },
    }),
    renameSource: t.field({
      type: Source, description: `Rename one source: change its primary key \`key\` to \`newKey\`. Every citation (\`EventSource.sourceKey\`) follows. Returns the renamed source. ${RENAME}`,
      args: { projectId: t.arg.id(PROJECT), key: t.arg.id({ required: true, description: 'The current source key. Must exist in `Project.sources`.' }), newKey: t.arg.id({ required: true, description: 'The new source key. No other source may have it.' }) },
      resolve: async (_r, { projectId, key, newKey }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        await renameKey(c, schema.sources, schema.sources.key, String(key), String(newKey), 'Source');
        return fresh(ctx, p, (s) => s.sources.find((row) => row.key === String(newKey)), `source ${newKey}`);
      },
    }),

    upsertCharacterName: t.field({
      type: CharacterName, description: 'Insert or update one alternative name of a character by (`characterKey`, `name`).',
      args: { projectId: t.arg.id(PROJECT), characterKey: t.arg.id({ required: true, description: 'Key of the owning character.' }), input: t.arg({ type: CharacterNameInput, required: true, description: 'The name fields.' }) },
      resolve: async (_r, { projectId, characterKey, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const owner = String(characterKey);
        await upsertRow(c, schema.characterNames, [schema.characterNames.characterKey, schema.characterNames.name], { ...input, characterKey: owner });
        return fresh(ctx, p, (s) => s.namesByCharacter.get(owner)?.find((row) => row.name === input.name), `name ${owner}/${input.name}`);
      },
    }),
    deleteCharacterName: t.boolean({
      description: 'Delete one alternative name by (`characterKey`, `name`).',
      args: { projectId: t.arg.id(PROJECT), characterKey: t.arg.id({ required: true, description: 'Key of the owning character.' }), name: t.arg.string({ required: true, description: 'The alternative name.' }) },
      resolve: async (_r, { projectId, characterKey, name }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.characterNames, [[schema.characterNames.characterKey, String(characterKey)], [schema.characterNames.name, name]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertCharacterRelation: t.field({
      type: CharacterRelation, description: 'Insert or update one relation of a character by (`characterKey`, `position`). Omit `position` to append.',
      args: { projectId: t.arg.id(PROJECT), characterKey: t.arg.id({ required: true, description: 'Key of the owning character, the subject of the relation.' }), input: t.arg({ type: CharacterRelationInput, required: true, description: 'The relation fields.' }) },
      resolve: async (_r, { projectId, characterKey, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const owner = String(characterKey);
        const position = input.position ?? (await nextPosition(c, schema.characterRelations, schema.characterRelations.position, schema.characterRelations.characterKey, owner));
        const { sinceKey, untilKey, otherKey, ...rest } = input;
        await upsertRow(c, schema.characterRelations, [schema.characterRelations.characterKey, schema.characterRelations.position],
          { ...rest, characterKey: owner, position, otherKey: id(otherKey), since: id(sinceKey), until: id(untilKey) });
        return fresh(ctx, p, (s) => s.relationsByCharacter.get(owner)?.find((row) => row.position === position), `relation ${owner}/${position}`);
      },
    }),
    deleteCharacterRelation: t.boolean({
      description: 'Delete one relation by (`characterKey`, `position`).',
      args: { projectId: t.arg.id(PROJECT), characterKey: t.arg.id({ required: true, description: 'Key of the owning character.' }), position: t.arg.int(POSITION) },
      resolve: async (_r, { projectId, characterKey, position }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.characterRelations, [[schema.characterRelations.characterKey, String(characterKey)], [schema.characterRelations.position, position]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertArcStage: t.field({
      type: ArcStage, description: 'Insert or update one arc stage of a character by (`characterKey`, `position`). Omit `position` to append.',
      args: { projectId: t.arg.id(PROJECT), characterKey: t.arg.id({ required: true, description: 'Key of the owning character.' }), input: t.arg({ type: ArcStageInput, required: true, description: 'The arc stage fields.' }) },
      resolve: async (_r, { projectId, characterKey, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const owner = String(characterKey);
        const position = input.position ?? (await nextPosition(c, schema.arcStages, schema.arcStages.position, schema.arcStages.characterKey, owner));
        const { sinceKey, ...rest } = input;
        await upsertRow(c, schema.arcStages, [schema.arcStages.characterKey, schema.arcStages.position], { ...rest, characterKey: owner, position, since: id(sinceKey) });
        return fresh(ctx, p, (s) => s.arcStagesByCharacter.get(owner)?.find((row) => row.position === position), `arc stage ${owner}/${position}`);
      },
    }),
    deleteArcStage: t.boolean({
      description: 'Delete one arc stage by (`characterKey`, `position`).',
      args: { projectId: t.arg.id(PROJECT), characterKey: t.arg.id({ required: true, description: 'Key of the owning character.' }), position: t.arg.int(POSITION) },
      resolve: async (_r, { projectId, characterKey, position }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.arcStages, [[schema.arcStages.characterKey, String(characterKey)], [schema.arcStages.position, position]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertLearningCharacter: t.field({
      type: LearningCharacter, description: 'Insert or update one learning interval by (`learningKey`, `position`). Omit `position` to append.',
      args: { projectId: t.arg.id(PROJECT), learningKey: t.arg.id({ required: true, description: 'Key of the owning learning.' }), input: t.arg({ type: LearningCharacterInput, required: true, description: 'The interval fields.' }) },
      resolve: async (_r, { projectId, learningKey, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const owner = String(learningKey);
        const position = input.position ?? (await nextPosition(c, schema.learningCharacters, schema.learningCharacters.position, schema.learningCharacters.learningKey, owner));
        const { sinceKey, untilKey, characterKey, ...rest } = input;
        await upsertRow(c, schema.learningCharacters, [schema.learningCharacters.learningKey, schema.learningCharacters.position],
          { ...rest, learningKey: owner, position, characterKey: id(characterKey), since: id(sinceKey), until: id(untilKey) });
        return fresh(ctx, p, (s) => s.learningCharactersByLearning.get(owner)?.find((row) => row.position === position), `learning interval ${owner}/${position}`);
      },
    }),
    deleteLearningCharacter: t.boolean({
      description: 'Delete one learning interval by (`learningKey`, `position`).',
      args: { projectId: t.arg.id(PROJECT), learningKey: t.arg.id({ required: true, description: 'Key of the owning learning.' }), position: t.arg.int(POSITION) },
      resolve: async (_r, { projectId, learningKey, position }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.learningCharacters, [[schema.learningCharacters.learningKey, String(learningKey)], [schema.learningCharacters.position, position]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertEventCharacter: t.field({
      type: EventCharacter, description: 'Insert or update one participant of an event by (`eventKey`, `characterKey`).',
      args: { projectId: t.arg.id(PROJECT), eventKey: t.arg.id({ required: true, description: 'Key of the owning event.' }), input: t.arg({ type: EventCharacterInput, required: true, description: 'The participant fields.' }) },
      resolve: async (_r, { projectId, eventKey, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const owner = String(eventKey);
        const character = String(input.characterKey);
        await upsertRow(c, schema.eventCharacters, [schema.eventCharacters.eventKey, schema.eventCharacters.characterKey], { ...input, eventKey: owner, characterKey: character });
        return fresh(ctx, p, (s) => s.participantsByEvent.get(owner)?.find((row) => row.characterKey === character), `participant ${owner}/${character}`);
      },
    }),
    deleteEventCharacter: t.boolean({
      description: 'Delete one participant by (`eventKey`, `characterKey`).',
      args: { projectId: t.arg.id(PROJECT), eventKey: t.arg.id({ required: true, description: 'Key of the owning event.' }), characterKey: t.arg.id({ required: true, description: 'Key of the character.' }) },
      resolve: async (_r, { projectId, eventKey, characterKey }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.eventCharacters, [[schema.eventCharacters.eventKey, String(eventKey)], [schema.eventCharacters.characterKey, String(characterKey)]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertEventLink: t.field({
      type: EventLink, description: 'Insert or update one outgoing link of an event by (`eventKey`, `position`). Omit `position` to append.',
      args: { projectId: t.arg.id(PROJECT), eventKey: t.arg.id({ required: true, description: 'Key of the owning event, the source of the link.' }), input: t.arg({ type: EventLinkInput, required: true, description: 'The link fields.' }) },
      resolve: async (_r, { projectId, eventKey, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const owner = String(eventKey);
        const position = input.position ?? (await nextPosition(c, schema.eventLinks, schema.eventLinks.position, schema.eventLinks.eventKey, owner));
        await upsertRow(c, schema.eventLinks, [schema.eventLinks.eventKey, schema.eventLinks.position], { ...input, eventKey: owner, position, toKey: id(input.toKey) });
        return fresh(ctx, p, (s) => s.linksByEvent.get(owner)?.find((row) => row.position === position), `link ${owner}/${position}`);
      },
    }),
    deleteEventLink: t.boolean({
      description: 'Delete one link by (`eventKey`, `position`).',
      args: { projectId: t.arg.id(PROJECT), eventKey: t.arg.id({ required: true, description: 'Key of the owning event.' }), position: t.arg.int(POSITION) },
      resolve: async (_r, { projectId, eventKey, position }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.eventLinks, [[schema.eventLinks.eventKey, String(eventKey)], [schema.eventLinks.position, position]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
    upsertEventSource: t.field({
      type: EventSource, description: 'Insert or update one citation of an event by (`eventKey`, `sourceKey`).',
      args: { projectId: t.arg.id(PROJECT), eventKey: t.arg.id({ required: true, description: 'Key of the owning event.' }), input: t.arg({ type: EventSourceInput, required: true, description: 'The citation fields.' }) },
      resolve: async (_r, { projectId, eventKey, input }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const owner = String(eventKey);
        const source = String(input.sourceKey);
        await upsertRow(c, schema.eventSources, [schema.eventSources.eventKey, schema.eventSources.sourceKey], { ...input, eventKey: owner, sourceKey: source });
        return fresh(ctx, p, (s) => s.sourcesByEvent.get(owner)?.find((row) => row.sourceKey === source), `citation ${owner}/${source}`);
      },
    }),
    deleteEventSource: t.boolean({
      description: 'Delete one citation by (`eventKey`, `sourceKey`).',
      args: { projectId: t.arg.id(PROJECT), eventKey: t.arg.id({ required: true, description: 'Key of the owning event.' }), sourceKey: t.arg.id({ required: true, description: 'Key of the cited source.' }) },
      resolve: async (_r, { projectId, eventKey, sourceKey }, ctx) => {
        const [c, p] = await open(ctx, projectId);
        const removed = await deleteRows(c, schema.eventSources, [[schema.eventSources.eventKey, String(eventKey)], [schema.eventSources.sourceKey, String(sourceKey)]]);
        invalidate(ctx, p);
        return removed;
      },
    }),
  }),
});
