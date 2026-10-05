import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { ModalFooter, ModalShell } from './shell'

/** Generic danger/confirm dialog (used for delete-branch / delete-tag). */
export function ConfirmModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly title: string
  readonly message: string
  readonly action: GitAction
  readonly danger?: boolean
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await props.onSubmit(props.action)
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.title, onClose: props.onClose, children: [
      h('div', { key: 'm', className: props.danger === true ? 'gp-modal__warn' : '' }, props.message),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, { key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy }),
    ],
  })
}

/**
 * Detached-HEAD checkout confirmation (double-clicked tag / commit).
 * Runs `git checkout <ref>` after an explicit confirm.
 */
export function CheckoutModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly refName: string
  readonly subject: string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({ kind: 'branch-checkout', name: props.refName })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.checkoutTitle'), onClose: props.onClose, children: [
      h('div', { key: 'm', className: 'gp-modal__warn' }, props.t('modal.checkoutDetached', { ref: props.refName })),
      props.subject !== '' ? h('div', { key: 's', className: 'gp-modal__subject' }, props.subject) : null,
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, { key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy }),
    ],
  })
}
