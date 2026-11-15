import { builder } from '../builder.js';
import { LearningKind } from '../enums.js';
import type { ArcStageRow, LearningCharacterRow, LearningRow, Scoped } from '../../projects/snapshot.js';

export const LearningCharacter = builder.objectRef<LearningCharacterRow>('LearningCharacter').implement({
  description: 'Inner module. One interval during which a character knows a learning. A character that forgets and learns again has several rows. Primary key: (`learningKey`, `position`).',
  fields: (t) => ({
    learningKey: t.exposeID('learningKey', { description: 'Key of the learning. Resolve against `Project.learnings[].key`.' }),
    position: t.exposeInt('position', { description: 'Order of this row inside the learning.' }),
    characterKey: t.exposeID('characterKey', { description: 'Key of the character who knows the learning. Resolve against `Project.characters[].key`.' }),
    sinceKey: t.id({ nullable: true, description: 'Key of the event at which the character learns it. Null means the character knows it from the story start. Resolve against `Project.events[].key`.', resolve: (row) => row.since }),
    untilKey: t.id({ nullable: true, description: 'Key of the event at which the character forgets or loses it. Null means no end is recorded. Resolve against `Project.events[].key`.', resolve: (row) => row.until }),
    time: t.exposeString('time', { nullable: true, description: 'A free-text story time for the interval, used when no event fits.' }),
    note: t.exposeString('note', { nullable: true, description: 'How the character learns it, or other remarks.' }),
  }),
});

export const Learning = builder.objectRef<Scoped<LearningRow>>('Learning').implement({
  description: 'Inner module. A piece of knowledge, a realization, or an idea, stored apart from the characters who know it. Primary key: `key`. `characters` lists who knows it and when.',
  fields: (t) => ({
    key: t.exposeID('key', { description: 'The readable key. `LearningCharacter.learningKey` references this value.' }),
    position: t.exposeInt('position', { nullable: true, description: 'Display order. Unique when set.' }),
    text: t.exposeString('text', { nullable: true, description: 'The learning in one sentence, such as "the king is already dead".' }),
    kind: t.field({ type: LearningKind, description: 'Knowledge, realization, or idea. Default: `knowledge`.', resolve: (row) => row.kind }),
    description: t.exposeString('description', { nullable: true, description: 'More detail about the learning.' }),
    characters: t.field({
      type: [LearningCharacter],
      description: 'Who knows this learning and during which event interval, in position order. Empty when nobody knows it.',
      resolve: (row) => row.snapshot.learningCharactersByLearning.get(row.key) ?? [],
    }),
  }),
});

export const ArcStage = builder.objectRef<ArcStageRow>('ArcStage').implement({
  description: 'Inner module. One stage of a character arc, in order. Primary key: (`characterKey`, `position`).',
  fields: (t) => ({
    position: t.exposeInt('position', { description: 'Order of the stage inside the character arc. Lower comes first.' }),
    stage: t.exposeString('stage', { nullable: true, description: 'A short name for the stage, such as "denial" or "return".' }),
    time: t.exposeString('time', { nullable: true, description: 'A free-text story time at which the stage starts.' }),
    sinceKey: t.id({ nullable: true, description: 'Key of the event at which the stage starts. Resolve against `Project.events[].key`.', resolve: (row) => row.since }),
    description: t.exposeString('description', { nullable: true, description: 'What changes in the character at this stage.' }),
  }),
});
