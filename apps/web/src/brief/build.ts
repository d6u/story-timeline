import { buildCausality, DIRECTED, downstream, upstream, type CausalEdge, type Causality } from '../causality/build'
import { knownAt, phaseAt, reached, stageAt, statusesAt, storyAsOf, storyEvents, storyOrder, type Phase, type Status, type StoryCursor, type StoryOrder } from '../cursor/state'
import type { ArcBeat, Character, CharacterRelation, ProjectData, StoryEvent } from '../data/types'
import { buildInsights, type Insight } from '../insights/build'
import type { Dictionary } from '../i18n'

/**
 * Markdown briefs for a writing agent: one character, one event, or the state of the story. Story
 * content (names, titles, relation words) stays as the data stores it; only the fixed headings
 * come from `labels`, in the interface language. Every event and character carries its key in
 * backticks, the key the GraphQL mutations take. A section with nothing in it is left out.
 */
export type BriefLabels = Pick<Dictionary,
  | 'brief' | 'asOf' | 'wholeStory' | 'act' | 'time' | 'place' | 'aliases' | 'person' | 'group' | 'legCore' | 'category' | 'presence' | 'exit'
  | 'status' | 'knowledgeKind' | 'linkKind' | 'isOf' | 'since' | 'until' | 'learnedAt' | 'forgotAt' | 'forgot' | 'stageNow' | 'arcSec' | 'relNow'
  | 'relSec' | 'knowledgeSec' | 'peopleSec' | 'insightKind' | 'reachN' | 'apart' | 'together' | 'ofAct' | 'goneFor' | 'goneAfter' | 'backAt'
  | 'exitsN' | 'ironyLate' | 'ironyLearns' | 'ironyWith'>

/** How many findings of each kind the story brief keeps, best first. */
const FINDINGS_PER_KIND = 3

/** What the writers share: lookups, story order, and the labels. */
interface Context {
  data: ProjectData
  l: BriefLabels
  story: StoryEvent[]
  order: StoryOrder
  byId: Map<string, Character>
  byKey: Map<string, StoryEvent>
  /** Link words whose kind the brief has named already. */
  named: Set<string>
}

function context(data: ProjectData, l: BriefLabels): Context {
  return {
    data, l, story: storyEvents(data.events), order: storyOrder(data.events),
    byId: new Map(data.characters.map(c => [c.key, c])), byKey: new Map(data.events.map(e => [e.key, e])), named: new Set(),
  }
}

const code = (key: string) => `\`${key}\``
/** An event as `title `key``; a key that names no event stays bare. */
const ev = (c: Context, key: string) => { const e = c.byKey.get(key); return e ? `${e.title} ${code(key)}` : code(key) }
/** A character as `name `key``. */
const who = (c: Context, id: string) => { const ch = c.byId.get(id); return ch ? `${ch.name} ${code(ch.key)}` : code(id) }
const isGroup = (c: Context, id: string) => c.byId.get(id)?.metadata.kind === 'group'

/** A `## title` section, or nothing when there are no lines. */
const section = (title: string, lines: string[]) => (lines.length ? [`## ${title}`, ...lines].join('\n') : '')
const page = (parts: (string | null | undefined)[]) => `${parts.filter(Boolean).join('\n\n')}\n`

/** The line that says which part of the story the brief covers. */
function scope(c: Context, cursor?: StoryCursor): string {
  if (!cursor) return c.l.wholeStory
  const act = cursor.event.metadata.act
  return `${c.l.asOf}: ${ev(c, cursor.event.key)}${act ? ` · ${act}` : ''} · ${cursor.at + 1}/${c.story.length}`
}

function statusText(c: Context, s: Status): string {
  return 'event' in s ? `${c.l.status[s.kind]} · ${ev(c, s.event)}` : c.l.status[s.kind]
}

/** The phase of a span; with no cursor everything holds. */
const phase = (span: { since?: string; until?: string }, cursor?: StoryCursor): Phase => (cursor ? phaseAt(span, cursor.order, cursor.at) : 'active')

