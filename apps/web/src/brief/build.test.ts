import { describe, expect, it } from 'vitest'
import { makeCursor, storyAsOf, storyOrder } from '../cursor/state'
import { assemble } from '../data/assemble'
import type { ProjectResult } from '../graphql/queries'
import { DICT } from '../i18n'
import { buildInsights } from '../insights/build'
import { fixture } from '../test/fixture'
import { briefFileName, characterBrief, eventBrief, storyBrief } from './build'

const data = assemble(fixture)
const at = (d: typeof data, key: string) => makeCursor(d, storyOrder(d.events), key)

/**
 * The fixture with more to say: B was A's rival until `start`, `start` foreshadows `end`, and B
 * knows a fact from the start that A learns only at `end`.
 */
const twist: ProjectResult = {
  ...fixture,
  characters: fixture.characters.map(c => (c.key === 'b'
    ? { ...c, relations: [{ position: 1, otherKey: 'a', relation: 'rival', mutual: false, member: false, sinceKey: 'flood', untilKey: 'start', tone: null }] }
    : c)),
  events: fixture.events.map(e => (e.key === 'start' ? { ...e, links: [{ position: 1, toKey: 'end', relation: '伏笔', mutual: false, note: 'the door', kind: null }] } : e)),
  learnings: [...fixture.learnings, {
    key: 'secret', position: null, text: 'B is a spy', kind: 'knowledge', description: null,
    characters: [
      { learningKey: 'secret', position: 1, characterKey: 'b', sinceKey: null, untilKey: null, time: null, note: null },
      { learningKey: 'secret', position: 2, characterKey: 'a', sinceKey: 'end', untilKey: null, time: null, note: null },
    ],
  }],
}
const twisted = assemble(twist)

describe('characterBrief', () => {
  it('shows where the character stands at the cursor, in the interface language', () => {
    expect(characterBrief(data, 'a', DICT.zh, at(data, 'start'))).toBe(`# A \`a\`

截至: Start \`start\` · act-1 · 2/3

- 别名: Alpha
- 类型: 人物 · 主要人物
- 状态: 在场
- 当前阶段: call
- 阵营: group \`group\`

The hero

## 弧光阶段
1. call · Start \`start\`

## 此时的关系
- A ↔ B \`b\`: friend

## 此时知道
- The door is beyond the sea · 想法

## 经历的事件（未注明即身体在场）
### act-1
- Start \`start\`
`)
  })

  it('tells the whole story without a cursor', () => {
    expect(characterBrief(data, 'a', DICT.en)).toBe(`# A \`a\`

Whole story

- Aliases: Alpha
- Kind: Character · Main character
- Factions: group \`group\`

The hero

## Arc stages
1. call · Start \`start\`

## Relations
- A ↔ B \`b\`: friend · Since Start \`start\`

## Knowledge
- The door is beyond the sea · Idea · Learned at Start \`start\` · Forgotten at end \`end\`

## Events (in person unless noted)
### act-1
- Start \`start\`
- end \`end\` · Dies
`)
  })

  it('marks ended relations and lists what others know first', () => {
    const brief = characterBrief(twisted, 'a', DICT.en, at(twisted, 'start'))
    expect(brief).toContain(`## Ended relations
- B \`b\` is A's rival · ended at Start \`start\`
`)
    expect(brief).toContain(`## Others know, this character does not yet
- B is a spy · known to B \`b\` · learns at end \`end\`
`)
  })

  it('leaves out what has not started at the cursor', () => {
    const brief = characterBrief(data, 'a', DICT.en, at(data, 'flood'))
    expect(brief).toContain('- Status: Not yet introduced')
    expect(brief).not.toContain('## Relations now')
    expect(brief).not.toContain('## Events')
  })

  it('is empty for an unknown character', () => {
    expect(characterBrief(data, 'nobody', DICT.en)).toBe('')
  })
})

describe('eventBrief', () => {
  it('lists the facts, the people and the chains of causes and effects', () => {
    expect(eventBrief(data, 'start', DICT.en)).toBe(`# Start \`start\`

- Act: act-1
- Time: day 1
- Place: Cabin \`cabin\`
- Core event

## People (in person unless noted)
- A \`a\`

## Causes, in story order
1. Flood \`flood\` — → \`start\` causes

## Effects, in story order
1. end \`end\` — ← \`start\` causes

## Learned and forgotten
- A \`a\`: The door is beyond the sea · Idea
`)
  })

  it('names the link kind when the word does not, and who forgets', () => {
    expect(eventBrief(twisted, 'end', DICT.zh)).toBe(`# end \`end\`

- 部: act-1

## 人物（未注明即身体在场）
- A \`a\` · 死亡

## 前因（按故事顺序）
1. Flood \`flood\` — → \`start\` causes (导致)
2. Start \`start\` — → \`end\` 伏笔: the door

## 得知与遗忘
- A \`a\`: The door is beyond the sea · 遗忘
- A \`a\`: B is a spy
`)
  })

  it('names the kind of a link word only the first time', () => {
    const brief = eventBrief(data, 'start', DICT.zh)
    expect(brief).toContain('1. Flood `flood` — → `start` causes (导致)')
    expect(brief).toContain('1. end `end` — ← `start` causes\n')
  })

  it('is empty for an unknown event', () => {
    expect(eventBrief(data, 'nothing', DICT.en)).toBe('')
  })
})

