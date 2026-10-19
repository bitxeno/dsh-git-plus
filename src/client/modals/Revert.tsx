/**
 * Revert dialog (Tower-style sheet, our dialog metrics): create a new commit
 * that undoes the selected commit, optionally leaving the changes staged
 * (`--no-commit`). A pre-flight `merge-tree` probe warns when the revert would
 * conflict, so the user knows before running it.
 */
import { createElement as h, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import type { GitPanelRemote } from '../rpc'
import { queryAs } from '../rpc'
import { CommitIcon } from '../icons'
import { Field, ModalFooter, ModalShell } from './shell'

type ConflictState =
  | { kind: 'checking' }
  | { kind: 'ok' }
  | { kind: 'warn'; files: readonly string[] }
  /** Probe unavailable (old git / transient failure): show no status. */
  | { kind: 'unknown' }

export function RevertModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly remote: GitPanelRemote
  readonly sessionId: string
  /** Full commit hash (never a `ref` prop: React #290 string-ref coercion). */
  readonly refName: string
  readonly shortHash: string
  readonly subject: string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [commit, setCommit] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ConflictState>({ kind: 'checking' })

  useEffect(() => {
    let alive = true
    setConflicts({ kind: 'checking' })
    void props.remote.query({ sessionId: props.sessionId, query: { kind: 'revert-conflicts', ref: props.refName } }).then((res) => {
      if (!alive) return
      const v = queryAs(res, 'revert-conflicts')
      if (v === null || !v.available) { setConflicts({ kind: 'unknown' }); return }
      setConflicts(v.hasConflict ? { kind: 'warn', files: v.files } : { kind: 'ok' })
    }).catch(() => { if (alive) setConflicts({ kind: 'unknown' }) })
    return () => { alive = false }
  }, [props.remote, props.sessionId, props.refName])

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({
      kind: 'revert', ref: props.refName,
      ...(commit ? {} : { noCommit: true }),
    })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }

  const status = ((): JSX.Element | null => {
    if (conflicts.kind === 'unknown') return null
    if (conflicts.kind === 'checking') {
      return h('span', { className: 'gp-revert-status' }, [
        h('span', { key: 's', className: 'gp-spin', 'aria-hidden': 'true' }),
        h('span', { key: 't' }, props.t('modal.revertChecking')),
      ])
    }
    if (conflicts.kind === 'warn') {
      return h('span', { className: 'gp-revert-status gp-revert-status--warn' }, props.t('modal.revertConflictWarn', { n: String(conflicts.files.length) }))
    }
    return h('span', { className: 'gp-revert-status gp-revert-status--ok' }, props.t('modal.revertNoConflict'))
  })()

  return h(ModalShell, {
    title: props.t('modal.revert'), onClose: props.onClose, children: [
      h('div', { key: 'd', className: 'gp-delbranch__desc' }, props.t('modal.revertDesc')),
      h(Field, {
        key: 'c', label: props.t('modal.commitToApply'), children:
          h('div', { className: 'gp-delbranch' }, [
            h('span', { key: 'i', className: 'gp-delbranch__icon' }, h(CommitIcon, { size: 13 })),
            h('span', { key: 'n', className: 'gp-delbranch__name' }, `${props.shortHash} ${props.subject}`.trim()),
          ]),
      }),
      h('label', { key: 'cc', className: 'gp-check-row' }, [
        h('input', { key: 'i', type: 'checkbox', checked: commit, onChange: () => setCommit((v) => !v) }),
        h('span', { key: 't' }, props.t('modal.commitChanges')),
      ]),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(),
        busy, confirmLabel: props.t('modal.revertBtn'),
        ...(status !== null ? { leading: status } : {}),
      }),
    ],
  })
}