/** A relation row as a sentence: `A is B's label`, or `A ↔ B: label` when it is mutual. */
function relationLine(c: Context, owner: string, other: string, r: { label: string; mutual: boolean }): string {
  return r.mutual ? `${who(c, owner)} ↔ ${who(c, other)}: ${r.label}` : c.l.isOf(who(c, owner), who(c, other), r.label)
}

/** How a character takes part in an event; in person is the default and goes unsaid. */
function howText(c: Context, p?: { presence?: string; exit?: string }): string {
  const how = [p?.presence !== 'body' && p?.presence && (c.l.presence[p.presence] ?? p.presence), p?.exit && (c.l.exit[p.exit] ?? p.exit)].filter(Boolean)
  return how.length ? ` · ${how.join(' · ')}` : ''
}

/** Where a span starts and ends, for the whole-story briefs. */
function spanText(c: Context, s: { since?: string; until?: string }): string {
  return `${s.since ? ` · ${c.l.since} ${ev(c, s.since)}` : ''}${s.until ? ` · ${c.l.until} ${ev(c, s.until)}` : ''}`
}

const kindText = (c: Context, kind: string) => (kind === 'knowledge' ? '' : ` · ${c.l.knowledgeKind[kind] ?? kind}`)

/** The longest learning description a brief line carries; a longer one stays in the app. */
const NOTE_MAX = 120
/** A learning's description after its text, when there is a short one. */
const noteOf = (description?: string) => (description && description.length <= NOTE_MAX ? ` — ${description.replace(/\s+/g, ' ')}` : '')

/** One arc stage on one line: name, its event, its time, and its text when `full`. */
function beatLine(c: Context, b: ArcBeat, i: number, full: boolean): string {
  const parts = [b.stage ?? '', b.since && ev(c, b.since), b.when].filter(Boolean).join(' · ')
  return `${i + 1}. ${parts}${full && b.description ? ` — ${b.description}` : ''}`
}

/**
 * One character: who it is, and with a cursor where it stands then (status, arc stage, the
 * relations that hold and those that ended, what it knows and what others know before it) and
 * the events it took part in so far. Without a cursor: the whole story, with every span's events.
 */
