/**
 * Reset-branch dialog: move the current branch pointer to the selected
 * commit, with the usual Soft / Mixed / Hard modes. Hard is destructive and
 * carries an explicit warning.
 */
import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { CommitIcon } from '../icons'
import { Field, ModalFooter, ModalShell } from './shell'

export type ResetMode = 'soft' | 'mixed' | 'hard'

export function ResetBranchModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly branch: string
  readonly refName: string
  readonly shortHash: string
  readonly subject: string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [mode, setMode] = useState<ResetMode>('mixed')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({ kind: 'reset-branch', ref: props.refName, mode })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  const modes: readonly ResetMode[] = ['soft', 'mixed', 'hard']
  return h(ModalShell, {
    title: props.t('modal.resetBranch', { branch: props.branch }), onClose: props.onClose, children: [
      h('div', { key: 'b', className: 'gp-delbranch' }, [
        h('span', { key: 'i', className: 'gp-delbranch__icon' }, h(CommitIcon, { size: 13 })),
        h('span', { key: 'n', className: 'gp-delbranch__name' }, `${props.shortHash} ${props.subject}`.trim()),
      ]),
      h(Field, {
        key: 'm', label: '', children: h('div', { className: 'gp-radio', role: 'radiogroup' }, modes.map((m) =>
          h('label', { key: m, className: 'gp-check-row' }, [
            h('input', {
              key: 'i', type: 'radio', name: 'gp-reset-mode', checked: mode === m,
              onChange: () => setMode(m),
            }),
            h('span', { key: 't' }, props.t(m === 'soft' ? 'modal.resetSoft' : m === 'mixed' ? 'modal.resetMixed' : 'modal.resetHard')),
          ]))),
      }),
      mode === 'hard' ? h('div', { key: 'w', className: 'gp-modal__warn' }, props.t('modal.resetHardWarn')) : null,
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(),
        busy, confirmLabel: props.t('modal.resetBtn'),
      }),
    ],
  })
}
