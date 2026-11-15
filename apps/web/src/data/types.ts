/**
 * The app's view of a project, built by assemble.ts from a GraphQL ProjectQuery result.
 * Every reference to a character or an event uses its `key`, as the API and the briefs do.
 * Fields named `character_id` or `character_ids` hold character keys.
 */

import type { StoredTone } from './relations.ts'

export interface ArcLink {
  text: string
  /** The key of the event that shows it. */
  event?: string
}

export interface ArcBeat {
  since?: string
  description?: string
  when?: string
  stage?: string
}

export interface CharacterRelation {
  character_id: string
  label: string
  mutual: boolean
  member: boolean
  incoming: boolean
  since?: string
  until?: string
  /** The tone the author stored (`character_relations.tone`). Without it, the relation word decides. */
  tone?: StoredTone
}
export interface EventLink {
  event: string
  relation: string
  mutual: boolean
  incoming: boolean
  note?: string
  /** The kind the author stored (`event_links.kind`). Without it, the relation word decides. */
  kind?: 'cause' | 'setup' | 'reveal' | 'echo'
}
export interface Place {
  key: string
  name: string
  realm: string
  description?: string
  /** The key of the larger place that holds this one. */
  parent?: string
  /** The name of that place, when the project has it. */
  parentName?: string
}
export interface Source {
  key: string
  title: string
  ref?: string
  lang?: string
  location?: string
  note?: string
}
export interface Knowledge {
  key: string
  text: string
  kind: string
  since?: string
  until?: string
  time?: string
  note?: string
  /** Extra context for the statement (`learnings.description`). */
  description?: string
}
export interface Participant {
  character_id: string
  presence?: string
  exit?: string
}
export interface CharacterMetadata {
  kind?: string
  relations?: CharacterRelation[]
  knowledge?: Knowledge[]
  category?: string
  /** Lane order for main characters; comes from `Character.position`. */
  lane?: number
  /** An exact CSS color chosen by the author. Without it, the lane takes a free palette slot. */
  color?: string
  aliases?: string[]
  /** The other names with their language label and note, in the order of `aliases`. */
  names?: CharacterName[]
  reading?: { beats?: ArcBeat[] }
}

export interface CharacterName {
  name: string
  lang?: string
  note?: string
}

export interface Character {
  /** The character key: the app's identity for the character, as in the API, the URL, and the briefs. */
  key: string
  /** The UUID-like id from an import source, when the row has one. Only read to open an old link that names it. */
  id?: string
  name: string
  description: string | null
  metadata: CharacterMetadata
}

export interface Learning {
  key?: string
  forgotten?: boolean
  /** The keys of the characters who learn or forget it. */
  who: string[]
  text: string
  /** Extra context for the statement (`learnings.description`). */
  description?: string
  when?: string
}

export interface EventMetadata {
  key?: string
  placeInfo?: Place
  participants?: Participant[]
  links?: EventLink[]
  sources?: Source[]
  /** The stored place key; `placeInfo` is the place it names, when the project has it. */
  placeKey?: string
  confidence?: string
  time?: string
  act?: string
  learns?: Learning[]
}

export interface StoryEvent {
  /** The event key: the app's identity for the event, as in the API, the URL, and the briefs. */
  key: string
  /** The UUID-like id from an import source, when the row has one. Read to open an old link that names it, and by the `#` search. */
  id?: string
  title: string
  description: string | null
  /** Character keys, in the order the event lists them. */
  character_ids: string[]
  is_core: boolean
  sort_order: number
  metadata: EventMetadata
}

/** A large plot unit (`acts`). Events name it by `name`. */
export interface Act {
  name: string
  position?: number
  span?: string
  description?: string
}

export interface ProjectData {
  id: string
  name: string
  characters: Character[]
  events: StoryEvent[]
  /** The acts as the project lists them, in `position` order. Without it, acts follow their first event. */
  acts?: Act[]
  /** Every place of the project, including those no event names. */
  places?: Place[]
}