export function characterBrief(data: ProjectData, characterKey: string, labels: BriefLabels, cursor?: StoryCursor): string {
  const c = context(data, labels)
  const ch = c.byId.get(characterKey)
  if (!ch) return ''
  const { l } = c
  const m = ch.metadata
  const relations = m.relations ?? []
  const sides = relations.filter(r => r.member && !r.incoming && isGroup(c, r.character_id))
  const members = relations.filter(r => r.member && r.incoming)
  const others = relations.filter(r => !sides.includes(r) && !members.includes(r))
  // The character itself goes by its name only; the heading gives its key.
  const line = (r: CharacterRelation) => {
    const [owner, other] = r.incoming ? [who(c, r.character_id), ch.name] : [ch.name, who(c, r.character_id)]
    return r.mutual ? `${owner} ↔ ${other}: ${r.label}` : l.isOf(owner, other, r.label)
  }
  const beats = m.reading?.beats ?? []
  const stage = cursor ? stageAt(beats, cursor.order, cursor.at) : undefined
  const status = cursor?.status.get(ch.key)

  const sideText = [
    ...sides.filter(r => phase(r, cursor) === 'active').map(r => who(c, r.character_id)),
    ...(cursor ? sides.filter(r => phase(r, cursor) === 'ended').map(r => `${l.brief.formerly} ${who(c, r.character_id)}`) : []),
  ]
  const memberText = members.filter(r => phase(r, cursor) === 'active').map(r => who(c, r.character_id))
  const facts = [
    m.aliases?.length && `- ${l.aliases}: ${m.aliases.join(' / ')}`,
    `- ${l.brief.kind}: ${[m.kind === 'group' ? l.group : l.person, m.category && (l.category[m.category] ?? m.category)].filter(Boolean).join(' · ')}`,
    status && `- ${l.brief.status}: ${statusText(c, status)}`,
    stage !== undefined && `- ${l.stageNow}: ${beats[stage].stage ?? stage + 1}`,
    sideText.length && `- ${l.brief.factions}: ${sideText.join(', ')}`,
    memberText.length && `- ${l.brief.members}: ${memberText.join(', ')}`,
  ].filter(Boolean)

  // At a cursor: the stages reached so far, with the text of the current one only.
  const arc = cursor
    ? (stage === undefined ? [] : beats.slice(0, stage + 1).map((b, i) => beatLine(c, b, i, i === stage)))
    : beats.map((b, i) => beatLine(c, b, i, true))

  const relationParts = cursor
    ? [
      section(l.relNow, others.filter(r => phase(r, cursor) === 'active').map(r => `- ${line(r)}`)),
      section(l.brief.relEnded, others.filter(r => phase(r, cursor) === 'ended').map(r => `- ${line(r)} · ${l.brief.endedAt} ${ev(c, r.until!)}`)),
    ]
    : [section(l.relSec, others.map(r => `- ${line(r)}${spanText(c, r)}`))]

  const knowledge = m.knowledge ?? []
  const knowledgeParts = cursor
    ? [
      section(l.brief.knowsNow, knownAt(knowledge, cursor.order, cursor.at).map(k => `- ${k.text}${noteOf(k.description)}${kindText(c, k.kind)}`)),
      section(l.brief.othersKnow, unaware(c, ch, cursor)),
    ]
    : [section(l.knowledgeSec, knowledge.map(k => `- ${k.text}${noteOf(k.description)}${kindText(c, k.kind)}${k.since ? ` · ${l.learnedAt} ${ev(c, k.since)}` : ''}${k.until ? ` · ${l.forgotAt} ${ev(c, k.until)}` : ''}`))]

  const events = c.story.filter(e => e.character_ids.includes(ch.key) && (!cursor || reached(cursor.order, cursor.at, e.key)))
  const eventLines: string[] = []
  events.forEach((e, i) => {
    const act = e.metadata.act
    if (act && act !== events[i - 1]?.metadata.act) eventLines.push(`### ${act}`)
    eventLines.push(`- ${ev(c, e.key)}${howText(c, e.metadata.participants?.find(x => x.character_id === ch.key))}`)
  })

  return page([
    `# ${ch.name} ${code(ch.key)}`,
    scope(c, cursor),
    facts.join('\n'),
    ch.description,
    section(l.arcSec, arc),
    ...relationParts,
    ...knowledgeParts,
    section(l.brief.events, eventLines),
  ])
}

/**
 * The facts this character learns after the cursor while others already know them. As in the
 * insights' dramatic irony, only a fact the character has a row for counts, and ideas do not.
 */
function unaware(c: Context, ch: Character, cursor: StoryCursor): string[] {
  const people = c.data.characters.filter(o => o.key !== ch.key && o.metadata.kind !== 'group')
  return (ch.metadata.knowledge ?? []).flatMap(k => {
    if (k.kind === 'idea' || !k.since || !c.order.has(k.since) || phase(k, cursor) !== 'future') return []
    const knowers = people.filter(o => o.metadata.knowledge?.some(x => x.key === k.key && x.kind !== 'idea' && phase(x, cursor) === 'active'))
    if (!knowers.length) return []
    return [`- ${k.text} · ${c.l.brief.knownTo} ${knowers.map(o => who(c, o.key)).join(', ')} · ${c.l.brief.learnsAt} ${ev(c, k.since)}`]
  })
}

/** The relation word of a link. Its kind follows the first time, unless the word says it already. */
function linkWord(c: Context, e: CausalEdge): string {
  const kind = c.l.linkKind[e.kind]
  if (c.named.has(e.relation) || kind.toLowerCase().includes(e.relation.toLowerCase())) return e.relation
  c.named.add(e.relation)
  return `${e.relation} (${kind})`
}
const noteText = (e: CausalEdge) => (e.note ? `: ${e.note}` : '')

/**
 * A link seen from event `id`, in the direction the data states it: `→ `k` word` reads "this
 * event <word> k", `← `k` word` reads "k <word> this event". A reveal is stored on the event
 * that reveals, which is the end its arrow points to.
 */
function linkText(c: Context, e: CausalEdge, id: string): string {
  const owner = e.kind === 'reveal' ? e.to : e.from
  const other = e.from === id ? e.to : e.from
  return `${owner === id ? '→' : '←'} ${code(other)} ${linkWord(c, e)}${noteText(e)}`
}

