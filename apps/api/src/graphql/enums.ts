import { builder } from './builder.js';

export const Realm = builder.enumType('Realm', {
  description: 'The kind of world a place belongs to.',
  values: {
    physical: { value: 'physical', description: 'A real place in the story world. The default.' },
    mind: { value: 'mind', description: 'A place inside a mind, such as a memory or a thought.' },
    dream: { value: 'dream', description: 'A place inside a dream.' },
    spirit: { value: 'spirit', description: 'A place in a spirit world or an afterlife.' },
  } as const,
});

export const CharacterKind = builder.enumType('CharacterKind', {
  description: 'Whether a character is one person or a group.',
  values: {
    person: { value: 'person', description: 'One person. The default.' },
    group: { value: 'group', description: 'A group, such as a city, a nation, an army, a tribe, or a side. Persons join a group through a relation with `member: true`.' },
  } as const,
});

export const Confidence = builder.enumType('Confidence', {
  description: 'How sure the author is that an event happened as recorded.',
  values: {
    likely: { value: 'likely', description: 'The sources support the event, but do not prove it.' },
    unsure: { value: 'unsure', description: 'The event is a guess.' },
  } as const,
});

export const Presence = builder.enumType('Presence', {
  description: 'How a character takes part in an event. A spirit is a kind of presence, not an exit.',
  values: {
    body: { value: 'body', description: 'The character is there in person.' },
    mind: { value: 'mind', description: 'The character is there in mind only, such as in a vision or a memory.' },
    spirit: { value: 'spirit', description: 'The character is there as a spirit or a ghost.' },
    mentioned: { value: 'mentioned', description: 'Other characters speak about the character. The character is not there.' },
    related: { value: 'related', description: 'The event affects the character, but the character is not there and is not mentioned.' },
  } as const,
});

export const Exit = builder.enumType('Exit', {
  description: 'How a character leaves the story at an event.',
  values: {
    dies: { value: 'dies', description: 'The character dies at this event. A character has at most one death.' },
    leaves: { value: 'leaves', description: 'The character leaves the story at this event, but stays alive.' },
  } as const,
});

export const LinkKind = builder.enumType('LinkKind', {
  description: 'The explicit kind of an event link (`EventLink.kind`). It says what the owning event does to `toKey`. When a link has no kind, read the free-text `relation` word instead.',
  values: {
    cause: { value: 'cause', description: 'The owning event makes `toKey` happen, or helps it happen. Chains of causes run from the owner to `toKey`.' },
    setup: { value: 'setup', description: 'The owning event plants something that `toKey` pays off later, such as foreshadowing.' },
    reveal: { value: 'reveal', description: 'The owning event brings `toKey` to light, such as a flashback or an explanation of an earlier event. The revealed event is `toKey`.' },
    echo: { value: 'echo', description: 'The two events mirror each other or happen at the same time. Neither drives the other.' },
  } as const,
});

export const RelationTone = builder.enumType('RelationTone', {
  description: 'The explicit tone of a character relation (`CharacterRelation.tone`). The web app groups and filters relations by tone. When a relation has no tone, readers guess it from the free-text `relation` word. Set a tone when the word does not say it clearly, such as a name, a nickname, or a word in another language.',
  values: {
    family: { value: 'family', description: 'Family by blood, marriage, or adoption: parent, child, sibling, spouse, grandparent, foster parent.' },
    love: { value: 'love', description: 'A romantic partner: lover, fiance, fiancee, or a former partner.' },
    friend: { value: 'friend', description: 'A friend, an old friend, a classmate, a companion, or a roommate, on equal terms.' },
    work: { value: 'work', description: 'A tie of rank or service: mentor and student, master and disciple, superior and subordinate, aide, follower, colleague, accomplice.' },
    hostile: { value: 'hostile', description: 'An enemy, a rival, an assassin, a spy who watches the other, or anyone who works against the other.' },
    other: { value: 'other', description: 'None of the named tones. Use it to stop readers from guessing a tone from the `relation` word.' },
  } as const,
});

export const LearningKind = builder.enumType('LearningKind', {
  description: 'The kind of a learning.',
  values: {
    knowledge: { value: 'knowledge', description: 'A fact a character knows. The default.' },
    realization: { value: 'realization', description: 'An insight a character reaches.' },
    idea: { value: 'idea', description: 'A plan or an intention a character forms.' },
  } as const,
});
