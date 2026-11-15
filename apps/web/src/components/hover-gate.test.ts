import { describe, expect, it } from 'vitest'
import { closedGate, hoverGate, type HoverGate, type HoverStep } from './hover-gate'

const run = (steps: HoverStep[], from: HoverGate = closedGate) => steps.reduce(hoverGate, from)
const want = (clips = true): HoverStep => ({ type: 'want', open: true, clips })

describe('hoverGate', () => {
  it('opens on hover only when the row clips something, and closes when asked', () => {
    expect(run([want()]).open).toBe(true)
    expect(run([want(false)]).open).toBe(false)
    expect(run([want(), { type: 'want', open: false, clips: false }]).open).toBe(false)
  })

  it('closes at once on a press, and stays closed while the pointer is on the row', () => {
    const pressed = run([want(), { type: 'press' }])
    expect(pressed.open).toBe(false)
    // The open delay or the focus of the click asks again: still closed.
    expect(run([want()], pressed).open).toBe(false)
    expect(run([{ type: 'selected', selected: true }, want()], pressed).open).toBe(false)
  })

  it('opens again after the pointer leaves the row and comes back', () => {
    expect(run([want(), { type: 'press' }, { type: 'leave' }, want()]).open).toBe(true)
  })

  it('shows no card for a row that became the selection by keyboard, until the pointer leaves it', () => {
    const selected = run([want(), { type: 'selected', selected: true }])
    expect(selected.open).toBe(false)
    expect(run([want()], selected).open).toBe(false)
    expect(run([{ type: 'leave' }, want()], selected).open).toBe(true)
  })

  it('lets a row that stops being the selection open again', () => {
    expect(run([{ type: 'selected', selected: true }, { type: 'selected', selected: false }, want()]).open).toBe(true)
  })

  it('leaves an unselected row as it was', () => {
    expect(run([want(), { type: 'selected', selected: false }]).open).toBe(true)
  })
})
