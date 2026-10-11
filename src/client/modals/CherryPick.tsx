/**
 * Cherry-pick dialog (Tower-style sheet, our dialog metrics): apply one
 * commit onto the current branch, optionally leaving the changes staged
 * (`--no-commit`) and/or recording the source in the message (`-x`).
 */
import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { CommitIcon } from '../icons'
import { Field, ModalFooter, ModalShell } from './shell'

export function CherryPickModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  /** Full commit hash (`refName`: never `ref` — a string `ref` prop on a
   * function component throws React #290, legacy string-ref coercion). */
  readonly refName: string
  readonly shortHash: string
  readonly subject: string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [commit, setCommit] = useState(true)
  const [appendOrigin, setAppendOrigin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({
      kind: 'cherry-pick', ref: props.refName,
      ...(commit ? {} : { noCommit: true }),
      ...(commit && appendOrigin ? { recordOrigin: true } : {}),
    })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.cherryPick'), onClose: props.onClose, children: [
      h('div', { key: 'd', className: 'gp-delbranch__desc' }, props.t('modal.cherryPickDesc')),
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
      h('label', { key: 'ao', className: 'gp-check-row' }, [
        h('input', {
          key: 'i', type: 'checkbox', checked: commit && appendOrigin, disabled: !commit,
          onChange: () => setAppendOrigin((v) => !v),
        }),
        h('span', { key: 't' }, props.t('modal.appendOrigin')),
      ]),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(),
        busy, confirmLabel: props.t('modal.cherryPickBtn'),
      }),
    ],
  })
}
