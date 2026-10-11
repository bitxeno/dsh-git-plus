/**
 * dsh-git-plus sidebar: top nav (Local Changes / All Commits), a fetch/pull/
 * push sync toolbar, and collapsible groups (Branches / Remotes / Tags /
 * Stashes). The local default branch pins to the top of Branches; slash-separated
 * names fold into collapsible folders, and Remotes groups by remote name with
 * a per-endpoint icon (GitHub mark vs branch glyph) and keeps the remote's
 * default branch first inside its own folder. Clicking a branch/tag filters All
 * Commits; row actions live in a right-click menu; double-click a branch to
 * check it out, double-click a tag to confirm-checkout its code.
 */
import { createElement as h, useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { queryAs, type GitPanelRemote } from './rpc'
import type { GitAction, GitBranch, GitSnapshot, StashEntry } from './types'
import type { GitKey } from './locales'
import type { SubTab } from './jump'
import { BranchIcon, ChevronIcon, CommitIcon, FetchIcon, FolderIcon, GitHubIcon, PullIcon, PushIcon, RefreshIcon, TagIcon } from './icons'
import { ContextMenu, copyText, type MenuItem } from './ContextMenu'
import { Tip } from './Tip'
import { isGitHubRemote } from './avatar'
import { buildBranchFolderTree, splitDefaultBranch, type BranchTreeNode } from './branch-groups'

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
  readonly onOpenModal: (modal: 'branch' | 'tag' | 'merge' | 'stash' | 'fetch' | 'pull' | 'push' | 'track', preset?: string, localNames?: readonly string[]) => void
  readonly onCheckoutRef: (ref: string, subject: string) => void
  readonly onDeleteRef: (kind: 'branch' | 'tag' | 'remote-branch', name: string, opts?: { readonly remote?: string | null; readonly remoteIsGitHub?: boolean }) => void
  readonly onPushBranch: (branch: string, remote: string) => void
  readonly onPushTag: (tag: string, remote: string) => void
  readonly onRenameBranch: (oldName: string) => void
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
}

interface BranchTree {
  current: string | null
  defaultBranch: string | null
  local: readonly GitBranch[]
  remote: readonly GitBranch[]
  /** Configured remote names (`git remote`), for push targets. */
  remotes: readonly string[]
  /** Fetch URL per remote (`git remote -v`), for per-remote icons. */
  remoteUrls: Record<string, string>
  tags: readonly GitBranch[]
  stashes: readonly StashEntry[]
}

const CLOSED_KEY = 'gp.plus.sidebar.closed'
const FOLDER_OPEN_KEY = 'gp.plus.sidebar.folders.open'
/** Previous closed-set key (default-expanded); kept for one-time cleanup. */
const FOLDER_CLOSED_KEY_LEGACY = 'gp.plus.sidebar.folders.closed'
const WIDTH_KEY = 'gp.plus.sidebar.width'

/** Groups collapsed on first open; Branches stays expanded. */
const DEFAULT_CLOSED = ['tags', 'stashes', 'remotes']

function readClosed(): Set<string> {
  try {
    const raw = localStorage.getItem(CLOSED_KEY)
    if (!raw) return new Set(DEFAULT_CLOSED)
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set(DEFAULT_CLOSED)
  }
}

