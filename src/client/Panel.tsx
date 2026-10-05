/**
 * dsh-git-plus Panel: left Sidebar + right content (Local Changes / All Commits).
 * Views reuse ChangesTab (local) + OverviewTab (commits); FilesTab for non-repo.
 */
import { createElement as h, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { gitPanelRemoteOf, hasSession, type ClientCtx } from './rpc'
import type { GitPanelRemote } from './rpc'
import { useGitView, controllerFor } from './registry'
import { takeSubTab, subscribeSubTab, type SubTab } from './jump'
import { ChangesTab } from './LocalChangesView'
import { OverviewTab } from './AllCommitsView'
import { FilesTab } from './FilesTab'
import { Sidebar, readSidebarWidth, writeSidebarWidth, type SidebarSelection } from './Sidebar'
import { CreateBranchModal } from './modals/CreateBranch'
import { CreateTagModal } from './modals/CreateTag'
import { MergeBranchModal } from './modals/MergeBranch'
import { StashSaveModal } from './modals/StashSave'
import { CheckoutModal, ConfirmModal } from './modals/Confirm'
import type { GitAction } from './types'
import type { GitKey } from './locales'

interface PanelProps {
  readonly ctx: ClientCtx
  readonly sessionId?: string
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
}

type ModalState =
  | { kind: 'branch'; startPoint?: string }
  | { kind: 'tag'; ref?: string }
  | { kind: 'merge'; preset?: string }
  | { kind: 'stash' }
  | { kind: 'checkout'; ref: string; subject: string }
  | { kind: 'confirm'; title: string; message: string; action: GitAction }
  | null

function normalizeSubTab(tab: SubTab | 'overview' | 'changes'): SubTab {
  if (tab === 'overview') return 'commits'
  if (tab === 'changes') return 'local'
  return tab
}

export function Panel({ ctx, sessionId, t }: PanelProps): JSX.Element {
  const [selection, setSelection] = useState<SidebarSelection | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [sideWidth, setSideWidth] = useState<number>(readSidebarWidth)
  const view = useGitView(sessionId)
  const remote = gitPanelRemoteOf(ctx)
  const filesOnly = view.state === 'error' && view.error.code === 'not-a-git-repo'
  const active: SidebarSelection | null = filesOnly
    ? { view: 'files', refFilter: null }
    : selection !== null ? selection : null
  const visited = useRef<{ sessionId?: string; views: Set<string> }>({ views: new Set() })
  if (visited.current.sessionId !== sessionId) visited.current = { sessionId, views: new Set() }
  if (active !== null) visited.current.views.add(active.view)

  useEffect(() => {
    if (!hasSession(sessionId)) return
    if (filesOnly) { setSelection(null); return }
    const pending = takeSubTab(sessionId)
    if (pending !== null) {
      const norm = normalizeSubTab(pending as SubTab)
      setSelection((prev) => prev !== null && (prev as SidebarSelection).view === norm ? prev : { view: norm, refFilter: null })
      return
    }
    // Default: dirty/conflicted -> local, else commits.
    if (view.state === 'ready' && selection === null) {
      const s = view.snapshot
      const toLocal = s.dirty || (s.conflictFiles?.length ?? 0) > 0 || s.operation !== null
      setSelection({ view: toLocal ? 'local' : 'commits', refFilter: null })
    }
  }, [sessionId, view, filesOnly, selection])

  useEffect(() => {
    if (!hasSession(sessionId)) return
    return subscribeSubTab(sessionId, (requested) => {
      const norm = normalizeSubTab(requested as SubTab)
      setSelection((prev) => ({ view: norm, refFilter: prev?.refFilter ?? null }))
    })
  }, [sessionId])

  const refreshKey = view.state === 'ready' ? view.snapshot.checkedAt : 0

  const onAction = async (action: GitAction): Promise<{ ok: boolean; error?: string }> => {
    if (!hasSession(sessionId)) return { ok: false, error: t('error.noCwd') }
    const result = await remote.run({ sessionId, action })
    if (result.ok) {
      controllerFor(sessionId).accept(result.snapshot)
      // Conflicted merge still returns ok:true + conflicted flag -> jump to local.
      if ((result as { conflicted?: boolean }).conflicted === true) {
        setSelection({ view: 'local', refFilter: null })
      }
      return { ok: true }
    }
    return { ok: false, error: errorText(result.error.code, result.error.message, t) }
  }

  const onDividerDown = (e: { preventDefault: () => void; clientX: number }): void => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sideWidth
    const move = (ev: MouseEvent): void => {
      const next = Math.min(480, Math.max(200, startW + ev.clientX - startX))
      setSideWidth(next)
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // Persist width on change (debounced by React batching; cheap localStorage write).
  useEffect(() => { writeSidebarWidth(sideWidth) }, [sideWidth])

  const body = ((): JSX.Element => {
    if (!hasSession(sessionId)) return h('div', { className: 'gp-empty' }, t('error.noCwd'))
    if (view.state === 'no-cwd') return h('div', { className: 'gp-empty' }, t('error.noCwd'))
    if (filesOnly) {
      return h(FilesTab, { key: sessionId, remote, sessionId, t })
    }
    if (view.state === 'error') return h('div', { className: 'gp-empty' }, t('pill.unavailable'))
    if (view.state === 'cold' || view.state === 'loading' || active === null) {
      return h('div', { className: 'gp-empty' }, t('common.loading'))
    }
    const snapshot = view.snapshot
    const showLocal = active.view === 'local'
    const showCommits = active.view === 'commits'
    return h('div', { className: 'gp-plus__main' }, [
      showLocal || visited.current.views.has('local') ? h('div', {
        key: 'local', style: showLocal ? { display: 'contents' } : { display: 'none' },
      }, h('div', { className: 'gp-plus__view' }, [
        snapshot.operation !== null || (snapshot.conflictFiles?.length ?? 0) > 0
          ? h(ConflictBanner, { key: 'cf', remote, sessionId, onAction, t })
          : null,
        h(ChangesTab, { key: `${sessionId}-local`, remote, sessionId, snapshot, onAction, t }),
      ])) : null,
      showCommits || visited.current.views.has('commits') ? h('div', {
        key: 'commits', style: showCommits ? { display: 'contents' } : { display: 'none' },
      }, h(OverviewTab, {
        key: `${sessionId}-commits`, remote, sessionId, refreshKey,
        defaultDiffView: snapshot.defaultDiffView, t,
        externalRef: active.refFilter ?? undefined,
        onBranchAt: (hash) => setModal({ kind: 'branch', startPoint: hash }),
        onTagAt: (hash) => setModal({ kind: 'tag', ref: hash }),
        onCheckoutAt: (hash, subject) => setModal({ kind: 'checkout', ref: hash, subject }),
      })) : null,
    ])
  })()

  const sidebar = ((): JSX.Element | null => {
    if (!hasSession(sessionId)) return null
    if (view.state !== 'ready' || active === null) return null
    return h(Sidebar, {
      remote, sessionId, snapshot: view.snapshot,
      selection: { view: active.view === 'files' ? 'local' : active.view, refFilter: active.refFilter },
      onSelect: (sel) => setSelection(sel),
      onAction, onOpenModal: (kind, preset) => {
        if (kind === 'branch') setModal({ kind: 'branch' })
        else if (kind === 'tag') setModal({ kind: 'tag' })
        else if (kind === 'merge') setModal({ kind: 'merge', preset })
        else setModal({ kind: 'stash' })
      },
      onCheckoutRef: (ref, subject) => setModal({ kind: 'checkout', ref, subject }),
      onDeleteRef: (kind, name) => setModal({
        kind: 'confirm',
        title: t(kind === 'branch' ? 'modal.deleteBranchTitle' : 'modal.deleteTagTitle'),
        message: t('modal.deleteConfirm'),
        action: kind === 'branch' ? { kind: 'delete-branch', name } : { kind: 'delete-tag', name },
      }),
      t,
    })
  })()

  return h('div', { className: 'gp-panel gp-plus', 'data-conversation-composer-overlay': '' }, [
    h('div', { key: 'body', className: 'gp-plus__body' }, [
      sidebar !== null ? h('div', { key: 'side', className: 'gp-plus__side', style: { flex: `0 0 ${sideWidth}px` } }, sidebar) : null,
      sidebar !== null ? h('div', {
        key: 'div', className: 'gp-resizer',
        onMouseDown: onDividerDown as unknown as () => void,
      }) : null,
      h('div', { key: 'content', className: 'gp-plus__content' }, body),
    ]),
    modal !== null ? h('div', { key: 'modal' }, renderModal(modal, { onAction, onClose: () => setModal(null), t })) : null,
  ])
}

function renderModal(
  modal: NonNullable<ModalState>,
  ctx: { onAction: (a: GitAction) => Promise<{ ok: boolean; error?: string }>; onClose: () => void; t: (key: GitKey) => string },
): JSX.Element {
  if (modal.kind === 'branch') return h(CreateBranchModal, { t: ctx.t, onClose: ctx.onClose, onSubmit: ctx.onAction, ...(modal.startPoint !== undefined ? { startPoint: modal.startPoint } : {}) })
  if (modal.kind === 'tag') return h(CreateTagModal, { t: ctx.t, onClose: ctx.onClose, onSubmit: ctx.onAction, ...(modal.ref !== undefined ? { initialRef: modal.ref } : {}) })
  if (modal.kind === 'stash') return h(StashSaveModal, { t: ctx.t, onClose: ctx.onClose, onSubmit: ctx.onAction })
  if (modal.kind === 'checkout') return h(CheckoutModal, { t: ctx.t, refName: modal.ref, subject: modal.subject, onClose: ctx.onClose, onSubmit: ctx.onAction })
  if (modal.kind === 'confirm') return h(ConfirmModal, { t: ctx.t, title: modal.title, message: modal.message, action: modal.action, danger: true, onClose: ctx.onClose, onSubmit: ctx.onAction })
  return h(MergeBranchModal, { t: ctx.t, preset: modal.preset, onClose: ctx.onClose, onSubmit: ctx.onAction })
}

function ConflictBanner(props: {
  readonly remote: GitPanelRemote
  readonly sessionId: string
  readonly onAction: (a: GitAction) => Promise<{ ok: boolean; error?: string }>
  readonly t: (key: GitKey) => string
}): JSX.Element {
  const view = useGitView(props.sessionId)
  if (view.state !== 'ready') return h('div', {})
  const snap = view.snapshot
  const files = snap.conflictFiles ?? []
  const [busy, setBusy] = useState(false)
  const run = async (a: GitAction): Promise<void> => {
    setBusy(true)
    try { await props.onAction(a) } finally { setBusy(false) }
  }
  return h('div', { className: 'gp-conflict' }, [
    h('div', { key: 'h', className: 'gp-conflict__head' }, `${props.t('conflict.title')} (${files.length})`),
    h('div', { key: 'd', className: 'gp-conflict__desc' }, props.t('conflict.desc')),
    h('div', { key: 'f', className: 'gp-conflict__files' },
      files.map((f) => h('div', { key: f, className: 'gp-conflict__file' }, `U ${f}`))),
    h('div', { key: 'ops', className: 'gp-conflict__ops' }, [
      h('button', { key: 'c', type: 'button', className: 'gp-btn--primary', disabled: busy, onClick: () => void run({ kind: 'merge-continue' }) }, props.t('conflict.continue')),
      h('button', { key: 'a', type: 'button', disabled: busy, onClick: () => void run({ kind: 'merge-abort' }) }, props.t('conflict.abort')),
    ]),
  ])
}

function errorText(code: string, message: string | undefined, t: (key: GitKey) => string): string {
  switch (code) {
    case 'empty-message': return t('error.emptyMessage')
    case 'not-a-git-repo': return t('error.notARepo')
    case 'cwd-unavailable': return t('error.noCwd')
    case 'local-changes-block': return t('error.localChangesBlock')
    default: return message ?? t('error.generic')
  }
}
