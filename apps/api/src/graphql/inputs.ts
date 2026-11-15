import { builder } from './builder.js';
import { CharacterKind, Confidence, Exit, LearningKind, LinkKind, Presence, Realm, RelationTone } from './enums.js';

const PATCH = 'Omit a field to keep its stored value (or take the column default on insert). Set a field to null to clear it.';

export const ActInput = builder.inputType('ActInput', {
  description: `Fields of an act for \`upsertAct\`. \`name\` is the primary key. ${PATCH}`,
  fields: (t) => ({
    name: t.string({ required: true, description: 'The act name. Primary key. Events reference it through `actName`.' }),
    position: t.int({ description: 'Order of the act in the plot. Unique when set.' }),
    span: t.string({ description: 'A text label for the story time the act covers.' }),
    description: t.string({ description: 'What happens in the act.' }),
  }),
});

export const PlaceInput = builder.inputType('PlaceInput', {
  description: `Fields of a place for \`upsertPlace\`. \`key\` is the primary key. ${PATCH}`,
  fields: (t) => ({
    key: t.id({ required: true, description: 'The readable key. Primary key.' }),
    position: t.int({ description: 'Display order. Unique when set.' }),
    name: t.string({ description: 'The display name.' }),
    realm: t.field({ type: Realm, description: 'The kind of world the place belongs to. Default: `physical`.' }),
    parentKey: t.id({ description: 'Key of the place that contains this place. Must exist in `Project.places` and differ from `key`.' }),
    description: t.string({ description: 'What the place is like.' }),
  }),
});

export const CharacterInput = builder.inputType('CharacterInput', {
  description: `Fields of a character for \`upsertCharacter\`. \`key\` is the primary key. ${PATCH}`,
  fields: (t) => ({
    key: t.id({ required: true, description: 'The readable key. Primary key.' }),
    id: t.id({ description: 'A stable UUID supplied by the author. Unique when set.' }),
    name: t.string({ description: 'The main display name.' }),
    description: t.string({ description: 'Who the character is.' }),
    category: t.string({ description: 'A free-text grouping, such as `main` or `minor`.' }),
    kind: t.field({ type: CharacterKind, description: 'Person or group. Default: `person`.' }),
    position: t.int({ description: 'Display order. Unique when set.' }),
    color: t.string({ description: 'Lane color, any CSS color as an exact value, or `light-dark(<light>, <dark>)`. Null clears it.' }),
  }),
});

export const EventInput = builder.inputType('EventInput', {
  description: `Fields of an event for \`upsertEvent\`. \`key\` is the primary key. \`actName\` is required on insert. ${PATCH}`,
  fields: (t) => ({
    key: t.id({ required: true, description: 'The readable key. Primary key.' }),
    id: t.id({ description: 'A stable UUID supplied by the author. Unique when set.' }),
    title: t.string({ description: 'A short title for the event.' }),
    description: t.string({ description: 'What happens in the event.' }),
    isCore: t.boolean({ description: 'True for an event the main plot cannot do without. Default: false.' }),
    sortOrder: t.int({ description: 'Story order. Lower happens first. Pick a value between the neighbours.' }),
    actName: t.string({ description: 'Name of the act. Must exist in `Project.acts`. Required when the event is new.' }),
    time: t.string({ description: 'A free-text story time.' }),
    placeKey: t.id({ description: 'Key of the place. Must exist in `Project.places`.' }),
    confidence: t.field({ type: Confidence, description: 'How sure the author is. Null means certain.' }),
  }),
});

export const LearningInput = builder.inputType('LearningInput', {
  description: `Fields of a learning for \`upsertLearning\`. \`key\` is the primary key. ${PATCH}`,
  fields: (t) => ({
    key: t.id({ required: true, description: 'The readable key. Primary key.' }),
    position: t.int({ description: 'Display order. Unique when set.' }),
    text: t.string({ description: 'The learning in one sentence.' }),
    kind: t.field({ type: LearningKind, description: 'Knowledge, realization, or idea. Default: `knowledge`.' }),
    description: t.string({ description: 'More detail about the learning.' }),
  }),
});

export const SourceInput = builder.inputType('SourceInput', {
  description: `Fields of a source for \`upsertSource\`. \`key\` is the primary key. ${PATCH}`,
  fields: (t) => ({
    key: t.id({ required: true, description: 'The readable key. Primary key.' }),
    position: t.int({ description: 'Priority. Lower is more trusted. Unique when set.' }),
    title: t.string({ description: 'The title of the work.' }),
    lang: t.string({ description: 'Language code of the work.' }),
    location: t.string({ description: 'Where to find the work: a URL or a file path.' }),
    note: t.string({ description: 'A free-text note about the source.' }),
  }),
});

export const CharacterNameInput = builder.inputType('CharacterNameInput', {
  description: `Fields of an alternative name for \`upsertCharacterName\`. (\`characterKey\`, \`name\`) is the primary key. ${PATCH}`,
  fields: (t) => ({
    name: t.string({ required: true, description: 'The alternative name. Part of the primary key.' }),
    position: t.int({ description: 'Display order among the names of the character.' }),
    lang: t.string({ description: 'Language code of the name.' }),
    note: t.string({ description: 'Who uses the name, or when.' }),
  }),
});

