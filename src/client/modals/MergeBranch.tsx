import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { Field, ModalFooter, ModalShell } from './shell'

export function MergeBranchModal(props: {
  readonly t: (key: GitKey) => string
  readonly preset?: string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [branch, setBranch] = useState(props.preset ?? '')
  const [mode, setMode] = useState<'default' | 'noFf' | 'ffOnly' | 'squash'>('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    if (!branch.trim()) return
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({
      kind: 'merge', branch: branch.trim(),
      ...(mode === 'noFf' ? { noFf: true } : {}),
      ...(mode === 'ffOnly' ? { ffOnly: true } : {}),
      ...(mode === 'squash' ? { squash: true } : {}),
    })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  const radio = (key: typeof mode, label: string): JSX.Element =>
    h('label', { key, className: 'gp-check' }, [
      h('input', { key: 'i', type: 'radio', name: 'merge-mode', checked: mode === key, onChange: () => setMode(key) }),
      ` ${label}`,
    ])
  return h(ModalShell, {
    title: props.t('modal.mergeBranch'), onClose: props.onClose, children: [
      h(Field, {
        key: 'b', label: props.t('modal.target'), children:
          h('input', { type: 'text', value: branch, onChange: (e: { target: { value: string } }) => setBranch(e.target.value) }),
      }),
      h('div', { key: 'm', className: 'gp-radio' }, [
        radio('default', 'default'),
        radio('noFf', props.t('modal.noFf')),
        radio('ffOnly', props.t('modal.ffOnly')),
        radio('squash', props.t('modal.squash')),
      ]),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, { key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy, disabled: !branch.trim() }),
    ],
  })
}
