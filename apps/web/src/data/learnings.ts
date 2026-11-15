import type { ProjectResult } from '../graphql/queries.ts'
import type { Learning } from './types.ts'

type LearningRow = ProjectResult['learnings'][number]

/**
 * Joins each learning to the events where a character learns (`sinceKey`) or forgets (`untilKey`) it.
 * `who` holds character keys, so two characters with one name stay apart.
 */
export function learningChanges(learnings: LearningRow[]): Map<string, Learning[]> {
  const groups = new Map<string, Learning>()
  const events = new Map<string, Learning[]>()
  for (const learning of learnings) {
    for (const row of learning.characters) {
      for (const field of ['sinceKey', 'untilKey'] as const) {
        const event = row[field]
        if (!event) continue
        const forgotten = field === 'untilKey'
        const when = !forgotten && row.time ? row.time : undefined
        const key = JSON.stringify([event, learning.key, forgotten, when])
        let item = groups.get(key)
        if (!item) {
          item = { key: learning.key, who: [], text: learning.text ?? '', ...(learning.description ? { description: learning.description } : {}), ...(when ? { when } : {}), ...(forgotten ? { forgotten: true } : {}) }
          groups.set(key, item)
          events.set(event, [...(events.get(event) ?? []), item])
        }
        item.who.push(row.characterKey)
      }
    }
  }
  return events
}