describe('storyBrief', () => {
  it('sums up the story at the cursor, with open setups', () => {
    expect(storyBrief(twisted, DICT.en, at(twisted, 'start'))).toBe(`# demo · story brief

As of: Start \`start\` · act-1 · 2/3

## Acts
- act-1 · 2/3

## Cast
- A \`a\` · Present · call
- Present: B \`b\`

## Relations
### group \`group\`
- Members: A \`a\`
### Outside the factions
- A \`a\` ↔ B \`b\`: friend

## Open setups
- Start \`start\` → end \`end\`: the door

## Findings
### Relation turns
- B \`b\`, A \`a\`: rival → friend · \`start\`
`)
  })

  it('leaves out findings that rest on events after the cursor', () => {
    const whole = storyBrief(twisted, DICT.en)
    const early = storyBrief(twisted, DICT.en, at(twisted, 'start'))
    expect(whole).toContain('### Setup and payoff')
    expect(whole).toContain('### Exits per act')
    expect(early).not.toContain('### Setup and payoff')
    expect(early).not.toContain('### Longest causal chain')
    expect(early).not.toContain('### Exits per act')
  })

  it('shows the whole story as it ends without a cursor', () => {
    expect(storyBrief(data, DICT.zh)).toBe(`# demo · 故事简报

整个故事

## 各部
- act-1 · 3

## 人物
- A \`a\` · 已死亡 · end \`end\` · call
- 在场: B \`b\`

## 人物关系
### group \`group\`
- 成员: A \`a\`
### 阵营之外
- A \`a\` ↔ B \`b\`: friend

## 故事发现
### 最长因果链
- Flood \`flood\` → Start \`start\` → end \`end\`
### 各部退场
- act-1: 死亡 1, 离场 0
`)
  })

  it('keeps a low-ranked finding of the story as of the cursor', () => {
    // e0 sets up nine late events, far apart; the short setup e1 → e2 ranks last of ten.
    const event = (i: number): ProjectResult['events'][number] => ({
      ...fixture.events[2], key: `e${i}`, title: `E${i}`, sortOrder: i, participants: [],
      links: i === 0 ? Array.from({ length: 9 }, (_, j) => ({ position: j + 1, toKey: `e${10 + j}`, relation: '伏笔', mutual: false, note: null, kind: null }))
        : i === 1 ? [{ position: 1, toKey: 'e2', relation: '伏笔', mutual: false, note: null, kind: null }] : [],
    })
    const setups = assemble({ ...fixture, events: Array.from({ length: 19 }, (_, i) => event(i)), learnings: [] })
    expect(storyBrief(setups, DICT.en, at(setups, 'e2'))).toContain('### Setup and payoff\n- E1 `e1` → E2 `e2` · ')
  })

  it('states at a cursor the findings the insights view shows there', () => {
    // A chain flood → start → end, so the story so far has causal findings at every cursor.
    const chained = assemble({ ...twist, events: twist.events.map(e => (e.key === 'start' ? { ...e, links: [...e.links, { position: 2, toKey: 'end', relation: 'causes', mutual: false, note: null, kind: null }] } : e)) })
    const kindsIn = (brief: string) => [...brief.split('## Findings\n')[1]?.matchAll(/^### (.+)$/gm) ?? []].map(m => m[1])
    for (const d of [data, twisted, chained]) {
      for (const e of d.events) {
        const cursor = at(d, e.key)!
        const shown = [...new Set(buildInsights(storyAsOf(d, cursor)).filter(i => i.category === 'finding').map(i => DICT.en.insightKind[i.kind][0]))]
        expect(kindsIn(storyBrief(d, DICT.en, cursor))).toEqual(shown)
      }
    }
  })

  it('drops a dead member from its faction at the cursor', () => {
    expect(storyBrief(data, DICT.en, at(data, 'end'))).not.toContain('- Members: A `a`')
  })
})

describe('learning descriptions in briefs', () => {
  const withNote = (description: string) => assemble({ ...fixture, learnings: [{ ...fixture.learnings[0], description }] })
  it('follow the learning text when short', () => {
    const d = withNote('Told by the keeper')
    const a = d.characters.find(c => c.key === 'a')!
    expect(characterBrief(d, a.key, DICT.en)).toContain('- The door is beyond the sea — Told by the keeper')
    expect(eventBrief(d, 'start', DICT.en)).toContain('The door is beyond the sea — Told by the keeper')
  })
  it('stay out when long', () => {
    const d = withNote('x'.repeat(200))
    expect(characterBrief(d, d.characters.find(c => c.key === 'a')!.key, DICT.en)).not.toContain('xxx')
  })
})

describe('briefFileName', () => {
  it('joins the parts and keeps letters of any script, digits, - _ and .', () => {
    expect(briefFileName('故事', 'hero')).toBe('故事-hero.md')
    expect(briefFileName('demo', 'story', 'at-start')).toBe('demo-story-at-start.md')
    expect(briefFileName('demo', 'story', '')).toBe('demo-story.md')
  })
  it('turns anything else into one dash, and never leaves a path', () => {
    expect(briefFileName('../etc', 'a/b:c "d"')).toBe('etc-a-b-c-d.md')
    expect(briefFileName('S1 I · 劫案')).toBe('S1-I-劫案.md')
    expect(briefFileName('///')).toBe('brief.md')
  })
})

