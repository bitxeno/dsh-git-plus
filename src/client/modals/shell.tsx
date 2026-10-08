import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import type { GitKey } from '../locales'

export function ModalShell(props: {
  readonly title: string
  readonly onClose: () => void
  readonly children: JSX.Element | readonly (JSX.Element | null)[]
  /** Wider card for content previews (default 380px fits forms). */
  readonly wide?: boolean
}): JSX.Element {
  if (typeof document === 'undefined') return h('div', {}, props.children)
  return createPortal(
    h('div', { className: 'gp-dialog-backdrop', onClick: (e: { target: unknown; currentTarget: unknown }) => { if (e.target === e.currentTarget) props.onClose() } },
      h('div', { className: `gp-dialog${props.wide === true ? ' gp-dialog--wide' : ''}`, role: 'dialog' }, [
        h('div', { key: 'h', className: 'gp-dialog__head' }, [
          h('h2', { key: 't', className: 'gp-dialog__title' }, props.title),
          h('button', { key: 'x', type: 'button', className: 'gp-dialog__x', onClick: props.onClose, 'aria-label': '×' }, '×'),
        ]),
        h('div', { key: 'b', className: 'gp-dialog__body' }, props.children),
      ])),
    document.body,
  )
}

export function Field(props: { readonly label: string; readonly children: JSX.Element }): JSX.Element {
  return h('label', { className: 'gp-field' }, [
    h('span', { key: 'l', className: 'gp-field__label' }, props.label),
    props.children,
  ])
}

export function ModalFooter(props: {
  readonly t: (key: GitKey) => string
  readonly onClose: () => void
  readonly onConfirm: () => void
  readonly busy: boolean
  readonly disabled?: boolean
  /** Confirm-button label; the generic confirm key when absent. */
  readonly confirmLabel?: string
}): JSX.Element {
  return h('div', { className: 'gp-dialog__foot' }, [
    h('button', { key: 'c', type: 'button', className: 'gp-btn', onClick: props.onClose }, props.t('modal.cancel')),
    h('button', {
      key: 'ok', type: 'button', className: 'gp-btn gp-btn--primary',
      disabled: props.busy || props.disabled === true, onClick: props.onConfirm,
    }, [
      props.busy ? h('span', { key: 's', className: 'gp-spin', 'aria-hidden': 'true' }) : null,
      props.confirmLabel ?? props.t('modal.confirm'),
    ]),
  ])
}

export function useModalText(initial = ''): [string, (v: string) => void] {
  const [v, setV] = useState(initial)
  return [v, setV]
}
