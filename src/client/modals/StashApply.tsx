/**
 * Apply-stash dialog: applies the stash to the working directory, optionally
 * dropping it afterwards (GitHub Desktop / Tower layout). The checkbox is the
 * only difference between `stash-apply` and `stash-pop`, so one dialog covers
 * both — a conflicting apply keeps the entry either way (`pop` only drops after
 * a clean apply).
 */
import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction, StashEntry } from '../types'
import type { GitKey } from '../locales'
import { StashIcon } from '../icons'
import { ModalFooter, ModalShell } from './shell'

export function StashApplyModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly stash: StashEntry
  /** Pre-check "delete stash after applying" (menu "Pop" opens it checked). */
  readonly dropAfter?: boolean
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [drop, setDrop] = useState(props.dropAfter ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const action: GitAction = drop
      ? { kind: 'stash-pop', index: props.stash.index }
      : { kind: 'stash-apply', index: props.stash.index }
    const res = await props.onSubmit(action)
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.stashApplyTitle'), onClose: props.onClose, children: [
      h('div', { key: 'd', className: 'gp-delbranch__desc' }, props.t('modal.stashApplyDesc')),
      h('div', { key: 's', className: 'gp-stash', title: props.stash.message }, [
        h('span', { key: 'l', className: 'gp-stash__label' }, props.t('modal.stashLabel')),
        h('span', { key: 'i', className: 'gp-delbranch__icon' }, h(StashIcon, { size: 13 })),
        h('span', { key: 'n', className: 'gp-stash__name' }, props.stash.message),
      ]),
      h('label', { key: 'x', className: 'gp-check-row' }, [
        h('input', { key: 'i', type: 'checkbox', checked: drop, onChange: () => setDrop((v) => !v) }),
        ` ${props.t('modal.stashDropAfter')}`,
      ]),
      h('div', { key: 'h', className: 'gp-stash__hint' }, props.t('modal.stashDropAfterHint')),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy,
        confirmLabel: props.t('side.apply'),
      }),
    ],
  })
}
