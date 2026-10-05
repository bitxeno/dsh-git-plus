import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { Field, ModalFooter, ModalShell } from './shell'

export function CreateBranchModal(props: {
  readonly t: (key: GitKey) => string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
  readonly startPoint?: string
}): JSX.Element {
  const [name, setName] = useState('')
  const [start, setStart] = useState(props.startPoint ?? '')
  const [checkout, setCheckout] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({
      kind: 'create-branch', name: name.trim(),
      ...(start.trim() ? { startPoint: start.trim() } : {}),
      ...(checkout ? { checkout: true } : {}),
    })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.createBranch'), onClose: props.onClose, children: [
      props.startPoint !== undefined && props.startPoint !== '' ? h('div', { key: 'at', className: 'gp-modal__subject' }, `${props.t('modal.createAt')}: ${props.startPoint}`) : null,
      h(Field, {
        key: 'n', label: props.t('modal.name'), children:
          h('input', { type: 'text', value: name, placeholder: 'feature/xxx', onChange: (e: { target: { value: string } }) => setName(e.target.value) }),
      }),
      h(Field, {
        key: 's', label: props.t('modal.startPoint'), children:
          h('input', { type: 'text', value: start, onChange: (e: { target: { value: string } }) => setStart(e.target.value) }),
      }),
      h('label', { key: 'c', className: 'gp-check' }, [
        h('input', { key: 'i', type: 'checkbox', checked: checkout, onChange: () => setCheckout((v) => !v) }),
        ' checkout (-b)',
      ]),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, { key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy, disabled: !name.trim() }),
    ],
  })
}
