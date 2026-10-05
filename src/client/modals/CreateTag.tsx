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
  const [ref, setRef] = useState(props.initialRef ?? '')
  const [message, setMessage] = useState('')
  const [annotated, setAnnotated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({
      kind: 'create-tag', name: name.trim(),
      ...(ref.trim() ? { ref: ref.trim() } : {}),
      ...(annotated && message.trim() ? { message: message.trim() } : {}),
    })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.createTag'), onClose: props.onClose, children: [
      props.initialRef !== undefined && props.initialRef !== '' ? h('div', { key: 'at', className: 'gp-modal__subject' }, `${props.t('modal.createAt')}: ${props.initialRef}`) : null,
      h(Field, {
        key: 'n', label: props.t('modal.name'), children:
          h('input', { type: 'text', value: name, placeholder: 'v0.1.0', onChange: (e: { target: { value: string } }) => setName(e.target.value) }),
      }),
      h(Field, {
        key: 'r', label: props.t('modal.ref'), children:
          h('input', { type: 'text', value: ref, onChange: (e: { target: { value: string } }) => setRef(e.target.value) }),
      }),
      h('label', { key: 'a', className: 'gp-check' }, [
        h('input', { key: 'i', type: 'checkbox', checked: annotated, onChange: () => setAnnotated((v) => !v) }),
        ` ${props.t('modal.annotated')}`,
      ]),
      annotated ? h(Field, {
        key: 'm', label: props.t('modal.message'), children:
          h('input', { type: 'text', value: message, onChange: (e: { target: { value: string } }) => setMessage(e.target.value) }),
      }) : null,
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, { key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy, disabled: !name.trim() }),
    ],
  })
}
