import { builder } from '../builder.js';
import { CharacterKind, RelationTone } from '../enums.js';
import { ArcStage, LearningCharacter } from './inner.js';
import type { CharacterNameRow, CharacterRelationRow, CharacterRow, Scoped } from '../../projects/snapshot.js';

export const CharacterName = builder.objectRef<CharacterNameRow>('CharacterName').implement({
  description: 'People module. An alias, a translated name, or a later name of a character. The main display name stays in `Character.name`. Primary key: (`characterKey`, `name`).',
  fields: (t) => ({
    name: t.exposeString('name', { description: 'The alternative name.' }),
    position: t.exposeInt('position', { nullable: true, description: 'Display order among the names of the character.' }),
    lang: t.exposeString('lang', { nullable: true, description: 'Language code of the name, such as `en` or `ja`.' }),
    note: t.exposeString('note', { nullable: true, description: 'Who uses the name, or when.' }),
  }),
});

export const CharacterRelation = builder.objectRef<CharacterRelationRow>('CharacterRelation').implement({
  description: 'Core module. A relation from the owning character to `otherKey`. The owner is the subject: with `relation: "father"` the owner is the father of the other character. Primary key: (`characterKey`, `position`). The same pair can have several rows for different labels or time intervals. A character never has a relation to itself.',
  fields: (t) => ({
    position: t.exposeInt('position', { description: 'Order of the relation inside the owning character.' }),
    otherKey: t.exposeID('otherKey', { description: 'Key of the other character. Resolve against `Project.characters[].key`.' }),
    relation: t.exposeString('relation', { nullable: true, description: 'The relation label, free text, such as `father`, `friend`, `enemy`, `member`.' }),
    mutual: t.exposeBoolean('mutual', { description: 'True when one row covers both directions, such as `sibling` or `friend`. False when the relation reads one way only.' }),
    member: t.exposeBoolean('member', { description: 'True when the owner belongs to the group `otherKey`. The other character must have `kind: group`. A member relation is never mutual.' }),
    sinceKey: t.id({ nullable: true, description: 'Key of the event at which the relation starts. Null means from the story start. Resolve against `Project.events[].key`.', resolve: (row) => row.since }),
    untilKey: t.id({ nullable: true, description: 'Key of the event at which the relation ends. Null means no end is recorded. Resolve against `Project.events[].key`.', resolve: (row) => row.until }),
    tone: t.field({ type: RelationTone, nullable: true, description: 'The explicit tone of the relation: family, love, friend, work, hostile, or other. When it is set, it wins over the `relation` word. Null means no tone is stored: classify the `relation` word instead. The web app ignores the tone of a `member` relation, because it draws membership as a faction, not as a relation line.', resolve: (row) => row.tone }),
  }),
});

export const Character = builder.objectRef<Scoped<CharacterRow>>('Character').implement({
  description: 'Core module. A person or a group in the story. Primary key: `key`. Every reference to a character in this API uses `key`, not `id`.',
  fields: (t) => ({
    key: t.exposeID('key', { description: 'The readable key, such as `arthur`. Every `characterKey` and `otherKey` field references this value.' }),
    id: t.exposeID('id', { nullable: true, description: 'A stable UUID supplied by the author. May be null. Not used by reference fields.' }),
    name: t.exposeString('name', { nullable: true, description: 'The main display name. Other names are in `names`.' }),
    description: t.exposeString('description', { nullable: true, description: 'Who the character is.' }),
    category: t.exposeString('category', { nullable: true, description: 'A free-text grouping chosen by the author, such as `main`, `minor`, `historical`. A `main` character gets its own lane in the web timeline.' }),
    kind: t.field({ type: CharacterKind, description: 'Person or group. Default: `person`.', resolve: (row) => row.kind }),
    position: t.exposeInt('position', { nullable: true, description: 'Display order. Unique when set. The web uses it to order the timeline lanes of `main` characters.' }),
    color: t.exposeString('color', { nullable: true, description: 'Lane color in the web app. Any CSS color as an exact value, such as `oklch(0.52 0.13 250)`; `light-dark(<light>, <dark>)` gives one value per theme. Null means the web picks the next free palette slot in lane order.' }),
    names: t.field({
      type: [CharacterName],
      description: 'Other names of the character, in position order.',
      resolve: (row) => row.snapshot.namesByCharacter.get(row.key) ?? [],
    }),
    relations: t.field({
      type: [CharacterRelation],
      description: 'Outgoing relations only, in position order. To see relations that point at this character, scan `relations` of the other characters for `otherKey` equal to this `key`. A `mutual` row counts in both directions.',
      resolve: (row) => row.snapshot.relationsByCharacter.get(row.key) ?? [],
    }),
    arcStages: t.field({
      type: [ArcStage],
      description: 'The stages of the character arc, in position order.',
      resolve: (row) => row.snapshot.arcStagesByCharacter.get(row.key) ?? [],
    }),
    learnings: t.field({
      type: [LearningCharacter],
      description: 'Every interval during which this character knows a learning. Resolve `learningKey` against `Project.learnings[].key`.',
      resolve: (row) => row.snapshot.learningCharactersByCharacter.get(row.key) ?? [],
    }),
  }),
});