/**
 * One event: its facts and text, who takes part and how, the chain of causes that leads to it
 * and of effects that follows from it, its echoes, and who learns or forgets what in it.
 */
export function eventBrief(data: ProjectData, eventKey: string, labels: BriefLabels): string {
  const c = context(data, labels)
  const e = data.events.find(x => x.key === eventKey)
  if (!e) return ''
  const { l } = c
  const m = e.metadata
  const facts = [
    m.act && `- ${l.act}: ${m.act}`,
    m.time && `- ${l.time}: ${m.time}`,
    m.placeInfo && `- ${l.place}: ${m.placeInfo.name} ${code(m.placeInfo.key)}`,
    e.is_core && `- ${l.legCore}`,
  ].filter(Boolean)
  const people = (m.participants ?? []).map(p => `- ${who(c, p.character_id)}${howText(c, p)}`)

  const causal = buildCausality(data)
  const directed = causal.edges.filter(x => DIRECTED.has(x.kind))
  const chain = (ids: Set<string>, side: 'from' | 'to') => {
    const within = new Set([...ids, e.key])
    return byStory(c, [...ids]).map((id, i) => {
      // A cause lists its links on toward the event; an effect, the links that reach it.
      const links = directed.filter(x => (side === 'from' ? x.from === id && within.has(x.to) : x.to === id && within.has(x.from)))
      return `${i + 1}. ${ev(c, id)} — ${links.map(x => linkText(c, x, id)).join('; ')}`
    })
  }
  const side = causal.edges
    .filter(x => !DIRECTED.has(x.kind) && (x.from === e.key || x.to === e.key))
    .map(x => `- ${ev(c, x.from === e.key ? x.to : x.from)}: ${linkWord(c, x)}${noteText(x)}`)

  return page([
    `# ${e.title} ${code(e.key)}`,
    facts.join('\n'),
    e.description,
    section(l.brief.people, people),
    section(l.brief.causes, chain(upstream(causal, e.key), 'from')),
    section(l.brief.effects, chain(downstream(causal, e.key), 'to')),
    section(l.brief.sideLinks, side),
    section(l.brief.learns, learnLines(c, e.key)),
  ])
}

/** Event keys in story order. */
function byStory(c: Context, keys: string[]): string[] {
  return keys.sort((a, b) => c.order.get(a)! - c.order.get(b)!)
}

/** Who learns (or forgets) each fact at an event, one line per fact, in the order of the cast. */
function learnLines(c: Context, key: string): string[] {
  const rows = new Map<string, { text: string; description?: string; kind: string; forgotten: boolean; ids: string[] }>()
  for (const ch of c.data.characters) {
    for (const k of ch.metadata.knowledge ?? []) {
      for (const forgotten of [false, true]) {
        if ((forgotten ? k.until : k.since) !== key) continue
        const id = `${k.key}\0${forgotten}`
        const row = rows.get(id) ?? { text: k.text, description: k.description, kind: k.kind, forgotten, ids: [] }
        row.ids.push(ch.key)
        rows.set(id, row)
      }
    }
  }
  return [...rows.values()].map(r => `- ${r.ids.map(id => who(c, id)).join(', ')}: ${r.text}${noteOf(r.description)}${r.forgotten ? ` · ${c.l.forgot}` : kindText(c, r.kind)}`)
}

/**
 * The state of the story, for an agent about to write the next scene: the acts so far, the cast
 * with status and arc stage, the relations that hold (by faction where membership is stated),
 * the setups still waiting for their payoff, and the top findings of each kind. At a cursor the
 * findings are those of the story as of the cursor (`storyAsOf`), the same the insights view shows. Without a cursor: the whole story, with each person as the story leaves them and the
 * relations that ended marked.
 */
