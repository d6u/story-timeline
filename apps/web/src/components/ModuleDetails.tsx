import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { linkKind } from '../causality/build.ts'
import { relationTone, wordColors } from '../data/relations.ts'
import { useT } from '../i18n.tsx'
import type { Character, CharacterName, CharacterRelation, EventLink, Knowledge, Learning, Participant, Place, Source } from '../data/types.ts'
import type { Phase } from '../cursor/state.ts'
import type { Timeline } from '../timeline/build.ts'
import type { Selection } from './DetailPanel.tsx'
import { PersonBadge } from './people.tsx'
import type { LaneIndex } from './people.tsx'

type Navigation = { timeline: Timeline; onSelect: (selection: Selection) => void }

export function EventReference({ event, timeline, onSelect }: Navigation & { event?: string }) {
  const t = useT()
  const target = event ? timeline.resolve({ event, text: '' }) : undefined
  if (!target) return <Badge variant="outline">{event ? t.noEvent(event) : t.unmarkedEvent}</Badge>
  return <Button variant="link" size="xs" className="h-auto max-w-full justify-start px-0 text-left whitespace-normal" onClick={() => onSelect({ kind: 'event', id: target.event.key })}>{target.event.title}</Button>
}
/**
 * A relation word, or with `link` an event link word, coloured by its kind; a link is classified as
 * the causality view does, a relation by its stored `tone` first, as the relation graph does.
 */
