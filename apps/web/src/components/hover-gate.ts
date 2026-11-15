/**
 * When an event row's hover card may show. The card shows what the row clips, on hover or focus.
 * A press on the row, or the row becoming the selection (a click, J or K), closes the card and
 * keeps it closed until the pointer leaves the row: the detail panel then shows the same text,
 * and a card that opens under the pointer after a click covers the timeline.
 */
export interface HoverGate {
  open: boolean
  /** No card until the pointer leaves the row. */
  blocked: boolean
}

export type HoverStep =
  /** The hover card asks to open or close (pointer or focus, after its delay); `clips` is whether the row clips anything. */
  | { type: 'want'; open: boolean; clips: boolean }
  /** A pointer press on the row. */
  | { type: 'press' }
  /** The row became the selection, or stopped being it. */
  | { type: 'selected'; selected: boolean }
  /** The pointer left the row. */
  | { type: 'leave' }

export const closedGate: HoverGate = { open: false, blocked: false }

export function hoverGate(gate: HoverGate, step: HoverStep): HoverGate {
  switch (step.type) {
    case 'want': return { ...gate, open: step.open && step.clips && !gate.blocked }
    case 'press': return { open: false, blocked: true }
    case 'selected': return step.selected ? { open: false, blocked: true } : { ...gate, blocked: false }
    case 'leave': return { open: false, blocked: false }
  }
}
