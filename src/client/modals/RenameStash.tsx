import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction, StashEntry } from '../types'
import type { GitKey } from '../locales'
import { Field, ModalFooter, ModalShell } from './shell'

/**
 * Rename a stash entry. `git stash` has no rename command, so the host rewrites
 * the message of that entry's stash reflog line — the same text the list shows.
 */
export function RenameStashModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly stash: StashEntry
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [name, setName] = useState(props.stash.message)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = name.trim()
  const submit = async (): Promise<void> => {
    if (!trimmed || trimmed === props.stash.message) return
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({ kind: 'stash-rename', index: props.stash.index, message: trimmed })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.stashRenameTitle'), onClose: props.onClose, children: [
      h(Field, {
        key: 'n', label: props.t('modal.message'), children:
          h('input', {
            type: 'text', value: name, placeholder: props.stash.message,
            onChange: (e: { target: { value: string } }) => setName(e.target.value),
            onKeyDown: (e: { key: string }) => { if (e.key === 'Enter') void submit() },
          }),
      }),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy,
        confirmLabel: props.t('modal.save'), disabled: !trimmed || trimmed === props.stash.message,
      }),
    ],
  })
}