export function storyBrief(data: ProjectData, labels: BriefLabels, cursor?: StoryCursor): string {
  const c = context(data, labels)
  const { l } = c
  const at = cursor?.at ?? c.story.length - 1
  const status = cursor?.status ?? statusesAt(data, c.order, at)
  const causal = buildCausality(data)

  return page([
    `# ${l.brief.storyTitle(data.name)}`,
    scope(c, cursor),
    section(l.brief.acts, actLines(c, at)),
    section(l.brief.cast, castLines(c, status, at)),
    section(l.relSec, relationLines(c, cursor)),
    cursor && section(l.brief.openSetups, openSetups(c, causal, cursor)),
    section(l.brief.findings, findingLines(c, buildInsights(cursor ? storyAsOf(data, cursor) : data))),
  ])
}

/** Each act reached, with its number of events; the act the cursor is in shows how far it got. */
function actLines(c: Context, at: number): string[] {
  const acts = new Map<string, { total: number; reached: number }>()
  c.story.forEach((e, i) => {
    const name = e.metadata.act ?? ''
    const a = acts.get(name) ?? { total: 0, reached: 0 }
    a.total++
    if (i <= at) a.reached++
    acts.set(name, a)
  })
  return [...acts].filter(([name, a]) => name && a.reached).map(([name, a]) => `- ${name} · ${a.reached === a.total ? a.total : `${a.reached}/${a.total}`}`)
}

/**
 * People, main characters first in lane order, then by first appearance. A main character, or
 * one in an arc stage, gets a line with status and stage; the others share one line per status.
 */
function castLines(c: Context, status: Map<string, Status>, at: number): string[] {
  const first = new Map<string, number>()
  c.story.forEach((e, i) => { for (const id of e.character_ids) if (!first.has(id)) first.set(id, i) })
  const main = (ch: Character) => (ch.metadata.category === 'main' ? ch.metadata.lane ?? Infinity : Infinity)
  const people = c.data.characters
    .filter(ch => ch.metadata.kind !== 'group')
    .sort((a, b) => main(a) - main(b) || (first.get(a.key) ?? Infinity) - (first.get(b.key) ?? Infinity))
  const lines: string[] = []
  const rest = new Map<Status['kind'], string[]>()
  for (const ch of people) {
    const s = status.get(ch.key) ?? { kind: 'present' }
    const beats = ch.metadata.reading?.beats ?? []
    const stage = s.kind === 'unseen' ? undefined : stageAt(beats, c.order, at)
    if ((ch.metadata.category === 'main' && s.kind !== 'unseen') || stage !== undefined) {
      lines.push(`- ${who(c, ch.key)} · ${statusText(c, s)}${stage !== undefined && beats[stage].stage ? ` · ${beats[stage].stage}` : ''}`)
    } else {
      rest.set(s.kind, [...(rest.get(s.kind) ?? []), `${who(c, ch.key)}${'event' in s ? ` (${code(s.event)})` : ''}`])
    }
  }
  const kinds: Status['kind'][] = ['present', 'left', 'dead', 'unseen']
  return [...lines, ...kinds.filter(k => rest.has(k)).map(k => `- ${c.l.status[k]}: ${rest.get(k)!.join(', ')}`)]
}

/**
 * The relations that hold at the cursor, each once, under the first faction both ends belong to;
 * the rest come last. Without a cursor every relation shows, and an ended one says where it ends.
 */
function relationLines(c: Context, cursor?: StoryCursor): string[] {
  const holds = (s: { since?: string; until?: string }) => !cursor || phase(s, cursor) === 'active'
  // At a cursor, a faction lists only the members still in the story.
  const gone = (id: string) => ['dead', 'left'].includes(cursor?.status.get(id)?.kind ?? '')
  const members = new Map<string, string[]>()
  const rows: { owner: string; r: CharacterRelation }[] = []
  for (const ch of c.data.characters) {
    for (const r of ch.metadata.relations ?? []) {
      if (r.incoming || r.character_id === ch.key || !holds(r)) continue
      if (r.member && isGroup(c, r.character_id)) {
        if (!gone(ch.key)) members.set(r.character_id, [...(members.get(r.character_id) ?? []), ch.key])
      } else rows.push({ owner: ch.key, r })
    }
  }
  const text = ({ owner, r }: { owner: string; r: CharacterRelation }) =>
    `- ${relationLine(c, owner, r.character_id, r)}${!cursor && r.until ? ` · ${c.l.until} ${ev(c, r.until)}` : ''}`
  const used = new Set<(typeof rows)[number]>()
  const lines: string[] = []
  for (const [faction, ids] of members) {
    const inside = new Set(ids)
    const own = rows.filter(x => !used.has(x) && inside.has(x.owner) && inside.has(x.r.character_id))
    for (const x of own) used.add(x)
    lines.push(`### ${who(c, faction)}`, `- ${c.l.brief.members}: ${[...inside].map(id => who(c, id)).join(', ')}`, ...own.map(text))
  }
  const rest = rows.filter(x => !used.has(x))
  if (rest.length && members.size) lines.push(`### ${c.l.brief.outside}`)
  return [...lines, ...rest.map(text)]
}

