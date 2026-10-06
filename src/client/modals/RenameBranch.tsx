import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { Field, ModalFooter, ModalShell } from './shell'

export function RenameBranchModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly oldName: string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [name, setName] = useState(props.oldName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = name.trim()
  const submit = async (): Promise<void> => {
    if (!trimmed || trimmed === props.oldName) return
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({ kind: 'rename-branch', oldName: props.oldName, newName: trimmed })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.renameBranch', { name: props.oldName }), onClose: props.onClose, children: [
      h(Field, {
        key: 'n', label: props.t('modal.newName'), children:
          h('input', {
            type: 'text', value: name, placeholder: props.oldName,
            onChange: (e: { target: { value: string } }) => setName(e.target.value),
            onKeyDown: (e: { key: string }) => { if (e.key === 'Enter') void submit() },
          }),
      }),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, { key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy, disabled: !trimmed || trimmed === props.oldName }),
    ],
  })
}
