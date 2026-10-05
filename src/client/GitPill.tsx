/**
 * Composer tool-row Git entry (conversation.input.left, next to the
 * mode/access-mode selector) — same design as dsh-git-manager:
 * a transparent 28px tool button with a Lucide git-branch icon + the branch
 * name only (no repo name, no status colours). Shown only inside a git repo;
 * click opens the Git Plus panel (toggles back when already active).
 */
import { createElement as h, useEffect, useRef } from 'react'
import type { JSX } from 'react'
import { useGitView } from './registry'
import { hasSession } from './rpc'
import { activateGitTab, isGitTabActive, requestSubTab, returnToConversation } from './jump'
import { setGitTabDot, clearGitTabDot, type GitTabDotStatus } from './tab-dot'
import type { GitKey } from './locales'

interface PillProps {
  readonly sessionId?: string
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
}

/** Lucide git-branch icon (24×24), same paths as dsh-git-manager. */
function BranchGlyph(): JSX.Element {
  return h('svg', {
    width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true,
  }, [
    h('path', { key: 'a', d: 'M6 3v12' }),
    h('circle', { key: 'b', cx: 18, cy: 6, r: 3 }),
    h('circle', { key: 'c', cx: 6, cy: 18, r: 3 }),
    h('path', { key: 'd', d: 'M18 9a9 9 0 0 1-9 9' }),
  ])
}

export function GitPill({ sessionId, t }: PillProps): JSX.Element | null {
  const view = useGitView(sessionId)
  const dotOwner = useRef(Symbol('gp-tab-dot'))

  const dotStatus: GitTabDotStatus =
    view.state === 'ready' && view.snapshot.showInputPill === false
      ? (view.snapshot.dirty ? 'dirty' : 'synced')
      : null
  const label = t('panel.tab')
  useEffect(() => {
    setGitTabDot(dotOwner.current, label, dotStatus)
    const owner = dotOwner.current
    return () => { clearGitTabDot(owner) }
  }, [label, dotStatus])

  if (view.state === 'cold' || view.state === 'loading' || view.state === 'no-cwd') return null
  if (view.state === 'error') return null
  const snap = view.snapshot
  if (snap.showInputPill === false) return null

  const branch = snap.branch ?? snap.head ?? t('pill.detached')
  const dirty = snap.dirty || (snap.conflictFiles?.length ?? 0) > 0 || snap.operation !== null

  const onClick = (): void => {
    if (isGitTabActive(label)) { returnToConversation(label); return }
    if (hasSession(sessionId)) {
      requestSubTab(sessionId, dirty ? 'local' : 'commits')
    }
    activateGitTab(label)
  }

  return h('button', {
    type: 'button', className: 'gp-toolbtn',
    title: `Git Plus\n${snap.root}`,
    'aria-label': t('panel.tab'),
    onClick,
  }, [
    h(BranchGlyph, { key: 'i' }),
    branch ? h('span', { key: 'l', className: 'gp-toolbtn-label' }, branch) : null,
  ])
}
