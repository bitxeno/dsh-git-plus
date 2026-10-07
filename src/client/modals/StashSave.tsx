import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { Field, ModalFooter, ModalShell } from './shell'

export function StashSaveModal(props: {
  readonly t: (key: GitKey) => string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
  /** Stash only these paths (whole work tree when absent). */
  readonly paths?: readonly string[]
  /** Pre-check "include untracked" (set when paths contain untracked files). */
  readonly defaultUntracked?: boolean
}): JSX.Element {
  const [message, setMessage] = useState('')
  const [untracked, setUntracked] = useState(props.defaultUntracked ?? false)
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
      ...(props.paths !== undefined && props.paths.length > 0 ? { paths: [...props.paths] } : {}),
    })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.stashSave'), onClose: props.onClose, children: [
      props.paths !== undefined && props.paths.length > 0 ? h('div', { key: 'scope' }, [
        h('div', { key: 'h', className: 'gp-modal__subject' }, props.t('modal.stashPathsHint')),
        h('div', { key: 'n', className: 'gp-modal__subject', title: props.paths.join('\n') }, `${props.paths.length} files: ${props.paths.slice(0, 5).join(', ')}${props.paths.length > 5 ? ', …' : ''}`),
      ]) : null,
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
