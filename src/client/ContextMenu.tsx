/**
 * Minimal right-click context menu (portaled to document.body).
 * Closes on outside click, right-click elsewhere, or Esc.
 */
import { createElement as h, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { JSX } from 'react'

export interface MenuItem {
  readonly key: string
  readonly label: string
  readonly danger?: boolean
  readonly onSelect: () => void
}

interface ContextMenuProps {
  readonly x: number
  readonly y: number
  readonly items: readonly MenuItem[]
  readonly onClose: () => void
}

const MENU_W = 220
const ROW_H = 30

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): JSX.Element | null {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null
  const height = items.length * ROW_H + 8
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8))
  const top = Math.max(8, Math.min(y, window.innerHeight - height - 8))
  return createPortal(
    h('div', {
      className: 'gp-ctx-backdrop',
      onClick: onClose,
      onContextMenu: (e: { preventDefault: () => void }) => { e.preventDefault(); onClose() },
    }, h('div', {
      className: 'gp-ctx', style: { left, top },
      onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
      onContextMenu: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    }, items.map((it) => h('button', {
      key: it.key, type: 'button',
      className: `gp-ctx__item${it.danger === true ? ' gp-ctx__item--danger' : ''}`,
      onClick: () => { onClose(); it.onSelect() },
    }, it.label)))),
    document.body,
  )
}

/** Best-effort clipboard copy with a legacy fallback. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through to legacy path */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
