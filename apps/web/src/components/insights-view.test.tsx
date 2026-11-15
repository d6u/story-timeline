import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { assemble } from '../data/assemble.ts'
import { buildProblems } from '../insights/build.ts'
import { fixture } from '../test/fixture.ts'
import { InsightsView } from './InsightsView.tsx'

it('shows data problems under their own heading, with the rows they name, apart from the gaps', () => {
  // `a` dies twice: at `end`, and again at `start`.
  const data = assemble({ ...fixture, events: fixture.events.map(e => (e.key === 'start' ? { ...e, participants: [{ ...e.participants[0], exit: 'dies' }] } : e)) })
  const insights = buildProblems(data)
  const html = renderToStaticMarkup(
    <InsightsView data={data} insights={insights} laneIndex={new Map()} filter={{ category: 'gap' }} onFilter={() => {}} select={() => {}} onView={() => {}} onCursor={() => {}} />,
  )
  expect(html).toContain('数据文件问题')
  expect(html).toContain('不随故事进度变化')
  expect(html).toContain('多次死亡')
  expect(html).toContain('title="Start"')
  expect(html).toContain('title="end"')
  // The character is part of a problem item, so it shows next to the events.
  expect(html).toContain('>A<')
})
