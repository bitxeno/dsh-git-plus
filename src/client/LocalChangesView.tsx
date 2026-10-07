/**
 * Changes tab: stats bar + uncommitted change list (checkboxes) + commit box
 * (with Amend) on the left; the selected file's diff on the right.
 */
import { createElement as h, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { GitPanelRemote } from './rpc'
import { queryAs } from './rpc'
import type { GitAction, GitChange, GitSnapshot } from './types'
import type { GitKey } from './locales'
import { ChangeStats } from './ChangeStats'
import { DiffView, diffSummary, type DiffMode } from './DiffView'
import { ChevronIcon, FolderIcon } from './icons'
import { buildFileTree, type FileTreeNode } from './file-tree'
import { Tip } from './Tip'
import { statusChar, statusClass } from './status'
import { useResizableColumn, useResizableRow } from './resizable'
import { segButtons } from './seg'

interface ChangesTabProps {
  readonly remote: GitPanelRemote
  readonly sessionId: string
  readonly snapshot: GitSnapshot
  readonly onAction: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
}

type GroupKey = 'unstaged' | 'staged'

export function ChangesTab({ remote, sessionId, snapshot, onAction, t }: ChangesTabProps): JSX.Element {
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closed, setClosed] = useState<ReadonlySet<GroupKey>>(new Set())
  const [closedDirs, setClosedDirs] = useState<ReadonlySet<string>>(new Set())
  const [activeDir, setActiveDir] = useState<string | null>(null)
  const [armedDiscard, setArmedDiscard] = useState<string | null>(null)
  const [diffPath, setDiffPath] = useState<{ path: string; base: 'worktree' | 'staged' } | null>(null)
  const [diffText, setDiffText] = useState<string | null>(null)
  const [diffMode, setDiffMode] = useState<DiffMode>(() => snapshot.defaultDiffView)
  const [expanded, setExpanded] = useState(false)
  const [amendPrefilled, setAmendPrefilled] = useState(false)
  const diffSeq = useRef(0)

  // Two blocks like the reference layout: Unstaged (tracked + untracked,
  // anything not staged) first, then Staged.
  const staged = useMemo(() => snapshot.changes.filter((c) => c.staged).sort(byPath), [snapshot])
  const unstaged = useMemo(() => snapshot.changes.filter((c) => !c.staged).sort(byPath), [snapshot])

  const stagedTree = useMemo(() => buildFileTree(staged.map((c) => ({ path: c.path, meta: c }))), [staged])
  const unstagedTree = useMemo(() => buildFileTree(unstaged.map((c) => ({ path: c.path, meta: c }))), [unstaged])

  // Prune the active folder key when it disappears from the snapshot.
  useEffect(() => {
    if (activeDir === null) return
    const sep = activeDir.indexOf(':')
    const side = activeDir.slice(0, sep)
    const dir = activeDir.slice(sep + 1)
    const alive = snapshot.changes.some((c) =>
      (side === 's') === c.staged && (c.path === dir || c.path.startsWith(dir + '/')))
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
    const stillThere = snapshot.changes.some((c) => c.path === diffPath.path)
    if (!stillThere) { setDiffPath(null); setDiffText(null); return }
    void showDiff(diffPath.path, diffPath.base, expanded, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot])

  // Disarm a pending discard confirmation when the snapshot changes (the row
  // may be gone) so the destructive "click again" state can't linger.
  useEffect(() => { setArmedDiscard(null) }, [snapshot])

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
    if (!node.dir) return [(node.meta as GitChange).path]
    return node.children.flatMap(collectLeafPaths)
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
   * Paths the group header button acts on: the selected folder's files (when
   * the selection is inside this group), the open diff's file, or null for
   * the whole group when nothing relevant is selected.
   */
  const selectedPathsFor = (tree: readonly FileTreeNode[], stagedSide: boolean): string[] | null => {
    const sideKey = stagedSide ? 's' : 'w'
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

  const renderTree = (nodes: readonly FileTreeNode[], depth: number, stagedSide: boolean): JSX.Element[] => {
    const out: JSX.Element[] = []
    const sideKey = stagedSide ? 's' : 'w'
    for (const node of nodes) {
      if (node.dir) {
        const dirKey = `${sideKey}:${node.path}`
        const open = !closedDirs.has(dirKey)
        const paths = collectLeafPaths(node)
        out.push(h('div', {
          key: `d:${dirKey}`,
          className: `gp-tdir${activeDir === dirKey ? ' gp-tdir--active' : ''}`,
          style: { paddingLeft: 10 + depth * 16 },
          title: node.path,
            onClick: () => {
              setActiveDir((prev) => (prev === dirKey ? null : dirKey))
              setDiffPath(null)
              setDiffText(null)
            },
            onDoubleClick: () => stagePaths(paths, stagedSide),
          }, [
            h('span', {
              key: 'c', className: 'gp-tdir__chev',
              onClick: (e: Event) => { e.stopPropagation(); toggleDir(dirKey) },
            }, h(ChevronIcon, { size: 11, open })),
            h('span', { key: 'i', className: 'gp-folder' }, h(FolderIcon, { size: 14 })),
            h('span', { key: 'n', className: 'gp-tree-name' }, node.name),
            h('span', { key: 'act', className: 'gp-tdir__actions' }, [
              h(Tip, {
                key: 's', label: stagedSide ? t('changes.unstage') : t('changes.stage'),
                children: h('button', {
                  type: 'button', className: 'gp-icon-btn',
                  disabled: busy || paths.length === 0,
                  onClick: (e: Event) => { e.stopPropagation(); stagePaths(paths, stagedSide) },
                }, stagedSide ? '−' : '+'),
              }),
            ]),
          ]))
        if (open) out.push(...renderTree(node.children, depth + 1, stagedSide))
      } else {
        const c = node.meta as GitChange
        const rowKey = c.path + (c.staged ? ':s' : ':w')
        out.push(renderFileRow(c, {
          depth,
          active: diffPath?.path === c.path && diffPath.base === (c.staged ? 'staged' : 'worktree'),
          busy,
          armed: armedDiscard === rowKey,
          onOpen: () => void showDiff(c.path, c.staged ? 'staged' : 'worktree'),
          onStage: () => void run(c.staged ? { kind: 'unstage', paths: [c.path] } : { kind: 'stage', paths: [c.path] }),
          onDiscard: () => {
            if (armedDiscard === rowKey) { void run({ kind: 'discard', paths: [c.path] }); setArmedDiscard(null) }
            else setArmedDiscard(rowKey)
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
  ): JSX.Element => h('div', { key, className: 'gp-changes__group gp-pane', ...(style !== undefined ? { style } : {}) }, [
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

  return h('div', { className: 'gp-changes' }, [
    // left
    h('div', { key: 'left', className: 'gp-changes__left', style: { flex: `0 0 ${leftCol.width}px` } }, [
      h(ChangeStats, { key: 'stats', stats: snapshot.stats, t }),
      error !== null ? h('div', { key: 'err', className: 'gp-feedback' }, error) : null,
      h('div', { key: 'panes', ref: split.containerRef, className: 'gp-changes__panes' },
        snapshot.changes.length === 0
          ? h('div', { className: 'gp-empty' }, t('changes.noChanges'))
          : [
            renderGroup('unstaged', t('changes.groupUnstaged'), unstagedTree, false, unstaged.length, { flex: unstagedFlex }),
            showRowDivider ? h('div', {
              key: 'rz', className: 'gp-rowresizer', role: 'separator', 'aria-orientation': 'horizontal',
              onPointerDown: split.dividerProps.onPointerDown,
            }) : null,
            renderGroup('staged', t('changes.groupStaged'), stagedTree, true, staged.length, { flex: stagedFlex }),
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
  ])
}

function byPath(a: GitChange, b: GitChange): number {
  return a.path.localeCompare(b.path)
}

interface RowActions {
  depth: number
  active: boolean
  busy: boolean
  armed: boolean
  onOpen: () => void
  onStage: () => void
  onDiscard: () => void
  t: (key: GitKey, params?: Record<string, string | number>) => string
}

function renderFileRow(c: GitChange, a: RowActions): JSX.Element {
  const name = c.path.split('/').pop() ?? c.path
  return h('div', {
    key: c.path + (c.staged ? ':s' : ':w'),
    className: `gp-file-row${a.active ? ' gp-file-row--active' : ''}`,
    style: { paddingLeft: 10 + a.depth * 16 },
    title: c.path,
    onClick: a.onOpen,
    onDoubleClick: () => a.onStage(),
  }, [
    h('span', { key: 'st', className: `gp-status-badge ${statusClass(c.status)}` }, statusChar[c.status] ?? '?'),
    h('span', { key: 'nm', className: 'gp-tree-name' }, name),
    h('span', { key: 'act', className: 'gp-file-row__actions' }, [
      h(Tip, {
        key: 'stg', label: c.staged ? a.t('changes.unstage') : a.t('changes.stage'),
        children: h('button', { type: 'button', className: 'gp-icon-btn', disabled: a.busy, onClick: (e: Event) => { e.stopPropagation(); a.onStage() } }, c.staged ? '−' : '+'),
      }),
      h(Tip, {
        key: 'dis', label: a.armed ? a.t('changes.discardConfirm') : a.t('changes.discard'),
        children: h('button', { type: 'button', className: 'gp-icon-btn', style: a.armed ? { color: 'var(--dsw-alias-state-error-primary)' } : {}, disabled: a.busy, onClick: (e: Event) => { e.stopPropagation(); a.onDiscard() } }, '↺'),
      }),
    ]),
  ])
}
