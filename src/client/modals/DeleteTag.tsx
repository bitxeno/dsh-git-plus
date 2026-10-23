import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { TagIcon } from '../icons'
import { ModalFooter, ModalShell } from './shell'

/** GitHub Desktop-style delete-tag confirmation with an opt-in remote delete. */
export function DeleteTagModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly tagName: string
  readonly remotes: readonly string[]
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [alsoRemote, setAlsoRemote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({
      kind: 'delete-tag',
      name: props.tagName,
      ...(alsoRemote && props.remotes.length > 0 ? { remotes: props.remotes } : {}),
    })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }

  return h(ModalShell, {
    title: props.t('modal.deleteTagTitle'),
    onClose: props.onClose,
    children: [
      h('div', { key: 'd', className: 'gp-delbranch__desc' }, props.t('modal.deleteTagDesc')),
      h('div', { key: 'r', className: 'gp-delbranch', title: props.tagName }, [
        h('span', { key: 'l', className: 'gp-delbranch__label' }, props.t('modal.deleteTagLabel')),
        h('span', { key: 'i', className: 'gp-delbranch__icon' }, h(TagIcon, { size: 13 })),
        h('span', { key: 'n', className: 'gp-delbranch__name' }, props.tagName),
      ]),
      props.remotes.length > 0 ? h('label', { key: 'remote', className: 'gp-check-row' }, [
        h('input', {
          key: 'check',
          type: 'checkbox',
          checked: alsoRemote,
          disabled: busy,
          onChange: () => setAlsoRemote((value) => !value),
        }),
        h('span', { key: 'label' }, props.t('modal.deleteTagRemote')),
      ]) : null,
      error !== null ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy,
        confirmLabel: props.t('modal.deleteTagAction'),
      }),
    ],
  })
}
