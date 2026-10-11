/**
 * Width-driven responsive switch, measured on an element instead of the
 * viewport. The panel is a nested surface: a media query would only ever see
 * the viewport, so a phone in a split view, an OS display scale, or a host
 * right sidebar would all disagree with what the panel actually has. Measuring
 * the element keeps the breakpoint honest for a narrow desktop window too.
 */
import { useEffect, useState } from 'react'

/**
 * Observe an element's width; true once it is measured and below `min`.
 * A width of 0 (not yet laid out, or display:none) never counts as narrow, so
 * the first paint before measurement always takes the wide branch.
 */
export function useNarrow(el: HTMLElement | null, min: number): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (el === null || typeof ResizeObserver === 'undefined') return
    const measure = (): void => { setNarrow(el.clientWidth > 0 && el.clientWidth < min) }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => { ro.disconnect() }
  }, [el, min])
  return narrow
}
