import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import type { GitKey } from '../locales'

export function ModalShell(props: {
  readonly title: string
  readonly onClose: () => void
  readonly children: JSX.Element | readonly (JSX.Element | null)[]
}): JSX.Element {
  if (typeof document === 'undefined') return h('div', {}, props.children)
  return createPortal(
    h('div', { className: 'gp-modal-backdrop', onClick: (e: { target: unknown; currentTarget: unknown }) => { if (e.target === e.currentTarget) props.onClose() } },
      h('div', { className: 'gp-modal', role: 'dialog' }, [
        h('div', { key: 'h', className: 'gp-modal__head' }, [
          h('span', { key: 't' }, props.title),
          h('button', { key: 'x', type: 'button', className: 'gp-modal__x', onClick: props.onClose }, '×'),
        ]),
        h('div', { key: 'b', className: 'gp-modal__body' }, props.children),
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
}): JSX.Element {
  return h('div', { className: 'gp-modal__foot' }, [
    h('button', { key: 'c', type: 'button', onClick: props.onClose }, props.t('modal.cancel')),
    h('button', {
      key: 'ok', type: 'button', className: 'gp-btn--primary',
      disabled: props.busy || props.disabled === true, onClick: props.onConfirm,
    }, props.t('modal.confirm')),
  ])
}

export function useModalText(initial = ''): [string, (v: string) => void] {
  const [v, setV] = useState(initial)
  return [v, setV]
}
