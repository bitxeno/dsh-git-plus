/**
 * All Commits view (git-graph-plus layout):
 *  top    = commit graph list (message / hash / author / date + search)
 *  bottom = selected commit details (Commit | Changes tabs, closable,
 *           drag-resizable, fullscreen) — click a row to open it.
 */
import { createElement as h, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { JSX } from 'react'
import type { GitPanelRemote } from './rpc'
import { queryAs } from './rpc'
import type { GraphCommit } from './types'
import type { GitKey } from './locales'
import { ChevronIcon, CloseIcon, FileIcon, RefreshIcon } from './icons'
import {
  buildFullGraph, buildPathD, computeCurrentBranchSet, computeRefAncestorSet,
  GRAPH_PALETTE, GRAPH_ROW_H, GRAPH_X_SCALE,
  laneX, plusRefName, resolveGraphColor,
  type FullGraphData, type PlusCommit, type PlusRef,
} from './graph-plus'
import { buildFileTree } from './file-tree'
import { absoluteDateTime, absoluteTime, timeAgo } from './time'
import { statusChar, statusClass } from './status'
import { DiffView, diffSummary, type DiffMode } from './DiffView'
import { ContextMenu, copyText } from './ContextMenu'
import { Tip } from './Tip'
import { authorAvatarUrl, isGitHubRemote } from './avatar'
import { useBranchTree, useCommitDetail, useHistory, type HistoryFilter } from './overview-hooks'
import { segButtons } from './seg'
import type { DiffViewMode } from './types'

interface OverviewProps {
  readonly remote: GitPanelRemote
  readonly sessionId: string
  /** Snapshot checkedAt; bumps drive a history/tree reload (commit landed / poll). */
  readonly refreshKey: number
  /** Default diff layout new file-diff overlays open with. */
  readonly defaultDiffView: DiffViewMode
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  /** Sidebar-driven ref filter (branch/tag); null = all. */
  readonly externalRef?: string | null
  /** Snapshot HEAD (short hash); anchors dimming when HEAD is detached. */
  readonly headHash?: string | null
  /** Commit row actions (context menu + double-click checkout). */
  readonly onBranchAt: (hash: string) => void
  readonly onTagAt: (hash: string) => void
  readonly onCheckoutAt: (hash: string, subject: string) => void
}

const GRID_TPL = 'minmax(0,1fr) 120px 72px 96px'
/** Toolbar width below which the search placeholder drops its "(message / hash)"
 * hint — a placeholder is a DOM attribute CSS can't rewrite, so swap it here.
 * Measured on the toolbar (not the input): flex-wrap keeps the input's own
 * width nearly constant while the toolbar's width is the real space signal. */
const SEARCH_HINT_MIN_W = 260

/** Observe an element's width; true once it is measured and below `min`. */
function useNarrow(el: HTMLElement | null, min: number): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (el === null || typeof ResizeObserver === 'undefined') return
    const measure = (): void => setNarrow(el.clientWidth > 0 && el.clientWidth < min)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, min])
  return narrow
}

