import { describe, expect, it } from 'vitest'
import type { Character } from '../data/types'
import { PALETTE, laneColors, laneInitials, personColor } from './people'

const lane = (id: string, color?: string): Character => ({ key: id, name: id, description: null, metadata: color ? { color } : {} })

describe('laneColors', () => {
  it('keeps an explicit color and gives the others free palette slots in order', () => {
    const colors = laneColors([lane('a'), lane('b', `light-dark(${PALETTE[1].light}, ${PALETTE[1].dark})`), lane('c')])
    expect(colors.get('a')).toBe('var(--person-0)')
    expect(colors.get('b')).toBe(`light-dark(${PALETTE[1].light}, ${PALETTE[1].dark})`)
    // Slot 1 is taken by b's exact value, so c skips to slot 2.
    expect(colors.get('c')).toBe('var(--person-2)')
  })
  it('skips a slot whose hue is near an explicit oklch color', () => {
    // 画皮: 王生 has oklch(0.55 0.13 250), near slot 0 (hue 250), so 乞人 must not get slot 0.
    const colors = laneColors([lane('wang', 'oklch(0.55 0.13 250)'), lane('beggar')])
    expect(colors.get('beggar')).toBe('var(--person-1)')
  })
  it('cycles past the last slot', () => {
    const lanes = Array.from({ length: 9 }, (_, i) => lane(`p${i}`))
    expect(laneColors(lanes).get('p8')).toBe('var(--person-0)')
  })
  it('renders characters without a lane in the neutral color', () => {
    const colors = laneColors([lane('a')])
    expect(personColor(colors, 'a')).toEqual({ '--c': 'var(--person-0)' })
    expect(personColor(colors, 'zzz')).toEqual({ '--c': 'var(--muted-foreground)' })
  })
})

describe('laneInitials', () => {
  const lanes = (...names: string[]) => names.map(name => ({ key: name, name }))
  it('keeps the first character when it is unique', () => {
    expect([...laneInitials(lanes('王芳', '赵雪')).values()]).toEqual(['王', '赵'])
  })
  it('gives lanes that share a first character their first distinguishing one', () => {
    const labels = laneInitials(lanes('李明远', '王芳', '李国栋'))
    expect(labels.get('李明远')).toBe('明')
    expect(labels.get('李国栋')).toBe('国')
    expect(labels.get('王芳')).toBe('王')
  })
  it('skips a character another lane already shows', () => {
    // 明 is the label of 明月, so 李明远 moves on to 远.
    const labels = laneInitials(lanes('李明远', '李国栋', '明月'))
    expect(labels.get('李明远')).toBe('远')
    expect(labels.get('李国栋')).toBe('国')
    expect(labels.get('明月')).toBe('明')
  })
  it('joins a Latin letter to the initial', () => {
    const labels = laneInitials(lanes('Anna', 'Ayla', 'Kim'))
    expect(labels.get('Anna')).toBe('An')
    expect(labels.get('Ayla')).toBe('Ay')
    expect(labels.get('Kim')).toBe('K')
  })
  it('keeps the initial when the name has nothing more', () => {
    const labels = laneInitials([{ key: 'a', name: '李' }, { key: 'b', name: '李国栋' }])
    expect(labels.get('a')).toBe('李')
    expect(labels.get('b')).toBe('国')
  })
  it('is the same for the same lanes', () => {
    const l = lanes('李明远', '李国栋')
    expect(laneInitials(l)).toEqual(laneInitials(l))
  })
})
