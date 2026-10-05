import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { Field, ModalFooter, ModalShell } from './shell'

export function StashSaveModal(props: {
  readonly t: (key: GitKey) => string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [message, setMessage] = useState('')
  const [untracked, setUntracked] = useState(false)
  const [keepIndex, setKeepIndex] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({
      kind: 'stash-save',
      ...(message.trim() ? { message: message.trim() } : {}),
      ...(untracked ? { includeUntracked: true } : {}),
      ...(keepIndex ? { keepIndex: true } : {}),
    })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.stashSave'), onClose: props.onClose, children: [
      h(Field, {
        key: 'm', label: props.t('modal.message'), children:
          h('input', { type: 'text', value: message, onChange: (e: { target: { value: string } }) => setMessage(e.target.value) }),
      }),
      h('label', { key: 'u', className: 'gp-check-row' }, [
        h('input', { key: 'i', type: 'checkbox', checked: untracked, onChange: () => setUntracked((v) => !v) }),
        ` ${props.t('modal.includeUntracked')}`,
      ]),
      h('label', { key: 'k', className: 'gp-check-row' }, [
        h('input', { key: 'i', type: 'checkbox', checked: keepIndex, onChange: () => setKeepIndex((v) => !v) }),
        ` ${props.t('modal.keepIndex')}`,
      ]),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, { key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy }),
    ],
  })
}