/** Setups planted at or before the cursor whose payoff comes after it. */
function openSetups(c: Context, causal: Causality, cursor: StoryCursor): string[] {
  return causal.edges
    .filter(e => e.kind === 'setup' && reached(cursor.order, cursor.at, e.from) && !reached(cursor.order, cursor.at, e.to))
    .sort((a, b) => c.order.get(a.from)! - c.order.get(b.from)!)
    .map(e => `- ${ev(c, e.from)} → ${ev(c, e.to)}${noteText(e)}`)
}

/** The best few findings of each kind, under the kind's name. */
function findingLines(c: Context, insights: Insight[]): string[] {
  const lines: string[] = []
  const kept = new Map<string, number>()
  for (const i of insights) {
    if (i.category !== 'finding') continue
    const n = kept.get(i.kind) ?? 0
    if (n >= FINDINGS_PER_KIND) continue
    kept.set(i.kind, n + 1)
    if (!n) lines.push(`### ${c.l.insightKind[i.kind]?.[0] ?? i.kind}`)
    lines.push(`- ${findingText(c, i)}`)
  }
  return lines
}

/** One finding on one line, from its numbers and references. */
function findingText(c: Context, i: Insight): string {
  const { l } = c
  const events = (keys: string[]) => keys.map(k => ev(c, k)).join(' → ')
  const people = (ids: string[]) => ids.map(id => who(c, id)).join(', ')
  switch (i.kind) {
    case 'root':
    case 'turningPoint': return `${ev(c, i.events[0])} · ${l.reachN(i.reach)}`
    case 'chain': return events(i.events)
    case 'setup': return `${events(i.events)} · ${l.apart(i.distance)}`
    case 'irony': return `${who(c, i.characters[0])}: ${i.text} · ${`${l.ironyLate} ${ev(c, i.events.at(-1)!)} ${l.ironyLearns}`.trim()} ${l.ironyWith} ${people(i.characters.slice(1))}`
    case 'neverMeet': return `${people(i.characters)}: ${i.label}`
    case 'unstated': return `${people(i.characters)} · ${l.together(i.shared)}`
    case 'turn': return `${people(i.characters)}: ${i.spans.map(s => s.label).join(' → ')} · ${i.events.map(code).join(', ')}`
    case 'dominant': return `${i.act}: ${people(i.characters)} · ${l.ofAct(i.count, i.actSize)}`
    case 'absence': return `${people(i.characters)} · ${l.goneFor(i.gap)} · ${l.goneAfter} ${ev(c, i.events[0])} · ${l.backAt} ${ev(c, i.events[1])}`
    case 'exitsByAct': return i.acts.filter(a => a.dies || a.leaves).map(a => `${a.act}: ${l.exit.dies} ${a.dies}, ${l.exit.leaves} ${a.leaves}`).join(' · ')
    case 'exitPeak': return `${ev(c, i.events[0])} · ${l.exitsN(i.exits)}: ${people(i.characters)}`
    default: return i.kind
  }
}

/**
 * The file name of a downloaded brief, such as `故事-hero.md`: the parts joined by `-`,
 * keeping letters and digits of any script, `-`, `_` and `.`; any other run of characters
 * (spaces, slashes, quotes, colons) becomes one `-`.
 */
export function briefFileName(...parts: string[]): string {
  const safe = parts
    .map(part => part.normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[-.]+|-+$/g, ''))
    .filter(Boolean)
    .join('-')
    .slice(0, 120)
  return `${safe || 'brief'}.md`
}

