/**
 * Changes tab: stats bar + uncommitted change list (checkboxes) + commit box
 * (with Amend) on the left; the selected file's diff on the right.
 */
import { createElement as h, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { GitPanelRemote } from './rpc'
import { queryAs } from './rpc'
import type { DirEntry, GitAction, GitChange, GitSnapshot } from './types'
import type { GitKey } from './locales'
import { ChangeStats } from './ChangeStats'
import { DiffView, diffSummary, type DiffMode } from './DiffView'
import { ChevronIcon, EyeIcon, FolderIcon, MoreIcon } from './icons'
import { buildFileTree, type FileTreeNode } from './file-tree'
import { Tip } from './Tip'
import { statusChar, statusClass } from './status'
import { useResizableColumn, useResizableRow } from './resizable'
import { segButtons } from './seg'
import { ContextMenu, menuAnchorAt, type MenuItem } from './ContextMenu'
import {
  buildChangeMenuItems, dirKeyOf, isRowInSelection, isSelectedDirAlive, resolveMenuTarget, rowKeyOf,
  type ChangeMenuTarget,
} from './change-menu'
import { downloadTextFile } from './download'

interface ChangesTabProps {
  readonly remote: GitPanelRemote
  readonly sessionId: string
  readonly snapshot: GitSnapshot
  readonly onAction: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
  readonly onStashPaths: (paths: readonly string[], includeUntracked: boolean) => void
  readonly onDiscardPaths: (paths: readonly string[], count: number) => void
  readonly onPreviewFile: (path: string) => void
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
}

type GroupKey = 'unstaged' | 'staged'

interface ChangeMenuState {
  readonly x: number
  readonly y: number
  readonly target: ChangeMenuTarget
}

export function ChangesTab({ remote, sessionId, snapshot, onAction, onStashPaths, onDiscardPaths, onPreviewFile, t }: ChangesTabProps): JSX.Element {
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closed, setClosed] = useState<ReadonlySet<GroupKey>>(new Set())
  const [closedDirs, setClosedDirs] = useState<ReadonlySet<string>>(new Set())
  const [activeDir, setActiveDir] = useState<string | null>(null)
  const [armedDiscard, setArmedDiscard] = useState<string | null>(null)
  // Cmd/Ctrl+A selection: row keys (`path:s` / `path:w`) so a path that is both
  // staged and modified selects as two rows, matching what the list shows.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  // Group the pointer last entered, and whether it is over the change list at
  // all. The shortcut is about the list, so it stays inert over the diff pane
  // (where Cmd/Ctrl+A must keep selecting text). Starts true so the keyboard
  // path works before the pointer has ever moved; leaving the list turns it
  // off until the pointer returns.
  const hoverGroup = useRef<GroupKey | null>(null)
  const inList = useRef(true)
  // The tab stays mounted (display:none) after the user switches to All Commits,
  // so the window-level shortcut has to check that this pane is the visible one.
  const rootRef = useRef<HTMLDivElement | null>(null)
  // Host platform for the reveal-in-file-manager menu entry (macOS/Windows
  // only; Linux hides it). Static per session, fetched once.
  const [menu, setMenu] = useState<ChangeMenuState | null>(null)
  const [hostPlatform, setHostPlatform] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void remote.query({ sessionId, query: { kind: 'host-platform' } }).then((res) => {
      if (!alive) return
      const v = queryAs(res, 'host-platform')
      if (v !== null) setHostPlatform(v.platform)
    })
    return () => { alive = false }
  }, [remote, sessionId])
  const [diffPath, setDiffPath] = useState<{ path: string; base: 'worktree' | 'staged' } | null>(null)
  const [diffText, setDiffText] = useState<string | null>(null)
  const [diffMode, setDiffMode] = useState<DiffMode>(() => snapshot.defaultDiffView)
  const [expanded, setExpanded] = useState(false)
  const [amendPrefilled, setAmendPrefilled] = useState(false)
  // On-demand worktree listings under expanded untracked-dir leaves
  // (`git status` collapses such dirs to one entry, so the tree cannot show
  // their files from the snapshot alone). Keyed `s:<dir>` / `w:<dir>`.
  const [listedDirs, setListedDirs] = useState<ReadonlyMap<string, { entries: readonly DirEntry[]; truncated: boolean }>>(new Map())
  const [listingDirs, setListingDirs] = useState<ReadonlySet<string>>(new Set())
  const diffSeq = useRef(0)
  const fetchedAt = useRef(new Map<string, number>())

  // Two blocks like the reference layout: Unstaged (tracked + untracked,
  // anything not staged) first, then Staged.
  const staged = useMemo(() => snapshot.changes.filter((c) => c.staged).sort(byPath), [snapshot])
  const unstaged = useMemo(() => snapshot.changes.filter((c) => !c.staged).sort(byPath), [snapshot])

  const stagedTree = useMemo(() => buildFileTree(staged.map((c) => ({ path: c.path, meta: c, ...(c.isDirectory ? { dir: true } : {}) }))), [staged])
  const unstagedTree = useMemo(() => buildFileTree(unstaged.map((c) => ({ path: c.path, meta: c, ...(c.isDirectory ? { dir: true } : {}) }))), [unstaged])

  /**
   * Splice cached worktree listings under directory-change nodes. Nested
   * listed subdirs attach their own listings the same way (their synthetic
   * nodes carry a change payload, so the recursion terminates at unlisted
   * dirs). Ignored entries are filtered: they are not changes.
   */
  const attachListings = (nodes: readonly FileTreeNode[], sideKey: string): FileTreeNode[] => nodes.map((node) => {
    if (!node.dir) return node
    const kids = attachListings(node.children, sideKey)
    const dirChange = dirChangeOf(node)
    const cached = dirChange !== null ? listedDirs.get(`${sideKey}:${node.path}`) : undefined
    if (dirChange === null || cached === undefined) return { ...node, children: kids }
    const synth: FileTreeNode[] = cached.entries.map((e) => {
      const change: GitChange = {
        path: `${node.path}/${e.name}`,
        status: dirChange.status,
        staged: sideKey === 's',
        isDirectory: e.dir,
      }
      return { name: e.name, path: change.path, dir: e.dir, children: [], meta: change }
    })
    return { ...node, children: [...kids, ...attachListings(synth, sideKey)] }
  })

  const stagedFull = useMemo(() => attachListings(stagedTree, 's'), [stagedTree, listedDirs])
  const unstagedFull = useMemo(() => attachListings(unstagedTree, 'w'), [unstagedTree, listedDirs])

  const fetchListing = async (dirKey: string): Promise<void> => {
    setListingDirs((prev) => new Set(prev).add(dirKey))
    try {
      const res = await remote.query({ sessionId, query: { kind: 'dir-list', path: dirKey.slice(2) } })
      const v = queryAs(res, 'dir-list')
      if (v !== null) {
        setListedDirs((prev) => new Map(prev).set(dirKey, {
          entries: v.entries.filter((e) => !e.ignored),
          truncated: v.truncated,
        }))
      }
    } finally {
      setListingDirs((prev) => {
        const next = new Set(prev)
        next.delete(dirKey)
        return next
      })
    }
  }

  /**
   * Keep expanded directory listings live: fetch open directory-change nodes
   * (nested ones surface through the attached trees), refresh them on every
   * snapshot tick, and drop listings for closed or vanished dirs. In-flight
   * fetches are never duplicated and cached rows stay visible during refresh.
   */
  useEffect(() => {
    const keys: string[] = []
    const walk = (nodes: readonly FileTreeNode[], sideKey: string): void => {
      for (const node of nodes) {
        if (!node.dir) continue
        if (dirChangeOf(node) !== null && !closedDirs.has(`${sideKey}:${node.path}`)) keys.push(`${sideKey}:${node.path}`)
        walk(node.children, sideKey)
      }
    }
    walk(stagedFull, 's')
    walk(unstagedFull, 'w')
    setListedDirs((prev) => {
      if ([...prev.keys()].every((k) => keys.includes(k))) return prev
      const next = new Map(prev)
      for (const k of [...next.keys()]) {
        if (!keys.includes(k)) {
          next.delete(k)
          fetchedAt.current.delete(k)
        }
      }
      return next
    })
    for (const key of keys) {
      if (listingDirs.has(key)) continue
      if (listedDirs.has(key) && fetchedAt.current.get(key) === snapshot.checkedAt) continue
      fetchedAt.current.set(key, snapshot.checkedAt)
      void fetchListing(key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, closedDirs, stagedFull, unstagedFull, listingDirs])

  // Prune the active folder key when it disappears from the snapshot.
  useEffect(() => {
    if (activeDir === null) return
    const sep = activeDir.indexOf(':')
    const side = activeDir.slice(0, sep)
    const dir = activeDir.slice(sep + 1)
    // Either direction counts: the dir itself (or something under it) is a
    // snapshot entry, or it is a listed subdirectory of a live dir entry.
    const alive = snapshot.changes.some((c) =>
      (side === 's') === c.staged && (c.path === dir || c.path.startsWith(dir + '/') || (c.isDirectory && dir.startsWith(c.path + '/'))))
    if (!alive) setActiveDir(null)
  }, [snapshot, activeDir])

  // Prefill amend message from the last commit when the box is toggled on empty.
  useEffect(() => {
    if (!amend || amendPrefilled || message.trim() !== '') return
    let alive = true
    void remote.query({ sessionId, query: { kind: 'last-commit-message' } }).then((res) => {
      const msg = queryAs(res, 'last-commit-message')
      if (alive && msg !== null) {
        setMessage(msg.message)
        setAmendPrefilled(true)
      }
    })
    return () => { alive = false }
  }, [amend, amendPrefilled, message, remote, sessionId])

  const showDiff = useCallback(async (path: string, base: 'worktree' | 'staged', expand = false, keepPrevious = false) => {
    const seq = ++diffSeq.current
    setDiffPath({ path, base })
    setActiveDir(null)
    // Only blank the pane on a user-initiated open; a background re-pull keeps
    // the current text so a poll/snapshot tick doesn't flash "Loading".
    if (!keepPrevious) setDiffText(null)
    setExpanded(expand)
    const res = await remote.query({ sessionId, query: { kind: 'diff', path, base, ...(expand ? { context: 100000 } : {}) } })
    if (seq !== diffSeq.current) return
    const diff = queryAs(res, 'diff')
    if (diff !== null) setDiffText(diff.text)
    else setDiffText('')
  }, [remote, sessionId])

  // Re-pull the open diff after snapshot changes (content may have shifted);
  // keep the old text visible during the refetch to avoid a Loading flash.
  useEffect(() => {
    if (diffPath === null) return
    const p = diffPath.path
    const inSnapshot = snapshot.changes.some((c) => c.path === p)
    // Synthetic rows under an expanded untracked dir are not snapshot
    // entries: they stay alive while an ancestor dir entry is listed and the
    // listing still contains them.
    let listed = false
    if (!inSnapshot) {
      for (const [key, listing] of listedDirs) {
        const dir = key.slice(2)
        if (!p.startsWith(dir + '/')) continue
        if (!snapshot.changes.some((c) => c.isDirectory && p.startsWith(c.path + '/'))) continue
        const first = p.slice(dir.length + 1).split('/')[0]
        if (first !== undefined && listing.entries.some((e) => e.name === first)) { listed = true; break }
      }
    }
    if (!inSnapshot && !listed) { setDiffPath(null); setDiffText(null); return }
    void showDiff(diffPath.path, diffPath.base, expanded, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, listedDirs])

  // Disarm a pending discard confirmation when the snapshot changes (the row
  // may be gone) so the destructive "click again" state can't linger.
  useEffect(() => { setArmedDiscard(null) }, [snapshot])

  // Drop selected rows that left the snapshot (staged, discarded, committed),
  // so a stale key never feeds a bulk action with a path git no longer sees.
  // Folder keys survive while anything under the folder is still a change.
  useEffect(() => {
    if (selected.size === 0) return
    const live = new Set(snapshot.changes.map(rowKeyOf))
    setSelected((prev) => {
      const next = new Set([...prev].filter((k) => (k.startsWith('d:') ? isSelectedDirAlive(k, snapshot.changes) : live.has(k))))
      return next.size === prev.size ? prev : next
    })
  }, [snapshot, selected])

  /**
   * Cmd/Ctrl+A selects every file in one group — the "更改" or "已暂存的更改"
   * pane the pointer is in, which is what a right-click then acts on. A window
   * listener is needed because rows are not focusable: focus sits on body, so a
   * handler on the list container would never see the key. Editable targets
   * (commit message, dialogs, diff find box) keep their native select-all.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const root = rootRef.current
      if (root === null || root.offsetParent === null) return
      if (!inList.current) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable === true) return
      // Esc drops the selection, the way it clears a list elsewhere.
      if (e.key === 'Escape' && selected.size > 0) { setSelected(new Set()); return }
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'a') return
      // The pane under the pointer, unless it is empty — then the other pane,
      // so the shortcut always selects something visible.
      const preferred = hoverGroup.current
      const inGroup = (staged: boolean): GitChange[] => snapshot.changes.filter((c) => c.staged === staged)
      const first = inGroup(preferred === 'staged')
      const rows = first.length > 0 ? first : inGroup(preferred !== 'staged')
      if (rows.length === 0) return
      e.preventDefault()
      setSelected(new Set(rows.map(rowKeyOf)))
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [snapshot, selected])

  const run = async (action: GitAction): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    setError(null)
    try {
      const result = await onAction(action)
      if (!result.ok) { setError(result.error ?? t('error.generic')); return false }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.generic'))
      return false
    } finally {
      setBusy(false)
    }
  }

  const commit = async (): Promise<void> => {
    const text = message.trim()
    if (text === '' && !amend) { setError(t('error.emptyMessage')); return }
    const ok = await run({ kind: 'commit', message: text, ...(amend ? { amend: true } : {}) })
    if (ok) { setMessage(''); setAmend(false); setAmendPrefilled(false) }
  }

  const toggleGroup = (key: GroupKey): void => {
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const toggleDir = (path: string): void => {
    setClosedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }

  /** All changed-file paths under a tree node (the node itself if a file). */
  const collectLeafPaths = (node: FileTreeNode): string[] => {
    const dirChange = dirChangeOf(node)
    // A directory change stages as one dir pathspec (complete even past the
    // listing cap), so never descend into it.
    if (dirChange !== null) return [dirChange.path]
    if (!node.dir) return [(node.meta as GitChange).path]
    return node.children.flatMap(collectLeafPaths)
  }

  /** All change entries under a tree node (the node itself if a file). */
  const collectLeafChanges = (node: FileTreeNode): GitChange[] => {
    const dirChange = dirChangeOf(node)
    if (dirChange !== null) return [dirChange]
    if (!node.dir) return [node.meta as GitChange]
    return node.children.flatMap(collectLeafChanges)
  }

  const findTreeNode = (nodes: readonly FileTreeNode[], path: string): FileTreeNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node
      if (node.dir) {
        const found = findTreeNode(node.children, path)
        if (found !== null) return found
      }
    }
    return null
  }

  /**
   * Change entries a selection covers on one side: a selected folder stands for
   * everything under it (one entry for a collapsed untracked dir, whose files
   * git never listed), a selected file for itself. Deduped, because a folder
   * and one of its files can both be selected.
   */
  const selectionChanges = (stagedSide: boolean): GitChange[] => {
    if (selected.size === 0) return []
    const sideKey = stagedSide ? 's' : 'w'
    const tree = stagedSide ? stagedFull : unstagedFull
    const out: GitChange[] = []
    const seen = new Set<string>()
    const add = (c: GitChange): void => {
      const key = rowKeyOf(c)
      if (seen.has(key)) return
      seen.add(key)
      out.push(c)
    }
    for (const key of selected) {
      if (!key.startsWith('d:')) continue
      const dirKey = key.slice(2)
      if (!dirKey.startsWith(`${sideKey}:`)) continue
      const node = findTreeNode(tree, dirKey.slice(2))
      if (node !== null) collectLeafChanges(node).forEach(add)
    }
    for (const c of snapshot.changes) {
      if (c.staged === stagedSide && selected.has(rowKeyOf(c))) add(c)
    }
    return out
  }

  /**
   * Paths the group header button acts on: the multi-selection inside this
   * group, the selected folder's files (when the selection is inside this
   * group), the open diff's file, or null for the whole group when nothing
   * relevant is selected.
   */
  const selectedPathsFor = (tree: readonly FileTreeNode[], stagedSide: boolean): string[] | null => {
    const sideKey = stagedSide ? 's' : 'w'
    if (selected.size > 0) {
      const inGroup = selectionChanges(stagedSide)
      if (inGroup.length > 0) return inGroup.map((c) => c.path)
    }
    if (activeDir !== null && activeDir.startsWith(`${sideKey}:`)) {
      const node = findTreeNode(tree, activeDir.slice(2))
      return node !== null ? collectLeafPaths(node) : []
    }
    if (diffPath !== null && (diffPath.base === 'staged') === stagedSide) return [diffPath.path]
    return null
  }

  const stagePaths = (paths: readonly string[], stagedSide: boolean): void => {
    if (paths.length === 0 || busy) return
    void run(stagedSide ? { kind: 'unstage', paths: [...paths] } : { kind: 'stage', paths: [...paths] })
  }

  /**
   * Whether a row is in the selection, directly or through a selected ancestor
   * folder — selecting a folder stands for its files, so they highlight too and
   * a right-click on any of them keeps acting on the whole selection.
   */
  const isRowSelected = (key: string, path: string, stagedSide: boolean): boolean =>
    isRowInSelection(selected, key, path, stagedSide)

  /** Right-click target: the whole selection, or just the row clicked. */
  const menuTargetFor = (rowKey: string, inSelection: boolean, stagedSide: boolean, single: ChangeMenuTarget): ChangeMenuTarget =>
    resolveMenuTarget({ selected, rowKey, inSelection, stagedSide, leaves: selectionChanges(stagedSide), single })

  /**
   * Cmd/Ctrl+click toggles one row (file or folder); a plain click keeps the
   * list's primary action (open the diff / the folder) and clears the
   * selection, so selecting and browsing never fight over the same click.
   */
  const toggleKey = (key: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const renderTree = (nodes: readonly FileTreeNode[], depth: number, stagedSide: boolean): JSX.Element[] => {
    const out: JSX.Element[] = []
    const sideKey = stagedSide ? 's' : 'w'
    for (const node of nodes) {
      if (node.dir) {
        const dirKey = `${sideKey}:${node.path}`
        const open = !closedDirs.has(dirKey)
        const paths = collectLeafPaths(node)
        const discardKey = `d:${dirKey}`
        const dirArmed = armedDiscard === discardKey
        const dirSelKey = dirKeyOf(node.path, stagedSide)
        out.push(h('div', {
          key: dirSelKey,
          className: `gp-tdir${activeDir === dirKey ? ' gp-tdir--active' : ''}${selected.has(dirSelKey) ? ' gp-tdir--selected' : ''}`,
          style: { paddingLeft: 10 + depth * 16 },
          title: node.path,
            onClick: (e: { metaKey: boolean; ctrlKey: boolean }) => {
              // A plain click makes this folder the whole selection, so a
              // following Cmd/Ctrl+click extends it (two folders, or a folder
              // plus files). Cmd/Ctrl+click toggles this folder in place.
              if (e.metaKey || e.ctrlKey) { toggleKey(dirSelKey); return }
              setSelected(new Set([dirSelKey]))
              setActiveDir((prev) => (prev === dirKey ? null : dirKey))
              setDiffPath(null)
              setDiffText(null)
            },
            onDoubleClick: () => stagePaths(paths, stagedSide),
            onContextMenu: (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => {
              e.preventDefault(); e.stopPropagation()
              // Right-clicking outside the selection targets this folder alone;
              // the highlight follows so the menu never acts on invisible rows.
              if (!selected.has(dirSelKey)) setSelected(new Set())
              setMenu({
                x: e.clientX, y: e.clientY,
                target: menuTargetFor(dirSelKey, selected.has(dirSelKey), stagedSide, { kind: 'dir', dir: node.path, stagedSide, leaves: collectLeafChanges(node) }),
              })
            },
          }, [
            h('span', {
              key: 'c', className: 'gp-tdir__chev',
              onClick: (e: Event) => { e.stopPropagation(); toggleDir(dirKey) },
            }, h(ChevronIcon, { size: 11, open })),
            h('span', { key: 'i', className: 'gp-folder' }, h(FolderIcon, { size: 14 })),
            h('span', { key: 'n', className: 'gp-tree-name' }, node.name),
            h('span', { key: 'act', className: 'gp-tdir__actions' }, [
              // Staged dirs have nothing to discard: `git restore` operates on
              // the worktree, not the index (see the file-row note).
              stagedSide ? null : h(Tip, {
                key: 'dis', label: dirArmed ? t('changes.discardConfirm') : t('changes.discard'),
                children: h('button', {
                  type: 'button', className: 'gp-icon-btn',
                  style: dirArmed ? { color: 'var(--dsw-alias-state-error-primary)' } : {},
                  disabled: busy || paths.length === 0,
                  onClick: (e: Event) => {
                    e.stopPropagation()
                    if (armedDiscard === discardKey) { void run({ kind: 'discard', paths: [...paths] }); setArmedDiscard(null) }
                    else setArmedDiscard(discardKey)
                  },
                }, '↺'),
              }),
              h(Tip, {
                key: 'more', label: t('menu.more'),
                children: h('button', {
                  type: 'button', className: 'gp-icon-btn gp-more-btn', 'aria-label': t('menu.more'),
                  onClick: (e: Event) => {
                    e.stopPropagation()
                    const p = menuAnchorAt(e)
                    setMenu({
                      x: p.x, y: p.y,
                      target: menuTargetFor(dirSelKey, selected.has(dirSelKey), stagedSide, { kind: 'dir', dir: node.path, stagedSide, leaves: collectLeafChanges(node) }),
                    })
                  },
                }, h(MoreIcon, { size: 15 })),
              }),
            ]),
          ]))
        if (open) out.push(...renderTree(node.children, depth + 1, stagedSide))
        // Untracked-dir leaves have no snapshot children; their rows come
        // from the on-demand listing (loading / truncated notes included).
        if (open && dirChangeOf(node) !== null) {
          const cached = listedDirs.get(dirKey)
          const note = (key: string, text: string): JSX.Element => h('div', {
            key, className: 'gp-tree-row gp-tree-row--muted',
            style: { paddingLeft: 10 + (depth + 1) * 16 },
          }, text)
          if (cached === undefined) {
            if (listingDirs.has(dirKey)) out.push(note(`ld:${dirKey}`, t('common.loading')))
          } else if (cached.truncated) {
            out.push(note(`tr:${dirKey}`, t('files.truncated')))
          }
        }
      } else {
        const c = node.meta as GitChange
        const rowKey = rowKeyOf(c)
        const fileSelected = isRowSelected(rowKey, c.path, c.staged)
        out.push(renderFileRow(c, {
          depth,
          active: diffPath?.path === c.path && diffPath.base === (c.staged ? 'staged' : 'worktree'),
          selected: fileSelected,
          busy,
          armed: armedDiscard === rowKey,
          onOpen: (additive: boolean) => {
            // Same rule as folders: a plain click selects just this row (then
            // Cmd/Ctrl+click extends), an additive click toggles it.
            if (additive) { toggleKey(rowKey); return }
            setSelected(new Set([rowKey]))
            void showDiff(c.path, c.staged ? 'staged' : 'worktree')
          },
          onStage: () => void run(c.staged ? { kind: 'unstage', paths: [c.path] } : { kind: 'stage', paths: [c.path] }),
          onPreview: () => onPreviewFile(c.path),
          onDiscard: () => {
            if (armedDiscard === rowKey) { void run({ kind: 'discard', paths: [c.path] }); setArmedDiscard(null) }
            else setArmedDiscard(rowKey)
          },
          onMenu: (x, y) => {
            // Right-clicking outside the selection targets that row alone; the
            // highlight follows, so the menu never acts on something invisible.
            const inSelection = isRowSelected(rowKey, c.path, c.staged)
            if (!inSelection) setSelected(new Set())
            setMenu({ x, y, target: menuTargetFor(rowKey, inSelection, c.staged, { kind: 'file', change: c }) })
          },
          t,
        }))
      }
    }
    return out
  }

  const renderGroup = (
    key: GroupKey, label: string, tree: readonly FileTreeNode[], stagedSide: boolean, count: number,
    style?: { flex?: string },
  ): JSX.Element => h('div', {
    key,
    className: 'gp-changes__group gp-pane',
    ...(style !== undefined ? { style } : {}),
    // Remember the pane the pointer is in so Cmd/Ctrl+A selects the right one.
    onMouseEnter: () => { hoverGroup.current = key },
  }, [
    h('div', { key: 'head', className: 'gp-changes__grouphead', onClick: () => toggleGroup(key) }, [
      h(ChevronIcon, { key: 'chev', size: 12, open: !closed.has(key) }),
      h('span', { key: 't' }, `${label} (${count})`),
      h('button', {
        key: 'all', type: 'button', className: 'gp-btn',
        disabled: busy || count === 0,
        title: stagedSide ? t('changes.unstage') : t('changes.stage'),
        onClick: (e: Event) => {
          e.stopPropagation()
          const sel = selectedPathsFor(tree, stagedSide)
          if (sel === null) void run(stagedSide ? { kind: 'unstage-all' } : { kind: 'stage-all' })
          else stagePaths(sel, stagedSide)
        },
      }, stagedSide ? t('changes.unstage') : t('changes.stage')),
    ]),
    closed.has(key) ? null : h('div', { key: 'body', className: 'gp-pane__body' }, renderTree(tree, 0, stagedSide)),
  ])

  const summary = diffText !== null && diffText !== '' ? diffSummary(diffText) : null

  // The left change-list column is drag-resizable; the right diff column takes
  // the rest. Width persists across mounts.
  const leftCol = useResizableColumn({ storageKey: 'gp.changes.left', initial: 380, min: 220, reserve: 200, edge: 'end' })
  // Unstaged/staged split: two stacked panes, staged owns `frac` of the free
  // space (default 40%). Dragging the divider adjusts it; persists.
  const split = useResizableRow({ storageKey: 'gp.changes.staged.frac', initialFrac: 0.4, min: 80 })
  const unstagedClosed = closed.has('unstaged')
  const stagedClosed = closed.has('staged')
  const showRowDivider = snapshot.changes.length > 0 && !unstagedClosed && !stagedClosed
  const unstagedFlex = unstagedClosed ? 'none' : stagedClosed ? '1 1 0' : `${1 - split.frac} 1 0`
  const stagedFlex = stagedClosed ? 'none' : unstagedClosed ? '1 1 0' : `${split.frac} 1 0`

  const savePatch = async (paths: readonly string[]): Promise<void> => {
    const res = await remote.query({ sessionId, query: { kind: 'patch', paths: [...paths] } })
    const patch = queryAs(res, 'patch')
    if (patch === null || patch.text === '') { setError(t('menu.patchEmpty')); return }
    downloadTextFile('local-changes.patch', patch.text)
    if (patch.truncated) setError(t('menu.patchTruncated'))
  }

  // Right-click menu for a file or folder row, grouped by function:
  // stage | stash + patch | ignore patterns | discard (danger).
  const menuItems: readonly MenuItem[] = menu === null ? [] : buildChangeMenuItems(menu.target, {
    view: (path) => onPreviewFile(path),
    reveal: hostPlatform === 'darwin'
      ? { label: t('menu.revealFinder'), run: (path) => void run({ kind: 'reveal', path }) }
      : hostPlatform === 'win32'
        ? { label: t('menu.revealExplorer'), run: (path) => void run({ kind: 'reveal', path }) }
        : null,
    stage: (paths, stagedSide) => stagePaths(paths, stagedSide),
    stash: (paths, includeUntracked) => onStashPaths(paths, includeUntracked),
    patch: (paths) => void savePatch(paths),
    ignore: (patterns) => void run({ kind: 'ignore', patterns: [...patterns] }),
    discard: (paths, count) => onDiscardPaths(paths, count),
    t,
  })

  return h('div', { className: 'gp-changes', ref: rootRef }, [
    // left
    h('div', { key: 'left', className: 'gp-changes__left', style: { flex: `0 0 ${leftCol.width}px` } }, [
      h(ChangeStats, { key: 'stats', stats: snapshot.stats, t }),
      error !== null ? h('div', { key: 'err', className: 'gp-feedback' }, error) : null,
      h('div', {
        key: 'panes', ref: split.containerRef, className: 'gp-changes__panes',
        onMouseEnter: () => { inList.current = true },
        onMouseLeave: () => { inList.current = false },
      },
        snapshot.changes.length === 0
          ? h('div', { className: 'gp-empty' }, t('changes.noChanges'))
          : [
            renderGroup('unstaged', t('changes.groupUnstaged'), unstagedFull, false, unstaged.length, { flex: unstagedFlex }),
            showRowDivider ? h('div', {
              key: 'rz', className: 'gp-rowresizer', role: 'separator', 'aria-orientation': 'horizontal',
              onPointerDown: split.dividerProps.onPointerDown,
            }) : null,
            renderGroup('staged', t('changes.groupStaged'), stagedFull, true, staged.length, { flex: stagedFlex }),
          ]),
      // commit box
      h('div', { key: 'box', className: 'gp-commitbox' }, [
        h('textarea', {
          key: 'msg',
          className: 'gp-commitbox__msg',
          placeholder: t('commit.placeholder'),
          value: message,
          onChange: (e: { target: { value: string } }) => setMessage(e.target.value),
        }),
        h('div', { key: 'row', className: 'gp-commitbox__row' }, [
          h('label', { key: 'amend', className: 'gp-commitbox__amend' }, [
            h('input', { key: 'cb', type: 'checkbox', className: 'gp-check', checked: amend, onChange: () => { setAmend((v) => !v); setAmendPrefilled(false) } }),
            t('commit.amend'),
          ]),
          h('div', { key: 'actions', className: 'gp-commitbox__actions' }, [
            h('button', { key: 'commit', type: 'button', className: 'gp-btn gp-btn--primary', disabled: busy || message.trim() === '', onClick: () => void commit() }, t('commit.commit')),
          ]),
        ]),
      ]),
    ]),
    leftCol.divider,
    // right diff
    h('div', { key: 'right', className: 'gp-changes__right' },
      diffPath === null
        ? h('div', { className: 'gp-empty' }, t('changes.selectFile'))
        : h('div', { className: 'gp-diff' }, [
          h('div', { key: 'tb', className: 'gp-diff__toolbar' }, [
            h('span', { key: 'path', className: 'gp-diff__path' }, diffPath.path),
            summary ? h('span', { key: 'sum', className: 'gp-stats__item', style: { marginLeft: 'auto' } }, [
              h('span', { key: 'a', className: 'gp-stats__add' }, `+${summary.add}`), ' ',
              h('span', { key: 'd', className: 'gp-stats__del' }, `\u2212${summary.del}`),
            ]) : null,
            h('button', {
              key: 'expand', type: 'button',
              className: `gp-seg__btn gp-diff__expand${expanded ? ' gp-seg__btn--active' : ''}`,
              style: summary ? {} : { marginLeft: 'auto' },
              disabled: diffMode !== 'split' && diffMode !== 'unified',
              title: t(expanded ? 'diff.collapse' : 'diff.expandAll'),
              onClick: () => void showDiff(diffPath.path, diffPath.base, !expanded),
            }, t(expanded ? 'diff.collapse' : 'diff.expandAll')),
            h('div', { key: 'seg', className: 'gp-seg' },
              segButtons<DiffMode>(['unified', 'split', 'before', 'after'], diffMode, setDiffMode, (m) => t(`diff.${m}` as GitKey))),
          ]),
          h('div', { key: 'scroll', className: 'gp-diff__scroll' },
            diffText === null ? h('div', { className: 'gp-empty' }, t('common.loading')) : h(DiffView, { text: diffText, mode: diffMode, path: diffPath.path, remote, sessionId, imageSpec: { base: diffPath.base }, t })),
        ])),
    menu !== null ? h(ContextMenu, { key: 'menu', x: menu.x, y: menu.y, items: menuItems, onClose: () => setMenu(null) }) : null,
  ])
}

function byPath(a: GitChange, b: GitChange): number {
  return a.path.localeCompare(b.path)
}

/**
 * A tree node that is itself a directory change (a collapsed untracked dir
 * from the snapshot, or a listed subdirectory synthesized below one).
 * Intermediate folders never carry a change payload.
 */
function dirChangeOf(node: FileTreeNode): GitChange | null {
  const meta = node.meta as GitChange | undefined
  return node.dir && meta !== undefined && meta.isDirectory === true ? meta : null
}

interface RowActions {
  depth: number
  active: boolean
  /** Part of the Cmd/Ctrl+A (or additive-click) selection. */
  selected: boolean
  busy: boolean
  armed: boolean
  onOpen: (additive: boolean) => void
  onStage: () => void
  onPreview: () => void
  onDiscard: () => void
  onMenu: (x: number, y: number) => void
  t: (key: GitKey, params?: Record<string, string | number>) => string
}

function renderFileRow(c: GitChange, a: RowActions): JSX.Element {
  const name = c.path.split('/').pop() ?? c.path
  return h('div', {
    key: c.path + (c.staged ? ':s' : ':w'),
    className: `gp-file-row${a.active ? ' gp-file-row--active' : ''}${a.selected ? ' gp-file-row--selected' : ''}`,
    style: { paddingLeft: 10 + a.depth * 16 },
    title: c.path,
    onClick: (e: { metaKey: boolean; ctrlKey: boolean }) => a.onOpen(e.metaKey || e.ctrlKey),
    onDoubleClick: () => a.onStage(),
    onContextMenu: (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => { e.preventDefault(); e.stopPropagation(); a.onMenu(e.clientX, e.clientY) },
  }, [
    h('span', { key: 'st', className: `gp-status-badge ${statusClass(c.status)}` }, statusChar[c.status] ?? '?'),
    h('span', { key: 'nm', className: 'gp-tree-name' }, name),
    h('span', { key: 'act', className: 'gp-file-row__actions' }, [
      h(Tip, {
        key: 'view', label: a.t('menu.view'),
        children: h('button', { type: 'button', className: 'gp-icon-btn', onClick: (e: Event) => { e.stopPropagation(); a.onPreview() } }, h(EyeIcon, { size: 14 })),
      }),
      // Staged rows drop the discard action: `git restore` cannot target the
      // index, so a staged file must be unstaged before its changes go.
      c.staged ? null : h(Tip, {
        key: 'dis', label: a.armed ? a.t('changes.discardConfirm') : a.t('changes.discard'),
        children: h('button', { type: 'button', className: 'gp-icon-btn', style: a.armed ? { color: 'var(--dsw-alias-state-error-primary)' } : {}, disabled: a.busy, onClick: (e: Event) => { e.stopPropagation(); a.onDiscard() } }, '↺'),
      }),
      h(Tip, {
        key: 'more', label: a.t('menu.more'),
        children: h('button', {
          type: 'button', className: 'gp-icon-btn gp-more-btn', 'aria-label': a.t('menu.more'),
          onClick: (e: Event) => { e.stopPropagation(); const p = menuAnchorAt(e); a.onMenu(p.x, p.y) },
        }, h(MoreIcon, { size: 15 })),
      }),
    ]),
  ])
}




