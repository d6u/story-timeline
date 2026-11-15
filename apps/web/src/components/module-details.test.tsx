import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { assemble } from '../data/assemble.ts'
import { fixture } from '../test/fixture.ts'
import { buildTimeline } from '../timeline/build.ts'
import { ConfidenceBadge, EventLearnings, EventLinks, KnowledgeList, NameList, Participants, PlaceDetails, Relations, SourceList, WordBadge } from './ModuleDetails.tsx'

const timeline = buildTimeline(assemble(fixture))
const onSelect = () => {}, lanes = new Map<string, string>()
const a = timeline.characters.find(c => c.key === 'a')!

it('shows a place name and realm', () => {
  const html = renderToStaticMarkup(<PlaceDetails place={{ key: 'shore', name: '梦里的海边', realm: 'dream' }} />)
  expect(html).toContain('梦里的海边'); expect(html).toContain('梦境')
})
it('shows relations with direction and event links', () => {
  const html = renderToStaticMarkup(<Relations character={a} rows={a.metadata.relations!} timeline={timeline} lanes={lanes} onSelect={onSelect} />)
  expect(html).toContain('双向'); expect(html).toContain('friend'); expect(html).toContain('开始于'); expect(html).toContain('Start')
})
it('shows a member relation as a side', () => {
  const sides = a.metadata.relations!.filter(r => r.member && !r.incoming)
  const html = renderToStaticMarkup(<Relations label="所属阵营" character={a} rows={sides} timeline={timeline} lanes={lanes} onSelect={onSelect} />)
  expect(html).toContain('所属阵营'); expect(html).toContain('group')
})
it('shows event links in both directions', () => {
  const html = renderToStaticMarkup(<EventLinks links={[{ event: 'end', relation: '导致', incoming: true, mutual: false }, { event: 'start', relation: '同时', incoming: false, mutual: true }]} timeline={timeline} onSelect={onSelect} />)
  expect(html).toContain('←'); expect(html).toContain('↔'); expect(html).toContain('data-tone="cause"'); expect(html).toContain('Start')
})
it('shows presence and exits without a default claim of participation', () => {
  const html = renderToStaticMarkup(<Participants people={[{ character_id: a.key, presence: 'mentioned', exit: 'leaves' }]} timeline={timeline} lanes={lanes} onSelect={onSelect} />)
  expect(html).toContain('被提及'); expect(html).toContain('离场')
  expect(renderToStaticMarkup(<Participants people={[{ character_id: a.key }]} timeline={timeline} lanes={lanes} onSelect={onSelect} />)).not.toContain('身体在场')
})
it('shows learning and forgetting for an event and a character', () => {
  const event = renderToStaticMarkup(<EventLearnings items={[{ key: 'k', who: [a.key], text: '门在海那边', forgotten: true }]} timeline={timeline} lanes={lanes} onSelect={onSelect} />)
  expect(event).toContain('遗忘'); expect(event).toContain('门在海那边'); expect(event).toContain(`>${a.name}<`)
  const character = renderToStaticMarkup(<KnowledgeList items={[{ key: 'k', text: '门在海那边', kind: 'idea', since: 'start', until: 'end' }]} timeline={timeline} onSelect={onSelect} />)
  expect(character).toContain('想法'); expect(character).toContain('得知于'); expect(character).toContain('遗忘于'); expect(character).toContain('Start')
})
it('shows source references and confidence badges', () => {
  const html = renderToStaticMarkup(<SourceList sources={[{ key: 'book', title: '原作', ref: '1:3–24', location: 'https://example.com', note: '作品本身' }]} />)
  expect(html).toContain('1:3–24'); expect(html).toContain('https://example.com'); expect(html).toContain('作品本身')
  expect(renderToStaticMarkup(<ConfidenceBadge value="likely" />)).toContain('较可信')
  expect(renderToStaticMarkup(<ConfidenceBadge value="unsure" />)).toContain('待核实')
})
it('uses a neutral color for other relation words', () => expect(renderToStaticMarkup(<WordBadge word="陌生人" />)).toContain('data-tone="neutral"'))
it('colors a relation word by its stored tone first', () => {
  expect(renderToStaticMarkup(<WordBadge word="陌生人" tone="hostile" />)).toContain('data-tone="hostile"')
  expect(renderToStaticMarkup(<WordBadge word="父亲" tone="other" />)).toContain('data-tone="neutral"')
})
it('colors a link word by the causality kind', () => {
  // 伏笔 is foreshadowing, so a setup, as the causality view draws it; a mutual link is an echo whatever its word.
  expect(renderToStaticMarkup(<WordBadge word="伏笔" link />)).toContain('data-tone="setup"')
  expect(renderToStaticMarkup(<WordBadge word="导致" link mutual />)).toContain('data-tone="echo"')
  expect(renderToStaticMarkup(<WordBadge word="后续" link />)).toContain('data-tone="other"')
})
it('shows the parent place by name, or by key when the project lacks it', () => {
  expect(renderToStaticMarkup(<PlaceDetails place={{ key: 'cabin', name: 'Cabin', realm: 'physical', parent: 'ship', parentName: 'Ship' }} />)).toContain('位于 <span class="text-foreground">Ship</span>')
  expect(renderToStaticMarkup(<PlaceDetails place={{ key: 'cabin', name: 'Cabin', realm: 'physical', parent: 'ship' }} />)).toContain('>ship<')
  expect(renderToStaticMarkup(<PlaceDetails place={{ key: 'ship', name: 'Ship', realm: 'physical' }} />)).not.toContain('位于')
})
it('shows a learning description under its text', () => {
  expect(renderToStaticMarkup(<EventLearnings items={[{ key: 'k', who: [a.key], text: '门在海那边', description: '守塔人说的' }]} timeline={timeline} lanes={lanes} onSelect={onSelect} />)).toContain('守塔人说的')
  expect(renderToStaticMarkup(<KnowledgeList items={[{ key: 'k', text: '门在海那边', kind: 'idea', description: '守塔人说的' }]} timeline={timeline} onSelect={onSelect} />)).toContain('守塔人说的')
})
it('shows the language and note of other names, and a plain list without them', () => {
  const html = renderToStaticMarkup(<NameList names={[{ name: 'Alpha', lang: 'en' }, { name: '阿尔', note: '童年时' }]} />)
  expect(html).toContain('Alpha'); expect(html).toContain('>en<'); expect(html).toContain('童年时')
  expect(renderToStaticMarkup(<NameList names={[{ name: 'Alpha' }, { name: 'Al' }]} />)).toBe('Alpha、Al')
})