export function OverviewTab({ remote, sessionId, refreshKey, defaultDiffView, t, externalRef, headHash, onBranchAt, onTagAt, onCheckoutAt }: OverviewProps): JSX.Element {
  const [filter, setFilter] = useState<HistoryFilter>({ ref: null, search: '', author: '', since: '' })
  // Sidebar selection anchors dimming (one-way sync). History always loads
  // everything; rows outside the selected ref's ancestry render dimmed, so a
  // branch view shows all commits with newer ones grayed out.
  const [selRef, setSelRef] = useState<string | null>(null)
  // Jump target: scroll the list to the selected ref's commit once loaded.
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)
  useEffect(() => {
    if (externalRef === undefined) return
    setSelRef(externalRef)
    setPendingScroll(externalRef)
  }, [externalRef])
  const [searchInput, setSearchInput] = useState('')
  // GitHub remote gate for author avatars (Gravatar needs nothing else).
  const [isGitHub, setIsGitHub] = useState(false)
  useEffect(() => {
    let alive = true
    void remote.query({ sessionId, query: { kind: 'remote-url' } }).then((res) => {
      if (!alive) return
      const v = queryAs(res, 'remote-url')
      setIsGitHub(v !== null && isGitHubRemote(v.url))
    })
    return () => { alive = false }
  }, [remote, sessionId, refreshKey])
  const [searchEl, setSearchEl] = useState<HTMLElement | null>(null)
  const searchNarrow = useNarrow(searchEl, SEARCH_HINT_MIN_W)
  const { authors, reload: reloadTree } = useBranchTree(remote, sessionId, refreshKey)
  const detail = useCommitDetail(remote, sessionId, defaultDiffView)
  const { commits, loading, listError, hasMore, listRef, loadMore } = useHistory(
    remote, sessionId, filter, refreshKey, detail.clearSelection,
  )

  // Search debounce → filter change (which reloads history from page 0).
  useEffect(() => {
    const timer = setTimeout(() => setFilter((prev) => (prev.search === searchInput ? prev : { ...prev, search: searchInput })), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const searching = filter.search !== ''
  // git-graph-plus rail input mapped from our history commits.
  const plusCommits: readonly PlusCommit[] = useMemo(() => commits.map((c) => ({
    hash: c.hash,
    parents: c.parents,
    refs: c.refs.map((r): PlusRef => {
      if (r.head) return { type: 'head', name: r.name }
      if (r.kind === 'remote') {
        const slash = r.name.indexOf('/')
        return slash < 0
          ? { type: 'remote-branch', name: r.name }
          : { type: 'remote-branch', name: r.name.slice(slash + 1), remote: r.name.slice(0, slash) }
      }
      if (r.kind === 'tag') return { type: 'tag', name: r.name }
      return { type: 'branch', name: r.name }
    }),
  })), [commits])
  // Searching flattens the list (parents may be outside the page); otherwise
  // lay out the full SourceGit-style rail graph.
  const full: FullGraphData | null = useMemo(
    () => (searching || plusCommits.length === 0 ? null : buildFullGraph(plusCommits)),
    [searching, plusCommits],
  )
  const branchSet = useMemo(() => computeCurrentBranchSet(plusCommits, headHash), [plusCommits, headHash])
  // Dim anchor: the selected ref's ancestry when one is picked (HEAD resolves
  // to the checkout), otherwise the current HEAD ancestry. Falls back to HEAD
  // when the ref's commit isn't in the loaded page.
  const anchorSet = useMemo(() => {
    if (selRef !== null && selRef !== 'HEAD') {
      const s = computeRefAncestorSet(plusCommits, selRef)
      if (s.size > 0) return s
    }
    return branchSet
  }, [plusCommits, selRef, branchSet])

  // Scroll to the pending jump target (its commit may arrive on a later page:
  // keep loading while pages remain, then give up quietly).
  useEffect(() => {
    if (pendingScroll === null) return
    const idx = pendingScroll === 'HEAD'
      ? (headHash ? plusCommits.findIndex((c) => c.hash === headHash || c.hash.startsWith(headHash)) : -1)
      : plusCommits.findIndex((c) => c.refs.some((r) => plusRefName(r) === pendingScroll))
    if (idx >= 0) {
      const el = listRef.current
      if (el !== null) el.scrollTop = Math.max(0, idx * GRAPH_ROW_H - el.clientHeight / 2 + GRAPH_ROW_H / 2)
      const target = commits[idx]
      if (target !== undefined) {
        void detail.select(target)
        setBottomTab('commit')
      }
      setPendingScroll(null)
    } else if (hasMore) {
      loadMore()
    } else {
      setPendingScroll(null)
    }
  }, [commits, pendingScroll, headHash, hasMore, loadMore, plusCommits])
  const svgW = useMemo(() => {
    if (full === null) return 0
    let max = 0
    for (const m of full.commitLeftMargin) if (m > max) max = m
    for (const d of full.dots) if (d.center.x > max) max = d.center.x
    return Math.ceil(max * GRAPH_X_SCALE) + 10
  }, [full])
  const totalH = commits.length * GRAPH_ROW_H

  const onScroll = (): void => {
    const el = listRef.current
    if (el === null || !hasMore) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) loadMore()
  }

  const now = useMemo(() => Date.now(), [commits])
  const fileTree = useMemo(() => (detail.detail === null ? [] : buildFileTree(detail.detail.stats.map((s) => ({ path: s.path, meta: s.status })))), [detail.detail])
  const selected = detail.selected

  // Bottom detail panel state (git-graph-plus BottomPanel): tab, closable,
  // drag-resizable height, fullscreen. Selecting a row opens it on Commit.
  // Row right-click menu state lives here too (needs the commit payloads).
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; hash: string; shortHash: string; subject: string } | null>(null)
  const [bottomTab, setBottomTab] = useState<'commit' | 'changes'>('commit')
  const [fullscreen, setFullscreen] = useState(false)
  const [bottomH, setBottomH] = useState<number>(readBottomHeight)
  const selHash = selected?.hash ?? null
  useEffect(() => {
    if (selHash !== null) { setBottomTab('commit'); setFullscreen(false) }
  }, [selHash])
  useEffect(() => { writeBottomHeight(bottomH) }, [bottomH])

  const closeBottom = (): void => { detail.clearSelection(); setFullscreen(false) }

  const jumpToParent = (hash: string): void => {
    const found = commits.find((c) => c.hash === hash || c.hash.startsWith(hash))
    if (found !== undefined) { void detail.select(found); setBottomTab('commit') }
    else setSearchInput(hash.slice(0, 7))
  }

  const onBottomDividerDown = (e: { preventDefault: () => void; clientY: number }): void => {
    e.preventDefault()
    const startY = e.clientY
    const startH = bottomH
    const move = (ev: MouseEvent): void => {
      setBottomH(Math.min(720, Math.max(120, startH + (startY - ev.clientY))))
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const bottomOpen = selected !== null

  return h('div', { className: 'ggp' }, [
    // file-diff modal (click a changed file in the bottom Changes tab)
    renderFileDiffModal(detail.fileDiff, {
      text: detail.fileDiffText,
      error: detail.fileDiffError,
      mode: detail.fileDiffMode,
      onMode: detail.setFileDiffMode,
      expanded: detail.fileDiffExpanded,
      onExpand: (expand) => { if (detail.fileDiff !== null) detail.openFileDiff(detail.fileDiff.path, detail.fileDiff.hash, detail.fileDiff.shortHash, expand) },
      onClose: detail.closeFileDiff,
      remote,
      sessionId,
      t,
    }),
    // toolbar: search + author + date + fetch
    h('div', { key: 'tb', className: 'gp-toolbar', ref: setSearchEl }, [
      h('input', {
        key: 'search', className: 'gp-search', placeholder: t(searchNarrow ? 'overview.searchShort' : 'overview.search'), value: searchInput,
        onChange: (e: { target: { value: string } }) => setSearchInput(e.target.value),
      }),
      h('select', {
        key: 'author', className: 'gp-select', value: filter.author,
        onChange: (e: { target: { value: string } }) => setFilter((prev) => ({ ...prev, author: e.target.value })),
      }, [
        h('option', { key: '', value: '' }, t('overview.allUsers')),
        ...authors.map((a) => h('option', { key: a, value: a }, a)),
      ]),
      h('select', {
        key: 'since', className: 'gp-select', value: filter.since,
        onChange: (e: { target: { value: string } }) => setFilter((prev) => ({ ...prev, since: e.target.value })),
      }, [
        h('option', { key: '', value: '' }, t('overview.allTime')),
        h('option', { key: 'today', value: '1 day ago' }, t('overview.today')),
        h('option', { key: '7d', value: '7 days ago' }, t('overview.last7d')),
        h('option', { key: '30d', value: '30 days ago' }, t('overview.last30d')),
      ]),
      h(Tip, {
        key: 'fetch', label: t('overview.fetch'),
        children: h('button', { type: 'button', className: 'gp-icon-btn', onClick: () => { void remote.run({ sessionId, action: { kind: 'fetch' } }).then(() => reloadTree()) } }, h(RefreshIcon, { size: 14 })),
      }),
    ]),
    // top: commit graph list (one overlay SVG + flat rows, git-graph-plus style)
    fullscreen ? null : h('div', { key: 'graph', className: 'ggp-graph' },
      h('div', { key: 'list', className: 'gp-history__list ggp-list', ref: listRef, onScroll },
        commits.length === 0
          ? h('div', { className: 'gp-empty' }, loading ? t('common.loading') : listError ? t('overview.loadFailed') : t('overview.noResults'))
          : h('div', { className: 'ggp-canvas', style: { height: totalH, position: 'relative' } }, [
            full !== null ? renderGraphSvg(full, svgW) : null,
            ...commits.map((commit, index) => renderPlusRow(commit, {
              selected: selected?.hash === commit.hash,
              dimmed: !searching && anchorSet.size > 0 && !anchorSet.has(commit.hash),
              isHead: headHash != null && headHash !== '' && (commit.hash === headHash || commit.hash.startsWith(headHash)),
              margin: full?.commitLeftMargin[index] ?? 0,
              nodeColor: full !== null && full.dots[index] !== undefined
                ? resolveGraphColor(GRAPH_PALETTE, full.dots[index]!.color, full.dots[index]!.colorOverride)
                : '#888',
              localOnly: full?.dots[index]?.localOnly ?? false,
              remoteOnly: full?.dots[index]?.remoteTip ?? false,
              avatarUrl: authorAvatarUrl(commit.authorEmail, 36, isGitHub),
              onSelect: () => { void detail.select(commit); setBottomTab('commit') },
              onMenu: (x, y) => setRowMenu({ x, y, hash: commit.hash, shortHash: commit.shortHash, subject: commit.subject }),
              onCheckout: () => onCheckoutAt(commit.hash, commit.subject),
              onHoverEnter: detail.onHoverEnter, onHoverLeave: detail.onHoverLeave,
              now, t,
            })),
          ]))),
    rowMenu !== null ? h(ContextMenu, {
      key: 'rowmenu', x: rowMenu.x, y: rowMenu.y, onClose: () => setRowMenu(null), items: [
        { key: 'br', label: t('menu.createBranchAt'), onSelect: () => onBranchAt(rowMenu.hash) },
        { key: 'tg', label: t('menu.createTagAt'), onSelect: () => onTagAt(rowMenu.hash) },
        { key: 'co', label: t('menu.checkoutCommit'), onSelect: () => onCheckoutAt(rowMenu.hash, rowMenu.subject) },
        { key: 'cp', label: t('menu.copySha'), onSelect: () => void copyText(rowMenu.hash) },
        { key: 'cs', label: t('menu.copyShortSha'), onSelect: () => void copyText(rowMenu.shortHash) },
      ],
    }) : null,
    // bottom: commit details (closable, resizable, fullscreen)
    bottomOpen && !fullscreen ? h('div', {
      key: 'rz', className: 'ggp-resizer',
      onMouseDown: onBottomDividerDown as unknown as () => void,
    }) : null,
    bottomOpen ? h('div', {
      key: 'bottom',
      className: `ggp-bottom${fullscreen ? ' ggp-bottom--full' : ''}`,
      ...(fullscreen ? {} : { style: { height: bottomH } }),
    }, [
      h('div', { key: 'head', className: 'ggp-bottom__head' }, [
        h('span', { key: 'tabs', className: 'ggp-segtrack' }, [
          h('button', {
            key: 'c', type: 'button',
            className: `ggp-tab${bottomTab === 'commit' ? ' ggp-tab--active' : ''}`,
            onClick: () => setBottomTab('commit'),
          }, t('details.commit')),
          h('button', {
            key: 'ch', type: 'button',
            className: `ggp-tab${bottomTab === 'changes' ? ' ggp-tab--active' : ''}`,
            onClick: () => setBottomTab('changes'),
          }, `${t('details.changes')} (${detail.detail?.stats.length ?? 0})`),
        ]),
        h('span', { key: 'sp', className: 'ggp-bottom__spacer' }),
        h(Tip, {
          key: 'fs', label: fullscreen ? t('details.restore') : t('details.fullscreen'),
          children: h('button', {
            type: 'button', className: 'gp-icon-btn',
            onClick: () => setFullscreen((v) => !v),
          }, fullscreen ? '▾' : '▴'),
        }),
        h(Tip, {
          key: 'x', label: t('common.close'),
          children: h('button', { type: 'button', className: 'gp-icon-btn', onClick: closeBottom }, h(CloseIcon, { size: 14 })),
        }),
      ]),
      h('div', { key: 'body', className: 'ggp-bottom__body' },
        bottomTab === 'commit' && selected !== null
          ? renderCommitMeta(selected, detail.detail?.body ?? null, {
            onParent: jumpToParent,
            avatarUrl: authorAvatarUrl(selected.authorEmail, 36, isGitHub),
            t,
          })
          : detail.detail === null
            ? h('div', { className: 'gp-empty' }, detail.detailError ? t('overview.detailFailed') : t('common.loading'))
            : renderFileTree(fileTree, {
              activePath: detail.fileDiff?.path ?? null,
              openTitle: t('overview.openFileDiff'),
              onOpen: (path) => { if (selected !== null) void detail.openFileDiff(path, selected.hash, selected.shortHash) },
            })),
    ]) : null,
    // hover card: full commit message (comment) of the pointed-at commit
    renderHoverCard(detail.hover, detail.hoverBody, t),
  ])
}

const BOTTOM_H_KEY = 'gp.plus.bottom.height'

function readBottomHeight(): number {
  try {
    const v = Number(localStorage.getItem(BOTTOM_H_KEY))
    if (Number.isFinite(v) && v >= 120 && v <= 720) return v
  } catch { /* ignore */ }
  return 280
}

function writeBottomHeight(height: number): void {
  try { localStorage.setItem(BOTTOM_H_KEY, String(height)) } catch { /* ignore */ }
}

interface CommitMetaCbs {
  readonly onParent: (hash: string) => void
  readonly avatarUrl: string | null
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
}

/** Bottom Commit tab: author / date / refs / sha / parents / message. */
function renderCommitMeta(
  commit: GraphCommit,
  body: string | null,
  cb: CommitMetaCbs,
): JSX.Element {
  return h('div', { className: 'ggp-commit' }, [
    h('div', { key: 'subj', className: 'ggp-commit__subject' }, commit.subject),
    h('div', { key: 'meta', className: 'ggp-commit__meta ggp-commit__author' }, [
      cb.avatarUrl !== null ? h('img', {
        key: 'av', className: 'ggp-avatar', src: cb.avatarUrl, alt: '',
        onError: (e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.display = 'none' },
      }) : null,
      h('span', { key: 'a' }, commit.author),
      h('span', { key: 'd', title: absoluteTime(commit.dateIso) }, absoluteDateTime(commit.dateIso)),
      h('span', { key: 'h', className: 'gp-commit-hash', title: commit.hash }, commit.shortHash),
    ]),
    commit.refs.length > 0 ? h('div', { key: 'refs', className: 'ggp-commit__refs' },
      commit.refs.map((r) => h('span', {
        key: `${r.kind}:${r.name}`,
        className: `gp-ref-chip${r.head ? ' gp-ref-chip--head' : ''}${r.kind === 'remote' ? ' gp-ref-chip--remote' : ''}${r.kind === 'tag' ? ' gp-ref-chip--tag' : ''}`,
      }, r.name))) : null,
    commit.parents.length > 0 ? h('div', { key: 'parents', className: 'ggp-commit__parents' }, [
      h('span', { key: 'l', className: 'ggp-commit__label' }, cb.t('details.parents')),
      ...commit.parents.map((p) => h('button', {
        key: p, type: 'button', className: 'gp-commit-hash ggp-parentlink',
        title: p, onClick: () => cb.onParent(p),
      }, p.slice(0, 7))),
    ]) : null,
    body !== null && body !== ''
      ? h('pre', { key: 'body', className: 'ggp-commit__body' }, body)
      : h('div', { key: 'nb', className: 'gp-empty' }, cb.t('overview.noMessage')),
  ])
}

interface HoverCardCbs {
  t: (key: GitKey, params?: Record<string, string | number>) => string
}

/** Floating card showing a commit's full message (comment), anchored near the pointer. */
function renderHoverCard(
  hover: { commit: GraphCommit; x: number; y: number } | null,
  body: string | null,
  t: HoverCardCbs['t'],
): JSX.Element | null {
  if (hover === null || typeof document === 'undefined') return null
  const maxW = 460
  const left = Math.min(hover.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - maxW - 12)
  const top = hover.y + 14
  const card = h('div', { className: 'gp-hovercard', style: { left, top, maxWidth: maxW } }, [
    h('div', { key: 'subj', className: 'gp-hovercard__subject' }, hover.commit.subject),
    h('div', { key: 'meta', className: 'gp-hovercard__meta' }, [
      h('span', { key: 'h', className: 'gp-commit-hash' }, hover.commit.shortHash),
      h('span', { key: 'a' }, hover.commit.author),
    ]),
    body === null
      ? h('div', { key: 'l', className: 'gp-hovercard__loading' }, t('common.loading'))
      : body === ''
        ? h('div', { key: 'e', className: 'gp-hovercard__loading' }, t('overview.noMessage'))
        : h('pre', { key: 'body', className: 'gp-hovercard__body' }, body),
  ])
  return createPortal(card, document.body, 'commit-hovercard')
}

interface PlusRowCbs {
  selected: boolean
  /** True when the commit is off the current branch (dimmed). */
  dimmed: boolean
  /** True for the checked-out (HEAD) commit: bold subject. */
  isHead: boolean
  /** Message start X (unit coords) for this row. */
  margin: number
  /** Resolved rail color of this row's node. */
  nodeColor: string
  localOnly: boolean
  remoteOnly: boolean
  /** Resolved avatar URL (GitHub profile or Gravatar); null shows no avatar. */
  avatarUrl: string | null
  onSelect: () => void
  onMenu: (x: number, y: number) => void
  onCheckout: () => void
  onHoverEnter: (commit: GraphCommit, x: number, y: number) => void
  onHoverLeave: () => void
  now: number
  t: (key: GitKey, params?: Record<string, string | number>) => string
}

/**
 * One overlay SVG for the whole list (git-graph-plus CommitGraph style):
 * continuous rails drawn twice (faint halo + core), merge links as quadratics,
 * one dot per commit. Pointer-transparent so rows keep their clicks.
 */
function renderGraphSvg(full: FullGraphData, width: number): JSX.Element {
  const totalH = full.dots.length * GRAPH_ROW_H
  const els: JSX.Element[] = []
  for (let i = 0; i < full.paths.length; i++) {
    const p = full.paths[i]!
    const d = buildPathD(p.points)
    if (!d) continue
    const color = resolveGraphColor(GRAPH_PALETTE, p.color, p.colorOverride)
    els.push(h('path', { key: `p${i}h`, d, fill: 'none', stroke: color, strokeWidth: 5, opacity: 0.07, strokeLinecap: 'round' }))
    els.push(h('path', { key: `p${i}`, d, fill: 'none', stroke: color, strokeWidth: 2, opacity: 0.85, strokeLinecap: 'round' }))
  }
  for (let i = 0; i < full.links.length; i++) {
    const l = full.links[i]!
    const color = resolveGraphColor(GRAPH_PALETTE, l.color, l.colorOverride)
    const d = `M ${laneX(l.start.x)} ${l.start.y * GRAPH_ROW_H} Q ${laneX(l.control.x)} ${l.control.y * GRAPH_ROW_H}, ${laneX(l.end.x)} ${l.end.y * GRAPH_ROW_H}`
    els.push(h('path', { key: `l${i}h`, d, fill: 'none', stroke: color, strokeWidth: 5, opacity: 0.07, strokeLinecap: 'round' }))
    els.push(h('path', { key: `l${i}`, d, fill: 'none', stroke: color, strokeWidth: 2, opacity: 0.85, strokeLinecap: 'round' }))
  }
  for (let i = 0; i < full.dots.length; i++) {
    const dot = full.dots[i]!
    const color = resolveGraphColor(GRAPH_PALETTE, dot.color, dot.colorOverride)
    const cx = laneX(dot.center.x)
    const cy = dot.center.y * GRAPH_ROW_H
    const bg = 'var(--dsw-alias-bg-layer-1)'
    if (dot.type === 'head') {
      els.push(h('circle', { key: `d${i}`, cx, cy, r: 5, fill: bg, stroke: color, strokeWidth: 2 }))
    } else if (dot.type === 'merge') {
      els.push(h('circle', { key: `d${i}o`, cx, cy, r: 4, fill: bg, stroke: color, strokeWidth: 1.5 }))
      els.push(h('circle', { key: `d${i}i`, cx, cy, r: 2, fill: color }))
    } else {
      els.push(h('circle', { key: `d${i}`, cx, cy, r: 4, fill: color }))
    }
  }
  return h('svg', { key: 'svg', className: 'ggp-lines', width, height: totalH }, els)
}

const REF_TYPE_ORDER: Record<string, number> = { head: 0, branch: 1, 'remote-branch': 2, tag: 3, stash: 4 }

function renderPlusRow(commit: GraphCommit, cb: PlusRowCbs): JSX.Element {
  const badges = [...commit.refs]
    .sort((a, b) => {
      const ta = a.head ? 'head' : a.kind === 'remote' ? 'remote-branch' : a.kind
      const tb = b.head ? 'head' : b.kind === 'remote' ? 'remote-branch' : b.kind
      return (REF_TYPE_ORDER[ta] ?? 4) - (REF_TYPE_ORDER[tb] ?? 4)
    })
    .map((r) => {
      const isHead = r.head
      const isTag = r.kind === 'tag'
      const text = r.name
      return h('span', {
        key: `${r.kind}:${r.name}`,
        className: `gp-ref-badge${isHead ? ' gp-ref-badge--head' : ''}${isTag ? ' gp-ref-badge--fixed' : ''}`,
        style: { '--badge-color': isTag ? '#f0c040' : cb.nodeColor },
        title: text,
      }, text)
    })
  return h('div', {
    key: commit.hash,
    className: `gp-commit-row ggp-row${cb.selected ? ' gp-commit-row--active' : ''}${cb.dimmed ? ' ggp-row--dim' : ''}${cb.isHead ? ' ggp-row--head' : ''}`,
    style: { height: GRAPH_ROW_H, gridTemplateColumns: GRID_TPL },
    onClick: cb.onSelect,
    onDoubleClick: cb.onCheckout,
    onContextMenu: (e: { preventDefault: () => void; clientX: number; clientY: number }) => { e.preventDefault(); cb.onMenu(e.clientX, e.clientY) },
    onMouseEnter: (e: { clientX: number; clientY: number }) => cb.onHoverEnter(commit, e.clientX, e.clientY),
    onMouseLeave: cb.onHoverLeave,
  }, [
    h('div', { key: 'm', className: 'ggp-msg', style: { paddingLeft: cb.margin * GRAPH_X_SCALE + 4 } }, [
      cb.localOnly ? h('span', { key: 'ld', className: 'ggp-localdot', title: cb.t('graph.notPushed') }) : null,
      cb.remoteOnly ? h('span', { key: 'rd', className: 'ggp-remotedot', title: cb.t('graph.remoteOnly') }) : null,
      ...badges,
      h('span', { key: 's', className: 'ggp-subject' }, commit.subject),
    ]),
    h('div', { key: 'a', className: 'gp-commit-author' }, [
      cb.avatarUrl !== null ? h('img', {
        key: 'av', className: 'ggp-avatar', src: cb.avatarUrl, alt: '',
        onError: (e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.display = 'none' },
      }) : null,
      h('span', { key: 'n', className: 'ggp-authorname' }, commit.author),
    ]),
    h('div', { key: 'h', className: 'gp-commit-hash', title: commit.hash }, commit.shortHash),
    h('div', { key: 'd', className: 'gp-commit-date', title: absoluteTime(commit.dateIso) }, timeAgo(commit.dateIso, cb.now, cb.t)),
  ])
}

interface FileTreeCbs {
  activePath: string | null
  openTitle: string
  onOpen: (path: string) => void
}

function renderFileTree(nodes: ReturnType<typeof buildFileTree>, cb: FileTreeCbs): JSX.Element {
  const rows: JSX.Element[] = []
  const walk = (list: ReturnType<typeof buildFileTree>, depth: number): void => {
    for (const node of list) {
      if (node.dir) {
        rows.push(h('div', { key: node.path, className: 'gp-tree-row', style: { paddingLeft: 10 + depth * 14 } }, [
          h(ChevronIcon, { key: 'c', size: 11, open: true }),
          h('span', { key: 'n', className: 'gp-tree-name' }, node.name),
        ]))
        walk(node.children, depth + 1)
      } else {
        const status = String(node.meta ?? 'modified')
        const active = cb.activePath === node.path
        rows.push(h('div', {
          key: node.path,
          className: `gp-tree-row${active ? ' gp-tree-row--active' : ''}`,
          style: { paddingLeft: 10 + depth * 14 },
          title: cb.openTitle,
          onClick: () => cb.onOpen(node.path),
        }, [
          h('span', { key: 'st', className: `gp-status-badge ${statusClass(status)}` }, (statusChar[status] ?? status[0] ?? 'M').toUpperCase()),
          h('span', { key: 'n', className: 'gp-tree-name' }, node.name),
        ]))
      }
    }
  }
  walk(nodes, 0)
  return h('div', {}, rows)
}

interface FileDiffModalCbs {
  text: string | null
  error: boolean
  mode: DiffMode
  onMode: (mode: DiffMode) => void
  expanded: boolean
  onExpand: (expand: boolean) => void
  onClose: () => void
  remote: GitPanelRemote
  sessionId: string
  t: (key: GitKey, params?: Record<string, string | number>) => string
}

/** Centered dialog showing a file's diff within the selected commit. Portaled
 * to document.body so it floats above the whole panel; Esc / backdrop click /
 * the close button dismiss it (Esc is wired by the caller). */
function renderFileDiffModal(
  fileDiff: { path: string; hash: string; shortHash: string } | null,
  cb: FileDiffModalCbs,
): JSX.Element | null {
  if (fileDiff === null || typeof document === 'undefined') return null
  const { text, error, mode, onMode, expanded, onExpand, onClose, remote, sessionId, t } = cb
  const modal = h('div', {
    className: 'gp-modal-backdrop',
    onClick: (e: { target: unknown; currentTarget: unknown }) => { if (e.target === e.currentTarget) onClose() },
  }, h('div', { className: 'gp-modal', role: 'dialog', 'aria-modal': true }, [
    h('div', { key: 'bar', className: 'gp-modal__bar' }, [
      h('span', { key: 'fileicon', className: 'gp-modal__fileicon' }, h(FileIcon, { size: 15 })),
      h('span', { key: 'path', className: 'gp-modal__path', title: fileDiff.path }, renderPathParts(fileDiff.path)),
      h('span', { key: 'hash', className: 'gp-modal__hash' }, fileDiff.shortHash),
      text !== null && text !== '' ? (() => { const s = diffSummary(text); return h('span', { key: 'sum', className: 'gp-modal__sum' }, [h('span', { key: 'a', className: 'gp-stats__add' }, `+${s.add}`), h('span', { key: 'd', className: 'gp-stats__del' }, `\u2212${s.del}`)]) })() : null,
      h('button', {
        key: 'expand', type: 'button',
        className: `gp-seg__btn gp-diff__expand${expanded ? ' gp-seg__btn--active' : ''}`,
        disabled: mode !== 'split' && mode !== 'unified',
        title: t(expanded ? 'diff.collapse' : 'diff.expandAll'),
        onClick: () => onExpand(!expanded),
      }, t(expanded ? 'diff.collapse' : 'diff.expandAll')),
      h('div', { key: 'seg', className: 'gp-seg' },
        segButtons<DiffMode>(['unified', 'split', 'before', 'after'], mode, onMode, (m) => t(`diff.${m}` as GitKey))),
      h(Tip, {
        key: 'close', label: t('common.close'),
        children: h('button', { type: 'button', className: 'gp-icon-btn gp-modal__close', onClick: onClose }, h(CloseIcon, { size: 15 })),
      }),
    ]),
    h('div', { key: 'scroll', className: 'gp-modal__scroll' },
      text === null
        ? h('div', { className: 'gp-empty' }, error ? t('overview.diffFailed') : t('common.loading'))
        : h(DiffView, { text, mode, path: fileDiff.path, remote, sessionId, imageSpec: { base: 'commit', commit: fileDiff.hash }, t })),
  ]))
  return createPortal(modal, document.body, 'file-diff-modal')
}

/** Split a path into a dimmed directory prefix + emphasized file name. */
function renderPathParts(path: string): JSX.Element[] {
  const slash = path.lastIndexOf('/')
  if (slash < 0) return [h('span', { key: 'n', className: 'gp-modal__name' }, path)]
  return [
    h('span', { key: 'd', className: 'gp-modal__dir' }, path.slice(0, slash + 1)),
    h('span', { key: 'n', className: 'gp-modal__name' }, path.slice(slash + 1)),
  ]
}