export function WordBadge({ word, link = false, mutual = false, kind, tone: stored }: { word: string; link?: boolean; mutual?: boolean; kind?: EventLink['kind']; tone?: CharacterRelation['tone'] }) {
  const tone = link ? linkKind(word, mutual, kind) : relationTone(word, stored)
  return <Badge variant="outline" className={wordColors[tone]} data-tone={tone}>{word}</Badge>
}
export function ConfidenceBadge({ value }: { value?: string }) {
  const t = useT()
  if (!value) return null
  return <Badge variant="outline" className={value === 'unsure' ? wordColors.cause : wordColors.same}>{value === 'likely' ? t.likely : value === 'unsure' ? t.unsure : value}</Badge>
}
export function PlaceDetails({ place }: { place: Place }) {
  const t = useT()
  return <div className="flex flex-col gap-2"><div className="flex flex-wrap items-center gap-2"><span>{place.name}</span><Badge variant="outline">{t.realm[place.realm] ?? place.realm}</Badge></div>
    {place.parent && <p className="text-xs text-muted-foreground">{t.inPlace} <span className="text-foreground">{place.parentName ?? place.parent}</span></p>}
    {place.description && <p className="whitespace-pre-line text-muted-foreground">{place.description}</p>}
  </div>
}
export function Participants({ people, timeline, lanes, onSelect }: Navigation & { people: Participant[]; lanes: LaneIndex }) {
  const t = useT()
  return <ul aria-label={t.eventPeople} className="flex flex-col gap-2">{people.map(p => {
    const c = timeline.characterById.get(p.character_id)
    return <li key={p.character_id} className="flex flex-wrap items-center gap-2">
      {c && <PersonBadge character={c} lanes={lanes} onClick={id => onSelect({ kind: 'character', id })} />}
      {p.presence && <Badge variant="outline">{t.presence[p.presence] ?? p.presence}</Badge>}
      {p.exit && <Badge variant={p.exit === 'dies' ? 'destructive' : 'secondary'}>{t.exit[p.exit] ?? p.exit}</Badge>}
    </li>
  })}</ul>
}
/** The rows of a character's relations. With `phaseOf`, a row that does not hold says whether it ended or has not started. */
export function Relations({ character, rows, timeline, lanes, onSelect, label, phaseOf }: Navigation & { label?: string; character: Character; rows: CharacterRelation[]; lanes: LaneIndex; phaseOf?: (r: CharacterRelation) => Phase }) {
  const t = useT()
  return <ul aria-label={label ?? t.relSec} className="flex flex-col gap-3">{rows.map((r, i) => {
    const other = timeline.characterById.get(r.character_id)
    if (!other) return null
    return <li key={i} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2"><PersonBadge character={other} lanes={lanes} onClick={id => onSelect({ kind: 'character', id })} /><WordBadge word={r.label} tone={r.tone} />
        {r.mutual && <Badge variant="secondary">{t.mutual}</Badge>}
        {r.member && r.incoming && <Badge variant="secondary">{t.member}</Badge>}
        {phaseOf && phaseOf(r) !== 'active' && <Badge variant="outline" className="text-muted-foreground">{t.phase[phaseOf(r)]}</Badge>}
      </div>
      {!r.member && !r.mutual && <p className="text-xs text-muted-foreground">{r.incoming ? t.isOf(other.name, character.name, r.label) : t.isOf(character.name, other.name, r.label)}</p>}
      {(r.since || r.until) && <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">{r.since && <>{t.since} <EventReference event={r.since} timeline={timeline} onSelect={onSelect} /></>}{r.until && <>{t.until} <EventReference event={r.until} timeline={timeline} onSelect={onSelect} /></>}</div>}
    </li>
  })}</ul>
}
export function EventLinks({ links, timeline, onSelect }: Navigation & { links: EventLink[] }) {
  const t = useT()
  return <ul aria-label={t.linksSec} className="flex flex-col gap-3">{links.map((link, i) => <li key={i} className="flex flex-col gap-1">
    <div className="flex flex-wrap items-center gap-2"><span aria-label={link.mutual ? t.linkBoth : link.incoming ? t.linkFrom : t.linkTo}>{link.mutual ? '↔' : link.incoming ? '←' : '→'}</span><WordBadge word={link.relation} link mutual={link.mutual} kind={link.kind} /><EventReference event={link.event} timeline={timeline} onSelect={onSelect} /></div>
    {link.note && <p className="whitespace-pre-line text-muted-foreground">{link.note}</p>}
  </li>)}</ul>
}
export function EventLearnings({ items, timeline, lanes, onSelect }: Navigation & { items: Learning[]; lanes: LaneIndex }) {
  const t = useT()
  return <ul aria-label={t.learnsSec} className="flex flex-col gap-3">{items.map((item, i) => <li key={i} className="flex flex-col gap-1.5">
    <div className="flex flex-wrap items-center gap-2">{item.who.map(id => {
      const c = timeline.characterById.get(id)
      return c ? <PersonBadge key={id} character={c} lanes={lanes} onClick={id => onSelect({ kind: 'character', id })} /> : <Badge key={id} variant="outline">{id}</Badge>
    })}<Badge variant="secondary">{item.forgotten ? t.forgot : t.learned}</Badge>{item.when && <span className="font-mono text-xs text-muted-foreground">{item.when}</span>}</div>
    <p className="whitespace-pre-line leading-relaxed">{item.text}</p>
    {item.description && <p className="whitespace-pre-line text-xs text-muted-foreground">{item.description}</p>}
  </li>)}</ul>
}
export function KnowledgeList({ items, timeline, onSelect }: Navigation & { items: Knowledge[] }) {
  const t = useT()
  return <ul aria-label={t.knowledgeSec} className="flex flex-col gap-4">{items.map((item, i) => <li key={`${item.key}:${i}`} className="flex flex-col gap-1.5">
    <div><Badge variant="outline">{t.knowledgeKind[item.kind] ?? item.kind}</Badge></div>
    <p className="whitespace-pre-line leading-relaxed">{item.text}</p>
    {item.description && <p className="whitespace-pre-line text-xs text-muted-foreground">{item.description}</p>}
    <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">{item.since ? <>{t.learnedAt} <EventReference event={item.since} timeline={timeline} onSelect={onSelect} /></> : <span>{t.knownAtStart}</span>}{item.time && <span className="font-mono">{item.time}</span>}</div>
    <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">{item.until ? <>{t.forgotAt} <EventReference event={item.until} timeline={timeline} onSelect={onSelect} /></> : <span>{t.kept}</span>}</div>
    {item.note && <p className="whitespace-pre-line text-xs text-muted-foreground">{item.note}</p>}
  </li>)}</ul>
}
export function SourceList({ sources }: { sources: Source[] }) {
  const t = useT()
  return <ul aria-label={t.sourcesSec} className="flex flex-col gap-4">{sources.map(source => <li key={source.key} className="flex flex-col gap-1.5">
    <p>{source.title}</p>{source.ref && <p className="font-mono text-xs">{source.ref}</p>}
    {source.location && (/^https?:\/\//i.test(source.location) ? <a className="break-words text-xs underline" href={source.location} target="_blank" rel="noreferrer">{source.location}</a> : <p className="break-words font-mono text-xs text-muted-foreground">{source.location}</p>)}
    {source.note && <p className="whitespace-pre-line text-xs text-muted-foreground">{source.note}</p>}
  </li>)}</ul>
}
/** Other names; a name with a language label or a note gets its own line with them. */
export function NameList({ names }: { names: CharacterName[] }) {
  const t = useT()
  if (!names.some(n => n.lang || n.note)) return <>{names.map(n => n.name).join(t.listSep)}</>
  return <ul aria-label={t.aliases} className="flex flex-col gap-1">{names.map(n => <li key={n.name} className="flex flex-wrap items-baseline gap-x-2">
    <span>{n.name}</span>
    {n.lang && <span className="font-mono text-[11px] text-muted-foreground">{n.lang}</span>}
    {n.note && <span className="text-xs text-muted-foreground">{n.note}</span>}
  </li>)}</ul>
}
