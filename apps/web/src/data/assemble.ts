import type { ProjectResult } from '../graphql/queries.ts'
import { learningChanges } from './learnings.ts'
import type { Act, Character, Knowledge, Place, ProjectData, Source, StoryEvent } from './types.ts'

const text = (value: string | null | undefined) => (value === null || value === undefined ? undefined : value)
const defined = <T extends object>(object: T): T =>
  Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined)) as T

/** Builds the app's characters and events from one ProjectQuery result. */
export function assemble(project: ProjectResult): ProjectData {

  const names = new Map(project.places.map(p => [p.key, p.name ?? p.key]))
  const places = new Map(project.places.map((p): [string, Place] => [p.key, defined({
    key: p.key, name: p.name ?? p.key, realm: p.realm, description: text(p.description), parent: text(p.parentKey),
    parentName: p.parentKey ? names.get(p.parentKey) : undefined,
  })]))
  // Acts in list order; an act without a position goes after those with one, in the order the API gives.
  const acts = project.acts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (x.a.position ?? Infinity) - (y.a.position ?? Infinity) || x.i - y.i)
    .map(({ a }): Act => defined({ name: a.name, position: a.position ?? undefined, span: text(a.span), description: text(a.description) }))
  const sources = new Map(project.sources.map((s): [string, Source] => [s.key, defined({
    key: s.key, title: s.title ?? s.key, lang: text(s.lang), location: text(s.location), note: text(s.note),
  })]))

  // Relations and links are stored once, on the owner; the other end sees them as incoming.
  const incomingRelations = new Map<string, { owner: string; row: ProjectResult['characters'][number]['relations'][number] }[]>()
  for (const c of project.characters) {
    for (const row of c.relations) incomingRelations.set(row.otherKey, [...(incomingRelations.get(row.otherKey) ?? []), { owner: c.key, row }])
  }
  const incomingLinks = new Map<string, { owner: string; row: ProjectResult['events'][number]['links'][number] }[]>()
  for (const e of project.events) {
    for (const row of e.links) incomingLinks.set(row.toKey, [...(incomingLinks.get(row.toKey) ?? []), { owner: e.key, row }])
  }
  const knowledgeByCharacter = new Map<string, Knowledge[]>()
  for (const l of project.learnings) {
    for (const row of l.characters) {
      const item: Knowledge = defined({ key: l.key, text: l.text ?? '', kind: l.kind, description: text(l.description), since: text(row.sinceKey), until: text(row.untilKey), time: text(row.time), note: text(row.note) })
      knowledgeByCharacter.set(row.characterKey, [...(knowledgeByCharacter.get(row.characterKey) ?? []), item])
    }
  }

  const characters = project.characters.map((c): Character => {
    const relations = [
      ...c.relations.map(r => defined({ character_id: r.otherKey, label: r.relation ?? '', incoming: false, mutual: r.mutual, member: r.member, since: text(r.sinceKey), until: text(r.untilKey), tone: r.tone ?? undefined })),
      ...(incomingRelations.get(c.key) ?? []).map(({ owner, row: r }) => defined({ character_id: owner, label: r.relation ?? '', incoming: true, mutual: r.mutual, member: r.member, since: text(r.sinceKey), until: text(r.untilKey), tone: r.tone ?? undefined })),
    ]
    return defined({
      key: c.key,
      id: text(c.id),
      name: c.name ?? c.key,
      description: c.description,
      metadata: defined({
        kind: c.kind,
        category: text(c.category),
        lane: c.position ?? undefined,
        color: text(c.color),
        relations,
        knowledge: knowledgeByCharacter.get(c.key) ?? [],
        aliases: c.names.length ? c.names.map(n => n.name) : undefined,
        names: c.names.length ? c.names.map(n => defined({ name: n.name, lang: text(n.lang), note: text(n.note) })) : undefined,
        reading: c.arcStages.length
          ? { beats: c.arcStages.map(s => defined({ since: text(s.sinceKey), description: text(s.description), when: text(s.time), stage: text(s.stage) })) }
          : undefined,
      }),
    })
  })

  const learns = learningChanges(project.learnings)
  const events = project.events.map((e, index): StoryEvent => defined({
    key: e.key,
    id: text(e.id),
    title: e.title ?? e.key,
    description: e.description,
    character_ids: e.participants.map(p => p.characterKey),
    is_core: e.isCore,
    sort_order: e.sortOrder ?? index,
    metadata: defined({
      key: e.key,
      act: e.actName,
      time: text(e.time),
      confidence: text(e.confidence),
      placeKey: text(e.placeKey),
      placeInfo: e.placeKey ? places.get(e.placeKey) : undefined,
      participants: e.participants.map(p => defined({ character_id: p.characterKey, presence: text(p.presence), exit: text(p.exit) })),
      links: [
        ...e.links.map(l => defined({ event: l.toKey, relation: l.relation ?? '', incoming: false, mutual: l.mutual, note: text(l.note), kind: l.kind ?? undefined })),
        ...(incomingLinks.get(e.key) ?? []).map(({ owner, row: l }) => defined({ event: owner, relation: l.relation ?? '', incoming: true, mutual: l.mutual, note: text(l.note), kind: l.kind ?? undefined })),
      ],
      // Citations by `position`, unnumbered ones last; the sort is stable, so ties keep the API order.
      sources: [...e.sources].sort((x, y) => (x.position ?? Infinity) - (y.position ?? Infinity))
        .flatMap(r => { const source = sources.get(r.sourceKey); return source ? [defined({ ...source, ref: text(r.ref) })] : [] }),
      learns: learns.get(e.key),
    }),
  }))

  return { id: project.id, name: project.name, characters, events, acts, places: [...places.values()] }
}