export const CharacterRelationInput = builder.inputType('CharacterRelationInput', {
  description: `Fields of a relation for \`upsertCharacterRelation\`. (\`characterKey\`, \`position\`) is the primary key. Omit \`position\` to append a new row. ${PATCH}`,
  fields: (t) => ({
    position: t.int({ description: 'Order inside the owning character. Omit to append at the end; give it to replace that row.' }),
    otherKey: t.id({ description: 'Key of the other character. Must exist in `Project.characters` and differ from `characterKey`. Required when the row is new.' }),
    relation: t.string({ description: 'The relation label, free text.' }),
    mutual: t.boolean({ description: 'True when one row covers both directions. Default: false.' }),
    member: t.boolean({ description: 'True when the owner belongs to the group `otherKey`. Never together with `mutual`. Default: false.' }),
    sinceKey: t.id({ description: 'Key of the event at which the relation starts. Must exist in `Project.events`.' }),
    untilKey: t.id({ description: 'Key of the event at which the relation ends. Must exist in `Project.events`.' }),
    tone: t.field({ type: RelationTone, description: 'The explicit tone of the relation. Omit to keep the stored tone. Null clears it, and readers then classify the `relation` word.' }),
  }),
});

export const ArcStageInput = builder.inputType('ArcStageInput', {
  description: `Fields of an arc stage for \`upsertArcStage\`. (\`characterKey\`, \`position\`) is the primary key. Omit \`position\` to append a new row. ${PATCH}`,
  fields: (t) => ({
    position: t.int({ description: 'Order inside the character arc. Omit to append at the end; give it to replace that row.' }),
    stage: t.string({ description: 'A short name for the stage.' }),
    time: t.string({ description: 'A free-text story time at which the stage starts.' }),
    sinceKey: t.id({ description: 'Key of the event at which the stage starts. Must exist in `Project.events`.' }),
    description: t.string({ description: 'What changes in the character at this stage.' }),
  }),
});

export const LearningCharacterInput = builder.inputType('LearningCharacterInput', {
  description: `Fields of a learning interval for \`upsertLearningCharacter\`. (\`learningKey\`, \`position\`) is the primary key. Omit \`position\` to append a new row. ${PATCH}`,
  fields: (t) => ({
    position: t.int({ description: 'Order inside the learning. Omit to append at the end; give it to replace that row.' }),
    characterKey: t.id({ description: 'Key of the character who knows the learning. Must exist in `Project.characters`. Required when the row is new.' }),
    sinceKey: t.id({ description: 'Key of the event at which the character learns it. Null means from the story start.' }),
    untilKey: t.id({ description: 'Key of the event at which the character loses it. Null means no end.' }),
    time: t.string({ description: 'A free-text story time, used when no event fits.' }),
    note: t.string({ description: 'How the character learns it, or other remarks.' }),
  }),
});

export const EventCharacterInput = builder.inputType('EventCharacterInput', {
  description: `Fields of a participant for \`upsertEventCharacter\`. (\`eventKey\`, \`characterKey\`) is the primary key. ${PATCH}`,
  fields: (t) => ({
    characterKey: t.id({ required: true, description: 'Key of the character. Part of the primary key. Must exist in `Project.characters`.' }),
    position: t.int({ description: 'Order of the character inside the event.' }),
    presence: t.field({ type: Presence, description: 'How the character takes part.' }),
    exit: t.field({ type: Exit, description: 'Set when the character dies or leaves the story at this event.' }),
  }),
});

export const EventLinkInput = builder.inputType('EventLinkInput', {
  description: `Fields of a link for \`upsertEventLink\`. (\`eventKey\`, \`position\`) is the primary key. Omit \`position\` to append a new row. ${PATCH}`,
  fields: (t) => ({
    position: t.int({ description: 'Order inside the owning event. Omit to append at the end; give it to replace that row.' }),
    toKey: t.id({ description: 'Key of the target event. Must exist in `Project.events` and differ from `eventKey`. Required when the row is new.' }),
    relation: t.string({ description: 'The link label, free text. The owning event can have only one link to the same `toKey` with the same label.' }),
    mutual: t.boolean({ description: 'True when the link reads the same in both directions. Default: false.' }),
    note: t.string({ description: 'Why the events are linked.' }),
    kind: t.field({ type: LinkKind, description: 'The explicit kind of the link. Omit to keep the stored kind. Null clears it, and readers then classify the `relation` word.' }),
  }),
});

export const EventSourceInput = builder.inputType('EventSourceInput', {
  description: `Fields of a citation for \`upsertEventSource\`. (\`eventKey\`, \`sourceKey\`) is the primary key. ${PATCH}`,
  fields: (t) => ({
    sourceKey: t.id({ required: true, description: 'Key of the cited source. Part of the primary key. Must exist in `Project.sources`.' }),
    ref: t.string({ description: 'The location inside the source.' }),
    position: t.int({ description: 'Order of the citation inside the event. Lower comes first. Not unique. Null clears it.' }),
  }),
});
