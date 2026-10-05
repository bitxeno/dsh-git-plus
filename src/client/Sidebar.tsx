/**
 * dsh-git-plus sidebar: top nav (Local Changes / All Commits), a fetch/pull/
 * push sync toolbar, and collapsible groups (Branches / Remotes / Tags /
 * Stashes). Clicking a branch/tag filters All Commits; row actions live in a
 * right-click menu; double-click a branch to check it out, double-click a tag
 * to confirm-checkout its code.
 */
import { createElement as h, useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { queryAs, type GitPanelRemote } from './rpc'
import type { GitAction, GitBranch, GitSnapshot, StashEntry } from './types'
import type { GitKey } from './locales'
import type { SubTab } from './jump'
import { BranchIcon, ChevronIcon, CommitIcon, FetchIcon, PullIcon, PushIcon, RefreshIcon, TagIcon } from './icons'
import { ContextMenu, copyText, type MenuItem } from './ContextMenu'

export interface SidebarSelection {
  readonly view: SubTab
  readonly refFilter: string | null
}

interface SidebarProps {
  readonly remote: GitPanelRemote
  readonly sessionId: string
  readonly snapshot: GitSnapshot
  readonly selection: SidebarSelection
  readonly onSelect: (sel: SidebarSelection) => void
  readonly onAction: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
  readonly onOpenModal: (modal: 'branch' | 'tag' | 'merge' | 'stash' | 'fetch' | 'pull' | 'push', preset?: string) => void
  readonly onCheckoutRef: (ref: string, subject: string) => void
  readonly onDeleteRef: (kind: 'branch' | 'tag', name: string) => void
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
}

interface BranchTree {
  current: string | null
  local: readonly GitBranch[]
  remote: readonly GitBranch[]
  tags: readonly GitBranch[]
  stashes: readonly StashEntry[]
}

const CLOSED_KEY = 'gp.plus.sidebar.closed'
const WIDTH_KEY = 'gp.plus.sidebar.width'

function readClosed(): Set<string> {
  try {
    const raw = localStorage.getItem(CLOSED_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

type RowMenu =
  | { readonly x: number; readonly y: number; readonly kind: 'branch'; readonly name: string; readonly current: boolean }
  | { readonly x: number; readonly y: number; readonly kind: 'tag'; readonly name: string }
  | { readonly x: number; readonly y: number; readonly kind: 'stash-create' }

export function Sidebar(props: SidebarProps): JSX.Element {
  const { remote, sessionId, snapshot, selection, onSelect, onAction, onOpenModal, onCheckoutRef, onDeleteRef, t } = props
  const [tree, setTree] = useState<BranchTree | null>(null)
  const [error, setError] = useState(false)
  const [closed, setClosed] = useState<ReadonlySet<string>>(readClosed)
  const [menu, setMenu] = useState<RowMenu | null>(null)
  const [armedStashDrop, setArmedStashDrop] = useState<number | null>(null)
  // Manual list refresh (branches/tags/stashes re-query; picks up external
  // branch deletes without waiting for the next snapshot poll).
  const [reloadSeq, setReloadSeq] = useState(0)
  const refreshKey = snapshot.checkedAt

  useEffect(() => {
    let alive = true
    void (async () => {
      const [bRes, tRes, sRes] = await Promise.all([
        remote.query({ sessionId, query: { kind: 'branches' } }),
        remote.query({ sessionId, query: { kind: 'tags' } }),
        remote.query({ sessionId, query: { kind: 'stash-list' } }),
      ])
      if (!alive) return
      const b = queryAs(bRes, 'branches')
      if (b === null) { setError(true); return }
      const tg = queryAs(tRes, 'tags')
      const st = queryAs(sRes, 'stash-list')
      setError(false)
      setTree({ current: b.current, local: b.local, remote: b.remote, tags: tg?.tags ?? [], stashes: st?.stashes ?? [] })
    })()
    return () => { alive = false }
  }, [remote, sessionId, refreshKey, reloadSeq])

  const toggleClosed = (key: string): void => {
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try { localStorage.setItem(CLOSED_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const local = useMemo(() => tree?.local ?? [], [tree])
  const tags = useMemo(() => tree?.tags ?? [], [tree])
  const stashes = useMemo(() => tree?.stashes ?? [], [tree])

  const run = async (action: GitAction): Promise<void> => { await onAction(action) }

  const changeCount = snapshot.staged + snapshot.modified + snapshot.untracked
  // Detached HEAD: surface a HEAD pseudo-entry above the branches (like the
  // reference layout); clicking it filters history to HEAD, clicking again
  // clears back to all commits.
  const headActive = selection.view === 'commits' && selection.refFilter === 'HEAD'
  const headRows = snapshot.branch === null && snapshot.head !== null
    ? [h('div', {
      key: 'head-row',
      className: `gp-branch-row${headActive ? ' gp-branch-row--active' : ''}`,
      title: snapshot.head,
      onClick: () => onSelect({ view: 'commits', refFilter: headActive ? null : 'HEAD' }),
    }, [
      h('span', { key: 'i', className: 'gp-row-icon' }, h(CommitIcon, { size: 13 })),
      h('span', { key: 'n', className: 'gp-tree-name', style: { fontWeight: 700 } }, 'HEAD'),
      h('span', { key: 'h', className: 'gp-branch-row__track' }, snapshot.head),
    ])]
    : []
  const branchRows = [...headRows, ...local.map((b) => renderBranchRow(b, tree?.current ?? null, selection, {
    onSelect,
    onCheckout: () => void run({ kind: 'branch-checkout', name: b.name }),
    onMenu: (x, y) => setMenu({ x, y, kind: 'branch', name: b.name, current: b.name === tree?.current }),
    t,
  }))]
  const tagRows = tags.map((b) => renderTagRow(b, selection.view === 'commits' && selection.refFilter === b.name, {
    onSelect,
    onCheckout: () => onCheckoutRef(b.name, ''),
    onMenu: (x, y) => setMenu({ x, y, kind: 'tag', name: b.name }),
  }))
  const stashRows = stashes.map((s) => renderStashRow(s, t, run, armedStashDrop === s.index, {
    onArm: () => setArmedStashDrop(s.index),
    onDrop: () => { setArmedStashDrop(null); void run({ kind: 'stash-drop', index: s.index }) },
  }))
  const remoteRows = (tree?.remote ?? []).slice(0, 50).map((b) =>
    h('div', { key: `r-${b.name}`, className: 'gp-branch-row', title: b.name }, [
      h('span', { key: 'i', className: 'gp-row-icon' }, h(BranchIcon, { size: 13 })),
      h('span', { key: 'n', className: 'gp-tree-name' }, b.name),
    ]),
  )

  const menuItems: readonly MenuItem[] = menu === null ? [] : menu.kind === 'stash-create'
    ? [
      { key: 'ns', label: t('side.newStash'), onSelect: () => onOpenModal('stash') },
    ]
    : menu.kind === 'branch'
    ? [
      ...(menu.current ? [] : [{
        key: 'co', label: t('side.checkout'),
        onSelect: () => void run({ kind: 'branch-checkout', name: menu.name }),
      }]),
      ...(menu.current ? [] : [{
        key: 'mg', label: t('side.merge'),
        onSelect: () => onOpenModal('merge', menu.name),
      }]),
      {
        key: 'nb', label: t('menu.createBranchAt'),
        onSelect: () => onOpenModal('branch', menu.name),
      },
      {
        key: 'nt', label: t('menu.createTagAt'),
        onSelect: () => onOpenModal('tag', menu.name),
      },
      { key: 'cp', label: t('menu.copyBranchName'), onSelect: () => void copyText(menu.name) },
      ...(menu.current ? [] : [{
        key: 'del', label: t('side.delete'), danger: true,
        onSelect: () => onDeleteRef('branch', (menu as { name: string }).name),
      }]),
    ]
    : [
      { key: 'co', label: t('menu.checkoutTag'), onSelect: () => onCheckoutRef(menu.name, '') },
      {
        key: 'nb', label: t('menu.createBranchAt'),
        onSelect: () => onOpenModal('branch', menu.name),
      },
      {
        key: 'nt', label: t('menu.createTagAt'),
        onSelect: () => onOpenModal('tag', menu.name),
      },
      { key: 'cp', label: t('menu.copyTagName'), onSelect: () => void copyText(menu.name) },
      {
        key: 'del', label: t('side.delete'), danger: true,
        onSelect: () => onDeleteRef('tag', (menu as { name: string }).name),
      },
    ]

  return h('div', { className: 'gp-side' }, [
    h('div', { key: 'top', className: 'gp-side__top' }, [
      h('button', {
        key: 'local', type: 'button',
        className: `gp-side__nav${selection.view === 'local' ? ' gp-side__nav--active' : ''}`,
        onClick: () => onSelect({ view: 'local', refFilter: null }),
      }, [
        h('span', { key: 'l' }, t('side.local')),
        changeCount > 0 ? h('span', { key: 'b', className: 'gp-side__badge' }, String(changeCount)) : null,
      ]),
      h('button', {
        key: 'commits', type: 'button',
        className: `gp-side__nav${selection.view === 'commits' ? ' gp-side__nav--active' : ''}`,
        onClick: () => onSelect({ view: 'commits', refFilter: selection.refFilter }),
      }, t('side.commits')),
    ]),
    h('div', { key: 'net', className: 'gp-side__net' }, [
      h('button', { key: 'fetch', type: 'button', title: t('side.fetch'), onClick: () => onOpenModal('fetch') }, h(FetchIcon, { size: 15 })),
      h('button', { key: 'pull', type: 'button', title: t('side.pull'), onClick: () => onOpenModal('pull') }, h(PullIcon, { size: 15 })),
      h('button', { key: 'push', type: 'button', title: t('side.push'), onClick: () => onOpenModal('push') }, h(PushIcon, { size: 15 })),
    ]),
    error ? h('div', { key: 'err', className: 'gp-side__error' }, t('overview.branchesError')) : null,
    h(Group, {
      key: 'branches', title: t('side.branches'), count: local.length, open: !closed.has('branches'),
      onToggle: () => toggleClosed('branches'),
      actions: h('button', { type: 'button', title: t('side.refresh'), onClick: () => setReloadSeq((n) => n + 1) }, h(RefreshIcon, { size: 15 })),
      children: branchRows,
    }),
    h(Group, {
      key: 'tags', title: t('side.tags'), count: tags.length, open: !closed.has('tags'),
      onToggle: () => toggleClosed('tags'),
      actions: null,
      children: tagRows,
    }),
    h(Group, {
      key: 'stashes', title: t('side.stashes'), count: snapshot.stashCount, open: !closed.has('stashes'),
      onToggle: () => toggleClosed('stashes'),
      onMenu: (x, y) => setMenu({ x, y, kind: 'stash-create' }),
      actions: null,
      children: stashRows,
    }),
    h(Group, {
      key: 'remotes', title: t('side.remotes'), count: (tree?.remote ?? []).length, open: !closed.has('remotes'),
      onToggle: () => toggleClosed('remotes'), actions: null,
      children: remoteRows,
    }),
    menu !== null ? h(ContextMenu, { key: 'menu', x: menu.x, y: menu.y, items: menuItems, onClose: () => setMenu(null) }) : null,
  ])
}

interface BranchRowCbs {
  readonly onSelect: SidebarProps['onSelect']
  readonly onCheckout: () => void
  readonly onMenu: (x: number, y: number) => void
  readonly t: SidebarProps['t']
}

function renderBranchRow(b: GitBranch, current: string | null, selection: SidebarSelection, cb: BranchRowCbs): JSX.Element {
  const isCurrent = b.name === current
  const active = selection.view === 'commits' && selection.refFilter === b.name
  const cls = `gp-branch-row${active ? ' gp-branch-row--active' : ''}${isCurrent ? ' gp-branch-row--current' : ''}`
  // Offline remote check (host): `false` means no remote-tracking ref backs this
  // branch. The icon dims and the tooltip explains why; `undefined` (unknown)
  // renders normally so a remote-less repo never looks uniformly greyed.
  const localOnly = b.onRemote === false
  const title = `${b.name}${b.shortHash ? ` (${b.shortHash})` : ''}${localOnly ? ` — ${cb.t('side.localOnly')}` : ''}`
  return h('div', {
    key: `b-${b.name}`, className: cls, title,
    onClick: () => cb.onSelect({ view: 'commits', refFilter: active ? null : b.name }),
    onDoubleClick: () => { if (!isCurrent) cb.onCheckout() },
    onContextMenu: (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => { e.preventDefault(); e.stopPropagation(); cb.onMenu(e.clientX, e.clientY) },
  }, [
    h('span', {
      key: 'i',
      className: `gp-row-icon${localOnly ? ' gp-row-icon--local-only' : ''}`,
      title: localOnly ? cb.t('side.localOnly') : undefined,
    }, h(BranchIcon, { size: 13 })),
    h('span', { key: 'n', className: 'gp-tree-name' }, b.name),
    (b.ahead || b.behind) ? h('span', { key: 't', className: 'gp-branch-row__track' }, `${b.ahead ? `↑${b.ahead}` : ''}${b.behind ? `↓${b.behind}` : ''}`) : null,
  ])
}

interface TagRowCbs {
  readonly onSelect: SidebarProps['onSelect']
  readonly onCheckout: () => void
  readonly onMenu: (x: number, y: number) => void
}

function renderTagRow(b: GitBranch, isActive: boolean, cb: TagRowCbs): JSX.Element {
  return h('div', {
    key: `t-${b.name}`, className: `gp-branch-row${isActive ? ' gp-branch-row--active' : ''}`, title: b.name,
    onClick: () => cb.onSelect({ view: 'commits', refFilter: isActive ? null : b.name }),
    onDoubleClick: () => cb.onCheckout(),
    onContextMenu: (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => { e.preventDefault(); e.stopPropagation(); cb.onMenu(e.clientX, e.clientY) },
  }, [
    h('span', { key: 'i', className: 'gp-row-icon' }, h(TagIcon, { size: 13 })),
    h('span', { key: 'n', className: 'gp-tree-name' }, b.name),
  ])
}

function renderStashRow(
  s: StashEntry,
  t: SidebarProps['t'],
  run: (action: GitAction) => Promise<void>,
  armed: boolean,
  cb: { readonly onArm: () => void; readonly onDrop: () => void },
): JSX.Element {
  return h('div', { key: `s-${s.index}`, className: 'gp-branch-row', title: s.message }, [
    h('span', { key: 'i', className: 'gp-row-icon' }, h(TagIcon, { size: 13 })),
    h('span', { key: 'n', className: 'gp-tree-name' }, `stash@{${s.index}} ${s.message}`),
    h('span', { key: 'ops', className: 'gp-side__ops' }, [
      h('button', { key: 'ap', type: 'button', title: t('side.apply'), onClick: () => void run({ kind: 'stash-apply', index: s.index }) }, '⤓'),
      h('button', { key: 'pp', type: 'button', title: t('side.pop'), onClick: () => void run({ kind: 'stash-pop', index: s.index }) }, '⤒'),
      armed
        ? h('button', { key: 'dr2', type: 'button', className: 'gp-side__danger', title: t('side.drop'), onClick: cb.onDrop }, '✓')
        : h('button', { key: 'dr', type: 'button', title: t('side.drop'), onClick: cb.onArm }, '×'),
    ]),
  ])
}

function Group(props: {
  readonly title: string
  readonly count?: number
  readonly open: boolean
  readonly onToggle: () => void
  readonly onMenu?: (x: number, y: number) => void
  readonly actions: JSX.Element | null
  readonly children: readonly (JSX.Element | null)[]
}): JSX.Element {
  return h('div', { className: 'gp-branch-group' }, [
    h('div', {
      key: 'h', className: 'gp-branch-group__head', onClick: props.onToggle,
      ...(props.onMenu !== undefined ? {
        onContextMenu: (e: { preventDefault: () => void; clientX: number; clientY: number }) => {
          e.preventDefault()
          props.onMenu!(e.clientX, e.clientY)
        },
      } : {}),
    }, [
      h(ChevronIcon, { key: 'c', size: 11, open: props.open }),
      `${props.title}${props.count !== undefined ? ` (${props.count})` : ''}`,
      props.actions !== null ? h('span', { key: 'a', className: 'gp-side__hact', onClick: (e: { stopPropagation: () => void }) => e.stopPropagation() }, props.actions) : null,
    ]),
    props.open ? h('div', { key: 'b' }, props.children) : null,
  ])
}

export function readSidebarWidth(): number {
  try {
    const v = Number(localStorage.getItem(WIDTH_KEY))
    if (Number.isFinite(v) && v >= 200 && v <= 480) return v
  } catch { /* ignore */ }
  return 260
}

export function writeSidebarWidth(width: number): void {
  try { localStorage.setItem(WIDTH_KEY, String(width)) } catch { /* ignore */ }
}

export { WIDTH_KEY }
