import type { ProjectResult } from '../graphql/queries.ts'

/** The same story as the API test seed (apps/api/tests/helpers/seed.ts), as a ProjectQuery result. */
export const fixture: ProjectResult = {
  id: 'demo',
  name: 'demo',
  acts: [{ name: 'act-1', position: null, span: null, description: null }],
  places: [
    { key: 'ship', position: 1, name: 'Ship', realm: 'physical', parentKey: null, description: null },
    { key: 'cabin', position: 2, name: 'Cabin', realm: 'physical', parentKey: 'ship', description: null },
  ],
  characters: [
    {
      key: 'a', id: 'uuid-a', name: 'A', description: 'The hero', category: 'main', kind: 'person', position: 1, color: 'oklch(0.58 0.16 40)',
      names: [{ name: 'Alpha', position: 1, lang: 'en', note: null }],
      relations: [
        { position: 1, otherKey: 'b', relation: 'friend', mutual: true, member: false, sinceKey: 'start', untilKey: null, tone: 'friend' },
        { position: 2, otherKey: 'group', relation: 'member', mutual: false, member: true, sinceKey: null, untilKey: null, tone: null },
      ],
      arcStages: [{ position: 1, stage: 'call', time: null, sinceKey: 'start', description: null }],
    },
    { key: 'b', id: null, name: 'B', description: null, category: null, kind: 'person', position: null, color: null, names: [], relations: [], arcStages: [] },
    { key: 'group', id: null, name: null, description: null, category: null, kind: 'group', position: null, color: null, names: [], relations: [], arcStages: [] },
  ],
  events: [
    {
      key: 'flood', id: null, title: 'Flood', description: 'The sea rises', isCore: false, sortOrder: 0, actName: 'act-1', time: 'long ago', placeKey: null, confidence: null,
      participants: [],
      links: [{ position: 1, toKey: 'start', relation: 'causes', mutual: false, note: null, kind: null }],
      sources: [],
    },
    {
      key: 'start', id: null, title: 'Start', description: null, isCore: true, sortOrder: 1, actName: 'act-1', time: 'day 1', placeKey: 'cabin', confidence: 'likely',
      participants: [{ characterKey: 'a', position: 1, presence: 'body', exit: null }],
      links: [{ position: 1, toKey: 'end', relation: 'causes', mutual: false, note: null, kind: 'cause' }],
      sources: [{ sourceKey: 'book', ref: '1:3-24', position: 1 }],
    },
    {
      key: 'end', id: null, title: null, description: null, isCore: false, sortOrder: 2, actName: 'act-1', time: null, placeKey: null, confidence: null,
      participants: [{ characterKey: 'a', position: 1, presence: 'body', exit: 'dies' }],
      links: [],
      sources: [],
    },
  ],
  learnings: [
    {
      key: 'idea', position: null, text: 'The door is beyond the sea', kind: 'idea', description: null,
      characters: [{ learningKey: 'idea', position: 1, characterKey: 'a', sinceKey: 'start', untilKey: 'end', time: null, note: null }],
    },
  ],
  sources: [{ key: 'book', position: null, title: 'The Book', lang: null, location: 'https://example.com', note: null }],
}
