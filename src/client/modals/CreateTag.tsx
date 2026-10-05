import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { Field, ModalFooter, ModalShell } from './shell'

export function CreateTagModal(props: {
  readonly t: (key: GitKey) => string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
  readonly initialRef?: string
}): JSX.Element {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [push, setPush] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The target ref is not editable: the preset from the entry point (commit
  // row / branch / tag) is always used, defaulting to HEAD when absent. The
  // read-only line below is the only place it shows.
  const ref = (props.initialRef ?? '').trim()
  const target = ref === '' ? 'HEAD' : ref
  const submit = async (): Promise<void> => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({
      kind: 'create-tag', name: name.trim(),
      ...(ref !== '' ? { ref } : {}),
      // A non-empty message makes the tag annotated (-a -m); empty stays lightweight.
      ...(message.trim() !== '' ? { message: message.trim() } : {}),
      ...(push ? { push: true } : {}),
    })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.createTag'), onClose: props.onClose, children: [
      h('div', { key: 'at', className: 'gp-modal__subject' }, `${props.t('modal.createAt')}: ${target}`),
      h(Field, {
        key: 'n', label: props.t('modal.name'), children:
          h('input', { type: 'text', value: name, placeholder: 'v0.1.0', onChange: (e: { target: { value: string } }) => setName(e.target.value) }),
      }),
      h(Field, {
        key: 'm', label: props.t('modal.message'), children:
          h('input', { type: 'text', value: message, placeholder: props.t('modal.messageOptional'), onChange: (e: { target: { value: string } }) => setMessage(e.target.value) }),
      }),
      h('label', { key: 'p', className: 'gp-check-row' }, [
        h('input', { key: 'i', type: 'checkbox', checked: push, onChange: () => setPush((v) => !v) }),
        ` ${props.t('modal.pushToRemote')}`,
      ]),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, { key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy, disabled: !name.trim() }),
    ],
  })
}
