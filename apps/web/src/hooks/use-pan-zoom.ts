import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MIN = 0.25
const MAX = 3
/** Keeps a scale between the smallest and the largest zoom. */
export const clamp = (k: number) => Math.min(MAX, Math.max(MIN, k))
/** A pointer has to travel this far (in screen px) before a press becomes a drag or a pan. */
export const DRAG_START = 4

/** The pan and scale of the drawing: screen = world * k + (x, y). */
export interface Transform { k: number; x: number; y: number }

/** Scales `v` by `factor` around the screen point (px, py), so that point stays where it is. */
export function zoomAt(v: Transform, px: number, py: number, factor: number): void {
  const k = clamp(v.k * factor)
  const f = k / v.k
  v.x = px - (px - v.x) * f
  v.y = py - (py - v.y) * f
  v.k = k
}

/** What the toolbar can do to a graph's view. The graph fills it in when it mounts. */
export interface GraphView {
  /** Scales and pans the whole drawing into the box, never above 1:1. */
  fit(): void
  /** Multiplies the scale, around the middle of the box. */
  zoomBy(factor: number): void
  /** Starts the layout over from fresh positions and fits it. */
  reset(): void
}

/**
 * Zoom state shared between a toolbar and the graph it controls: `scale` for the toolbar to show,
 * and the view actions, which reach the graph through `view`.
 */
export function useZoom() {
  const [scale, setScale] = useState(1)
  const view = useRef<GraphView | null>(null)
  return useMemo(() => ({
    scale,
    setScale,
    view,
    fit: () => view.current?.fit(),
    zoomIn: () => view.current?.zoomBy(1.25),
    zoomOut: () => view.current?.zoomBy(0.8),
    reset: () => view.current?.reset(),
  }), [scale])
}
export type Zoom = ReturnType<typeof useZoom>

type Point = { x: number; y: number }

/**
 * Pan, pinch and wheel zoom of an SVG drawing. The caller puts `box` on the element that holds
 * the SVG, `world` on the `<g>` that holds the drawing, and spreads `handlers` on the `<svg>`.
 * One pointer on the background pans once it travels `DRAG_START`; two pinch around their middle;
 * the wheel zooms around the pointer. The caller keeps `size` up to date.
 */
export function usePanZoom({ setScale, onUserMove, onPress, onTap, wheelKey }: {
  /** Gets the scale after every change of the view. */
  setScale: (k: number) => void
  /** The user panned, pinched, wheeled or zoomed by the toolbar. */
  onUserMove?: () => void
  /** A pointer went down on the background. */
  onPress?: () => void
  /** The last pointer came up from the background without a pan. */
  onTap?: () => void
  /** The wheel listener that stops the page from scrolling is attached again when this changes. */
  wheelKey?: unknown
}) {
  const box = useRef<HTMLDivElement>(null)
  const world = useRef<SVGGElement>(null)
  const view = useRef<Transform>({ k: 1, x: 0, y: 0 })
  const size = useRef({ w: 0, h: 0 })

  const applyView = useCallback(() => {
    const { k, x, y } = view.current
    world.current?.setAttribute('transform', `translate(${x} ${y}) scale(${k})`)
    setScale(k)
  }, [setScale])

  /** The point of a pointer or wheel event in the box, in screen px. */
  const local = useCallback((e: React.PointerEvent | React.WheelEvent): Point => {
    const r = box.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }, [])

  const onUserMoveRef = useRef(onUserMove)
  onUserMoveRef.current = onUserMove

  /** The toolbar's zoom: multiplies the scale around the middle of the box. */
  const zoomCentered = useCallback((factor: number) => {
    onUserMoveRef.current?.()
    const { w, h } = size.current
    zoomAt(view.current, w / 2, h / 2, factor)
    applyView()
  }, [applyView])

  // The pointers down on the background: one pans, two pinch.
  const pointers = useRef(new Map<number, Point>())
  const pan = useRef<{ sx: number; sy: number; x: number; y: number; moved: boolean; dist?: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const l = local(e)
    pointers.current.set(e.pointerId, l)
    e.currentTarget.setPointerCapture(e.pointerId)
    onPress?.()
    if (pointers.current.size === 1) {
      pan.current = { sx: l.x, sy: l.y, x: view.current.x, y: view.current.y, moved: false }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pan.current = { sx: (a.x + b.x) / 2, sy: (a.y + b.y) / 2, x: view.current.x, y: view.current.y, moved: true, dist: Math.hypot(a.x - b.x, a.y - b.y) }
    }
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = pan.current
    if (!p || !pointers.current.has(e.pointerId)) return
    const l = local(e)
    pointers.current.set(e.pointerId, l)
    if (pointers.current.size >= 2 && p.dist) {
      // A pinch: scale by how far the fingers moved apart, around their middle, and pan with the middle.
      const [a, b] = [...pointers.current.values()]
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      onUserMove?.()
      zoomAt(view.current, mx, my, dist / p.dist)
      view.current.x += mx - p.sx
      view.current.y += my - p.sy
      p.sx = mx; p.sy = my; p.dist = dist
      applyView()
      return
    }
    const dx = l.x - p.sx
    const dy = l.y - p.sy
    if (!p.moved && Math.hypot(dx, dy) < DRAG_START) return
    p.moved = true
    onUserMove?.()
    view.current = { k: view.current.k, x: p.x + dx, y: p.y + dy }
    applyView()
  }
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 1) {
      const [l] = [...pointers.current.values()]
      pan.current = { sx: l.x, sy: l.y, x: view.current.x, y: view.current.y, moved: true }
    } else if (!pointers.current.size) {
      if (pan.current && !pan.current.moved) onTap?.()
      pan.current = null
    }
  }
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const l = local(e)
    onUserMove?.()
    // A trackpad pinch arrives as a wheel with ctrlKey, and a far smaller delta than a wheel notch.
    zoomAt(view.current, l.x, l.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0012)))
    applyView()
  }
  // The browser would scroll the page on a wheel; React's listener is passive, so stop it on the element.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const stop = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', stop, { passive: false })
    return () => el.removeEventListener('wheel', stop)
  }, [wheelKey])

  return {
    box, world, view, size, applyView, local, zoomCentered,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel },
  }
}