function readFolderOpen(): Set<string> {
  try {
    const raw = localStorage.getItem(FOLDER_OPEN_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

type RowMenu =
  | { readonly x: number; readonly y: number; readonly kind: 'branch'; readonly name: string; readonly current: boolean }
  | { readonly x: number; readonly y: number; readonly kind: 'remote'; readonly name: string }
  | { readonly x: number; readonly y: number; readonly kind: 'tag'; readonly name: string }
  | { readonly x: number; readonly y: number; readonly kind: 'stash-create' }

export function Sidebar(props: SidebarProps): JSX.Element {
  const { remote, sessionId, snapshot, selection, onSelect, onAction, onOpenModal, onCheckoutRef, onDeleteRef, onPushBranch, onPushTag, onRenameBranch, t } = props
  const [tree, setTree] = useState<BranchTree | null>(null)
  const [error, setError] = useState(false)
  const [closed, setClosed] = useState<ReadonlySet<string>>(readClosed)
  // Branch folders default to collapsed; only explicitly expanded paths are
  // stored. (Legacy `folders.closed` defaulted to expanded and is ignored.)
  const [folderOpen, setFolderOpen] = useState<ReadonlySet<string>>(readFolderOpen)
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
      setTree({
        current: b.current,
        defaultBranch: b.defaultBranch ?? null,
        local: b.local,
        remote: b.remote,
        remotes: b.remotes ?? [...new Set(b.remote.map((r) => r.name.split('/')[0] ?? ''))].filter((r) => r !== ''),
        remoteUrls: b.remoteUrls ?? {},
        tags: tg?.tags ?? [],
        stashes: st?.stashes ?? [],
      })
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

  const toggleFolder = (path: string): void => {
    setFolderOpen((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      try {
        localStorage.setItem(FOLDER_OPEN_KEY, JSON.stringify([...next]))
        localStorage.removeItem(FOLDER_CLOSED_KEY_LEGACY)
      } catch { /* ignore */ }
      return next
    })
  }

  const local = useMemo(() => tree?.local ?? [], [tree])
  const tags = useMemo(() => tree?.tags ?? [], [tree])
  const stashes = useMemo(() => tree?.stashes ?? [], [tree])
  // Default branch pins to the top; `/`-separated names fold into folders.
  const { pinnedDefault, branchNodes } = useMemo(() => {
    const { pinned, rest } = splitDefaultBranch(local, tree?.defaultBranch ?? null)
    return { pinnedDefault: pinned, branchNodes: buildBranchFolderTree(rest) }
  }, [local, tree])

  const run = async (action: GitAction): Promise<void> => { await onAction(action) }

  const pushRemote = (tree?.remotes.includes('origin') ?? false) ? 'origin' : tree?.remotes[0]

  const branchRowCbsFor = (name: string): BranchRowCbs => ({
    onSelect,
    onCheckout: () => void run({ kind: 'branch-checkout', name }),
    onMenu: (x, y) => setMenu({ x, y, kind: 'branch', name, current: name === tree?.current }),
    t,
  })

  // Remote counterpart for the delete dialog's "also delete remote" checkbox:
  // the configured upstream's remote when it is still known, else the push
  // target when the branch is backed by some remote. Null for local-only.
  const deleteRemoteFor = (name: string): { remote: string; remoteIsGitHub: boolean } | null => {
    const known = tree?.remotes ?? []
    const branch = local.find((b) => b.name === name)
    const upSeg = branch?.upstream?.split('/') ?? []
    const upRemote = upSeg.length > 1 && known.includes(upSeg[0]!) ? upSeg[0]! : null
    const remote = upRemote ?? (branch?.onRemote === true && pushRemote !== undefined ? pushRemote : null)
    if (remote === null) return null
    return { remote, remoteIsGitHub: isGitHubRemote(tree?.remoteUrls[remote] ?? '') }
  }

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
  const pinnedRows = pinnedDefault !== null
    ? [renderBranchRow(pinnedDefault, tree?.current ?? null, selection, branchRowCbsFor(pinnedDefault.name), {
      displayName: pinnedDefault.name,
      depth: 0,
      isDefault: true,
    })]
    : []
  const groupedRows = renderBranchNodes(branchNodes, {
    current: tree?.current ?? null,
    selection,
    folderOpen,
    onToggleFolder: toggleFolder,
    cbsFor: branchRowCbsFor,
  })
  const branchRows = [...headRows, ...pinnedRows, ...groupedRows]
  const tagRows = tags.map((b) => renderTagRow(b, selection.view === 'commits' && selection.refFilter === b.name, {
    onSelect,
    onCheckout: () => onCheckoutRef(b.name, ''),
    onMenu: (x, y) => setMenu({ x, y, kind: 'tag', name: b.name }),
  }))
  const stashRows = stashes.map((s) => renderStashRow(s, t, run, armedStashDrop === s.index, {
    onArm: () => setArmedStashDrop(s.index),
    onDrop: () => { setArmedStashDrop(null); void run({ kind: 'stash-drop', index: s.index }) },
  }))
  // Remote-tracking refs grouped by remote name (`origin/main` → folder
  // `origin`), same folder component as local branches. Keys are prefixed so
  // they never collide with local folders in the shared collapsed set. Unlike
  // local branches, the default branch is *not* hoisted out of its remote: it
  // stays inside the `origin` folder, leading it, so the folder keeps owning
  // all of its refs (and the row carries the "default" badge).
  const { remoteNodes } = useMemo(() => {
    const flat = (tree?.remote ?? []).slice(0, 50)
    const primary = (tree?.remotes.includes('origin') ?? false) ? 'origin' : tree?.remotes[0]
    const defName = tree?.defaultBranch != null && primary !== undefined ? `${primary}/${tree.defaultBranch}` : null
    return { remoteNodes: buildBranchFolderTree(flat, { pinnedRef: defName }) }
  }, [tree])
  const remoteLeafCbsFor = (name: string): BranchRowCbs => ({
    onSelect,
    // Double-click opens the Track dialog (create a local tracking branch);
    // explicit detached checkout stays in the right-click menu.
    onCheckout: () => onOpenModal('track', name, local.map((b) => b.name)),
    onMenu: (x, y) => setMenu({ x, y, kind: 'remote', name }),
    t,
  })
  const remoteRows = renderRemoteNodes(remoteNodes, {
    folderOpen,
    onToggleFolder: toggleFolder,
    remoteUrls: tree?.remoteUrls ?? {},
    knownRemotes: tree?.remotes ?? [],
    selection,
    leafCbsFor: remoteLeafCbsFor,
  })
  const sep = (key: string): MenuItem => ({ key, separator: true })
  const menuItems: readonly MenuItem[] = menu === null ? [] : menu.kind === 'stash-create'
    ? [
      { key: 'ns', label: t('side.newStash'), onSelect: () => onOpenModal('stash') },
    ]
    : menu.kind === 'branch'
    ? [
      ...(menu.current ? [] : [
        {
          key: 'co', label: t('side.checkout'),
          onSelect: () => void run({ kind: 'branch-checkout', name: (menu as { name: string }).name }),
        },
        sep('s1'),
      ]),
      ...(pushRemote !== undefined ? [{
        key: 'push', label: t('menu.pushTo', { remote: pushRemote }),
        onSelect: () => onPushBranch((menu as { name: string }).name, pushRemote),
      }] : []),
      ...(menu.current ? [] : [{
        key: 'mg', label: t('side.merge'),
        onSelect: () => onOpenModal('merge', (menu as { name: string }).name),
      }]),
      sep('s2'),
      {
        key: 'nb', label: t('menu.createBranchAt'),
        onSelect: () => onOpenModal('branch', (menu as { name: string }).name),
      },
      {
        key: 'nt', label: t('menu.createTagAt'),
        onSelect: () => onOpenModal('tag', (menu as { name: string }).name),
      },
      sep('s3'),
      {
        key: 'rn', label: t('menu.rename'),
        onSelect: () => onRenameBranch((menu as { name: string }).name),
      },
      { key: 'cp', label: t('menu.copyBranchName'), onSelect: () => void copyText((menu as { name: string }).name) },
      ...(menu.current ? [] : [{
        key: 'del', label: t('side.delete'), danger: true,
        onSelect: () => {
          const delName = (menu as { name: string }).name
          const delRemote = deleteRemoteFor(delName)
          onDeleteRef('branch', delName, delRemote ?? undefined)
        },
      }]),
    ]
    : menu.kind === 'remote'
    ? [
      { key: 'co', label: t('menu.checkoutRemote'), onSelect: () => onCheckoutRef(menu.name, '') },
      sep('s1'),
      {
        key: 'mg', label: t('side.merge'),
        onSelect: () => onOpenModal('merge', menu.name),
      },
      sep('s2'),
      {
        key: 'nb', label: t('menu.createBranchAt'),
        onSelect: () => onOpenModal('branch', menu.name),
      },
      {
        key: 'nt', label: t('menu.createTagAt'),
        onSelect: () => onOpenModal('tag', menu.name),
      },
      sep('s3'),
      { key: 'cp', label: t('menu.copyBranchName'), onSelect: () => void copyText(menu.name) },
      {
        key: 'del', label: t('side.delete'), danger: true,
        onSelect: () => onDeleteRef('remote-branch', (menu as { name: string }).name),
      },
    ]
    : [
      { key: 'co', label: t('menu.checkoutTag'), onSelect: () => onCheckoutRef(menu.name, '') },
      sep('s1'),
      ...(pushRemote !== undefined ? [{
        key: 'push', label: t('menu.pushTo', { remote: pushRemote }),
        onSelect: () => onPushTag((menu as { name: string }).name, pushRemote),
      }] : []),
      sep('s2'),
      {
        key: 'nb', label: t('menu.createBranchAt'),
        onSelect: () => onOpenModal('branch', menu.name),
      },
      {
        key: 'nt', label: t('menu.createTagAt'),
        onSelect: () => onOpenModal('tag', menu.name),
      },
      sep('s3'),
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
      h(Tip, {
        key: 'fetch', label: t('side.fetch'),
        children: h('button', { type: 'button', onClick: () => onOpenModal('fetch') }, h(FetchIcon, { size: 15 })),
      }),
      h(Tip, {
        key: 'pull', label: t('side.pull'),
        children: h('button', { type: 'button', onClick: () => onOpenModal('pull') }, h(PullIcon, { size: 15 })),
      }),
      h(Tip, {
        key: 'push', label: t('side.push'),
        children: h('button', { type: 'button', onClick: () => onOpenModal('push') }, h(PushIcon, { size: 15 })),
      }),
    ]),
    error ? h('div', { key: 'err', className: 'gp-side__error' }, t('overview.branchesError')) : null,
    h(Group, {
      key: 'branches', title: t('side.branches'), count: local.length, open: !closed.has('branches'),
      onToggle: () => toggleClosed('branches'),
      actions: h(Tip, {
        label: t('side.refresh'),
        children: h('button', { type: 'button', onClick: () => setReloadSeq((n) => n + 1) }, h(RefreshIcon, { size: 15 })),
      }),
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

function renderBranchRow(
  b: GitBranch,
  current: string | null,
  selection: SidebarSelection,
  cb: BranchRowCbs,
  opts?: { readonly displayName?: string; readonly depth?: number; readonly isDefault?: boolean },
): JSX.Element {
  const isCurrent = b.name === current
  const active = selection.view === 'commits' && selection.refFilter === b.name
  const cls = `gp-branch-row${active ? ' gp-branch-row--active' : ''}${isCurrent ? ' gp-branch-row--current' : ''}`
  // Offline remote check (host): `false` means no remote-tracking ref backs this
  // branch. The icon dims and the tooltip explains why; `undefined` (unknown)
  // renders normally so a remote-less repo never looks uniformly greyed.
  const localOnly = b.onRemote === false
  const displayName = opts?.displayName ?? b.name
  const depth = opts?.depth ?? 0
  const isDefault = opts?.isDefault === true
  const title = `${b.name}${b.shortHash ? ` (${b.shortHash})` : ''}${isDefault ? ` — ${cb.t('side.default')}` : ''}${localOnly ? ` — ${cb.t('side.localOnly')}` : ''}`
  return h('div', {
    key: `b-${b.name}`, className: cls, title,
    ...(depth > 0 ? { style: { paddingLeft: 22 + depth * 14 } } : {}),
    onClick: () => cb.onSelect({ view: 'commits', refFilter: active ? null : b.name }),
    onDoubleClick: () => { if (!isCurrent) cb.onCheckout() },
    onContextMenu: (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => { e.preventDefault(); e.stopPropagation(); cb.onMenu(e.clientX, e.clientY) },
  }, [
    h('span', {
      key: 'i',
      className: `gp-row-icon${localOnly ? ' gp-row-icon--local-only' : ''}`,
      title: localOnly ? cb.t('side.localOnly') : undefined,
    }, h(BranchIcon, { size: 13 })),
    h('span', { key: 'n', className: 'gp-tree-name' }, displayName),
    isDefault ? h('span', { key: 'd', className: 'gp-branch-row__default' }, cb.t('side.default')) : null,
    (b.ahead || b.behind) ? h('span', { key: 't', className: 'gp-branch-row__track' }, `${b.ahead ? `↑${b.ahead}` : ''}${b.behind ? `↓${b.behind}` : ''}`) : null,
  ])
}

function renderBranchNodes(
  nodes: readonly BranchTreeNode[],
  ctx: {
    readonly current: string | null
    readonly selection: SidebarSelection
    readonly folderOpen: ReadonlySet<string>
    readonly onToggleFolder: (path: string) => void
    readonly cbsFor: (name: string) => BranchRowCbs
  },
): JSX.Element[] {
  const out: JSX.Element[] = []
  for (const node of nodes) {
    if (node.kind === 'branch') {
      out.push(renderBranchRow(node.branch, ctx.current, ctx.selection, ctx.cbsFor(node.branch.name), {
        displayName: node.displayName,
        depth: node.depth,
      }))
    } else {
      const open = ctx.folderOpen.has(node.path)
      out.push(h('div', {
        key: `f-${node.path}`,
        className: 'gp-branch-folder',
        title: node.path,
        ...(node.depth > 0 ? { style: { paddingLeft: 22 + node.depth * 14 } } : {}),
        onClick: () => ctx.onToggleFolder(node.path),
      }, [
        h(ChevronIcon, { key: 'c', size: 11, open }),
        h('span', { key: 'i', className: 'gp-row-icon gp-branch-folder__icon' }, h(FolderIcon, { size: 13 })),
        h('span', { key: 'n', className: 'gp-tree-name' }, node.name),
        h('span', { key: 'cnt', className: 'gp-branch-row__track' }, String(node.count)),
      ]))
      if (open) out.push(...renderBranchNodes(node.children, ctx))
    }
  }
  return out
}

/**
 * Remote-tracking refs grouped by remote name. Leaves stay non-interactive
 * (as before); folders collapse like local ones. The top-level folder is the
 * remote itself and carries a remote-type icon — GitHub mark for github.com
 * endpoints, the branch glyph otherwise — instead of a folder icon. Deeper
 * levels are ordinary folders.
 */
function renderRemoteNodes(
  nodes: readonly BranchTreeNode[],
  ctx: {
    readonly folderOpen: ReadonlySet<string>
    readonly onToggleFolder: (key: string) => void
    readonly remoteUrls: Record<string, string>
    readonly knownRemotes: readonly string[]
    readonly selection: SidebarSelection
    readonly leafCbsFor: (name: string) => BranchRowCbs
  },
): JSX.Element[] {
  const out: JSX.Element[] = []
  for (const node of nodes) {
    if (node.kind === 'branch') {
      // A remote-tracking ref is never the current branch; otherwise it
      // behaves exactly like a local row (click filters commits, double-click
      // confirms a detached checkout, right-click opens the remote menu).
      out.push(renderBranchRow(node.branch, null, ctx.selection, ctx.leafCbsFor(node.branch.name), {
        displayName: node.displayName,
        depth: node.depth,
        isDefault: node.isDefault === true,
      }))
    } else {
      const key = `remote/${node.path}`
      const open = ctx.folderOpen.has(key)
      const topRemote = node.depth === 0 ? node.path.split('/')[0] ?? '' : ''
      const known = topRemote !== '' && ctx.knownRemotes.includes(topRemote)
      const icon = node.depth === 0 && known
        ? (isGitHubRemote(ctx.remoteUrls[topRemote] ?? '') ? h(GitHubIcon, { size: 13 }) : h(BranchIcon, { size: 13 }))
        : h(FolderIcon, { size: 13 })
      out.push(h('div', {
        key: `f-${key}`,
        className: 'gp-branch-folder',
        title: node.path,
        ...(node.depth > 0 ? { style: { paddingLeft: 22 + node.depth * 14 } } : {}),
        onClick: () => ctx.onToggleFolder(key),
      }, [
        h(ChevronIcon, { key: 'c', size: 11, open }),
        h('span', { key: 'i', className: 'gp-row-icon gp-branch-folder__icon' }, icon),
        h('span', { key: 'n', className: 'gp-tree-name' }, node.name),
        h('span', { key: 'cnt', className: 'gp-branch-row__track' }, String(node.count)),
      ]))
      if (open) out.push(...renderRemoteNodes(node.children, ctx))
    }
  }
  return out
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
        h(Tip, {
          key: 'ap', label: t('side.apply'),
          children: h('button', { type: 'button', onClick: () => void run({ kind: 'stash-apply', index: s.index }) }, '⤓'),
        }),
        h(Tip, {
          key: 'pp', label: t('side.pop'),
          children: h('button', { type: 'button', onClick: () => void run({ kind: 'stash-pop', index: s.index }) }, '⤒'),
        }),
        armed
          ? h(Tip, {
            key: 'dr2', label: t('side.drop'),
            children: h('button', { type: 'button', className: 'gp-side__danger', onClick: cb.onDrop }, '✓'),
          })
          : h(Tip, {
            key: 'dr', label: t('side.drop'),
            children: h('button', { type: 'button', onClick: cb.onArm }, '×'),
          }),
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
