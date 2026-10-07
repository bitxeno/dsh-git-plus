/**
 * Drag-resizable column: a persisted pixel width plus a divider element to
 * place between two flex columns. Dragging the divider adjusts the width
 * (clamped to [min, container − reserve]); the value survives remounts via
 * localStorage. Mouse/pointer only — the divider is a thin hit area with a
 * hairline center.
 */
import { createElement as h, useCallback, useEffect, useRef, useState } from 'react'
import type { JSX, RefObject } from 'react'

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

function read(key: string, fallback: number): number {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
    const n = v === null ? NaN : Number(v)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function write(key: string, n: number): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, String(Math.round(n)))
  } catch {
    /* storage unavailable — width just won't persist */
  }
}

interface ResizableOptions {
  /** localStorage key the width persists under. */
  readonly storageKey: string
  /** Initial width in px when nothing is stored. */
  readonly initial: number
  /** Minimum width in px. */
  readonly min: number
  /** Space (px) reserved for the sibling columns when computing the max. */
  readonly reserve: number
  /** Which edge of the resized column the divider sits on: 'end' = right edge
   * (drag right grows it), 'start' = left edge (drag right shrinks it). */
  readonly edge: 'start' | 'end'
}

interface ResizableRowOptions {
  /** localStorage key the staged fraction persists under (0..1). */
  readonly storageKey: string
  /** Default staged share of the panes container (0..1). */
  readonly initialFrac: number
  /** Minimum pane height in px (applies to both panes). */
  readonly min: number
}

function readFrac(key: string, fallback: number): number {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
    const n = v === null ? NaN : Number(v)
    return Number.isFinite(n) && n > 0 && n < 1 ? n : fallback
  } catch {
    return fallback
  }
}

function writeFrac(key: string, n: number): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, String(n))
  } catch {
    /* storage unavailable — frac just won't persist */
  }
}

/**
 * Drag-resizable row split: the bottom pane owns `frac` of the container
 * height, the top pane takes the rest. Dragging the divider adjusts the
 * fraction (clamped so both panes keep at least `min` px); the value survives
 * remounts via localStorage. The divider is invisible until hover/drag.
 */
export function useResizableRow(opts: ResizableRowOptions): {
  frac: number
  dividerProps: { onPointerDown: (e: { clientY: number; preventDefault: () => void }) => void }
  containerRef: RefObject<HTMLDivElement | null>
} {
  const { storageKey, initialFrac, min } = opts
  const [frac, setFrac] = useState<number>(() => readFrac(storageKey, initialFrac))
  const containerRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ y: number; frac: number; containerH: number } | null>(null)
  const fracRef = useRef(frac)
  fracRef.current = frac

  const onPointerDown = useCallback((e: { clientY: number; preventDefault: () => void }) => {
    const containerH = containerRef.current?.clientHeight ?? 0
    if (containerH <= 0) return
    drag.current = { y: e.clientY, frac: fracRef.current, containerH }
    e.preventDefault()
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const move = (ev: PointerEvent): void => {
      const s = drag.current
      if (s === null) return
      // Divider sits above the bottom pane: drag up (dy < 0) grows it.
      const deltaFrac = (s.y - ev.clientY) / s.containerH
      const lo = Math.min(0.85, s.containerH > 0 ? min / s.containerH : 0.15)
      const hi = Math.max(lo, 1 - (s.containerH > 0 ? min / s.containerH : 0.15))
      setFrac(clamp(s.frac + deltaFrac, lo, hi))
    }
    const up = (): void => {
      if (drag.current === null) return
      drag.current = null
      if (typeof document !== 'undefined') {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      writeFrac(storageKey, Math.round(fracRef.current * 1000) / 1000)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [min, storageKey])

  return { frac, dividerProps: { onPointerDown }, containerRef }
}

/** Returns the current column width and the divider element to render. */
export function useResizableColumn(opts: ResizableOptions): { width: number; divider: JSX.Element } {
  const { storageKey, initial, min, reserve, edge } = opts
  const [width, setWidth] = useState<number>(() => read(storageKey, initial))
  const ref = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ x: number; w: number; max: number } | null>(null)

  const onPointerDown = useCallback((e: { clientX: number; preventDefault: () => void }) => {
    const container = ref.current?.parentElement
    const cw = container?.clientWidth ?? Number.MAX_SAFE_INTEGER
    drag.current = { x: e.clientX, w: width, max: Math.max(min, cw - reserve) }
    e.preventDefault()
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
  }, [width, min, reserve])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const move = (ev: PointerEvent): void => {
      const s = drag.current
      if (s === null) return
      const dx = ev.clientX - s.x
      setWidth(clamp(s.w + (edge === 'end' ? dx : -dx), min, s.max))
    }
    const up = (): void => {
      if (drag.current === null) return
      drag.current = null
      if (typeof document !== 'undefined') {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      setWidth((w) => { write(storageKey, w); return w })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [edge, min, storageKey])

  const divider = h('div', {
    key: `rz-${storageKey}`,
    ref,
    className: 'gp-resizer',
    role: 'separator',
    'aria-orientation': 'vertical',
    onPointerDown,
  })
  return { width, divider }
}
