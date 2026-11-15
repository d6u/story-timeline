import { describe, expect, it } from 'vitest'
import { assemble } from '../data/assemble.ts'
import { fixture } from '../test/fixture.ts'
import { DICT } from '../i18n.tsx'
import { applyFilter, buildTimeline, emptyFilter, sectionsFor } from './build.ts'

const data = assemble(fixture)
const timeline = buildTimeline(data)

describe('timeline', () => {
  it('orders events by sort order and resolves participants', () => {
    expect(timeline.entries.map(e => e.event.key)).toEqual(['flood', 'start', 'end'])
    for (const entry of timeline.entries) expect(entry.characters).toHaveLength(entry.event.character_ids.length)
  })
  it('uses main characters as lanes, in position order', () => {
    expect(timeline.lanes.map(c => c.key)).toEqual(['a'])
    const noMain = buildTimeline({ ...data, characters: data.characters.map(c => ({ ...c, metadata: { ...c.metadata, category: undefined } })) })
    expect(noMain.lanes.map(c => c.key)).toEqual(['a'])
  })
  it('counts events per act', () => {
    expect(timeline.acts).toEqual([{ name: 'act-1', count: 3 }])
  })
  it('groups by act in act mode and by time label in time mode', () => {
    const act = sectionsFor(timeline.entries, 'act', timeline, DICT.zh)
    expect(act.map(s => s.label)).toEqual(['act-1'])
    expect(act[0].groups.map(g => g.label)).toEqual(['long ago', 'day 1', '未标时间'])
    const time = sectionsFor(timeline.entries, 'time', timeline, DICT.zh)
    expect(time.map(s => s.label)).toEqual(['故事'])
  })
  it('labels sections and groups in the language it is given', () => {
    expect(sectionsFor(timeline.entries, 'act', timeline, DICT.en)[0].groups.at(-1)!.label).toBe('Untimed')
    expect(sectionsFor(timeline.entries, 'time', timeline, DICT.en).map(s => s.label)).toEqual(['Story'])
    const noAct = timeline.entries.map(e => ({ ...e, act: null }))
    expect(sectionsFor(noAct, 'act', { acts: [] }, DICT.en).map(s => s.label)).toEqual(['No act'])
  })
  it('keeps the act order when a filter hides events', () => {
    const filtered = applyFilter(timeline.entries, { ...emptyFilter, coreOnly: true })
    expect(filtered.map(e => e.event.key)).toEqual(['start'])
    expect(sectionsFor(filtered, 'act', timeline, DICT.zh).map(s => s.label)).toEqual(['act-1'])
  })
  it('filters by character, core flag, and text', () => {
    expect(applyFilter(timeline.entries, { ...emptyFilter, who: ['a'] })).toHaveLength(3)
    expect(applyFilter(timeline.entries, { ...emptyFilter, who: ['b'] }).map(e => e.event.key)).toEqual(['flood'])
    expect(applyFilter(timeline.entries, { ...emptyFilter, query: 'cabin' }).map(e => e.event.key)).toEqual(['start'])
    expect(applyFilter(timeline.entries, { ...emptyFilter, query: 'beyond the sea' })).toHaveLength(2)
  })
  it('finds an event by a key prefix after #', () => {
    expect(applyFilter(timeline.entries, { ...emptyFilter, query: '#en' }).map(e => e.event.key)).toEqual(['end'])
    expect(applyFilter(timeline.entries, { ...emptyFilter, query: '#START' }).map(e => e.event.key)).toEqual(['start'])
    // The key is matched from its start, and only the key: `#and` is no key prefix, and `#cabin` is a place, not a key.
    expect(applyFilter(timeline.entries, { ...emptyFilter, query: '#and' })).toHaveLength(0)
    expect(applyFilter(timeline.entries, { ...emptyFilter, query: '#cabin' })).toHaveLength(0)
    // The URL's id finds the event too.
    const withId = buildTimeline({ ...data, events: data.events.map(e => (e.key === 'start' ? { ...e, id: 'e-start' } : e)) })
    expect(applyFilter(withId.entries, { ...emptyFilter, query: '#e-st' }).map(e => e.event.key)).toEqual(['start'])
    expect(applyFilter(timeline.entries, { ...emptyFilter, query: '#' })).toHaveLength(3)
  })
  it('marks an event without participants as a world event', () => {
    expect(timeline.entries.map(e => e.world)).toEqual([true, false, false])
    expect(timeline.world).toBe(1)
    // A world event is context for every character: it passes the character filter and only hideWorld removes it.
    expect(applyFilter(timeline.entries, { ...emptyFilter, who: ['b'], hideWorld: true })).toHaveLength(0)
    expect(applyFilter(timeline.entries, { ...emptyFilter, hideWorld: true }).map(e => e.event.key)).toEqual(['start', 'end'])
  })
  it('resolves links by event key', () => {
    expect(timeline.resolve({ text: '', event: 'end' })?.event.key).toBe('end')
    expect(timeline.resolve({ text: '', event: 'nope' })).toBeUndefined()
  })
  it('orders acts by the act list, not by their first event, and keeps span and description', () => {
    const acts = [
      { name: 'later', position: 1, span: 'days 3-4', description: 'Second half' },
      { name: 'act-1', position: 2, span: null, description: null },
      { name: 'empty', position: 3, span: null, description: 'No event yet' },
    ]
    const d = assemble({ ...fixture, acts, events: fixture.events.map(e => (e.key === 'end' ? { ...e, actName: 'later' } : e)) })
    const tl = buildTimeline(d)
    expect(tl.acts).toEqual([
      { name: 'later', count: 1, span: 'days 3-4', description: 'Second half' },
      { name: 'act-1', count: 2 },
      { name: 'empty', count: 0, description: 'No event yet' },
    ])
    // The act of the last event comes first, as the act list says; an act with no event gets no section.
    const sections = sectionsFor(tl.entries, 'act', tl, DICT.zh)
    expect(sections.map(s => s.label)).toEqual(['later', 'act-1'])
    expect(sections[0]).toMatchObject({ span: 'days 3-4', description: 'Second half' })
    expect(sections[1].span).toBeUndefined()
  })
  it('gives act sections keys that no act name can share with the fixed sections', () => {
    const named = timeline.entries.map((e, i) => ({ ...e, act: i === 0 ? 'story' : i === 1 ? 'no-act' : null }))
    const keys = sectionsFor(named, 'act', { acts: [] }, DICT.zh).map(s => s.key)
    expect(new Set(keys).size).toBe(3)
    expect(keys).toEqual(['act:story', 'act:no-act', 'no-act'])
    expect(sectionsFor(timeline.entries, 'time', timeline, DICT.zh)[0].key).toBe('story')
  })
})

