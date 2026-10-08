import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { Field, ModalFooter, ModalShell } from './shell'
import { BranchIcon } from '../icons'

/**
 * Track-remote-branch dialog (Tower style, our dialog metrics): shows the
 * remote ref and an editable local name prefilled minus the remote prefix.
 * A local name collision blocks confirm with an inline prompt (the host
 * would reject it anyway); the created branch explicitly `--track`s.
 */
export function TrackRemoteModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly remoteName: string
  readonly defaultLocalName: string
  readonly localNames: readonly string[]
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [name, setName] = useState(props.defaultLocalName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = name.trim()
  const exists = trimmed !== '' && props.localNames.includes(trimmed)
  const submit = async (): Promise<void> => {
    if (trimmed === '' || exists) return
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({ kind: 'create-branch', name: trimmed, startPoint: props.remoteName, track: true })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.trackRemote'), onClose: props.onClose, children: [
      h('div', { key: 'd', className: 'gp-delbranch__desc' }, props.t('modal.trackRemoteDesc')),
      h(Field, {
        key: 'r', label: props.t('modal.remoteBranch'), children:
          h('div', { className: 'gp-delbranch' }, [
            h('span', { key: 'i', className: 'gp-delbranch__icon' }, h(BranchIcon, { size: 13 })),
            h('span', { key: 'n', className: 'gp-delbranch__name' }, props.remoteName),
          ]),
      }),
      h(Field, {
        key: 'l', label: props.t('modal.localBranch'), children:
          h('input', {
            type: 'text', value: name, autoFocus: true,
            onChange: (e: { target: { value: string } }) => setName(e.target.value),
            onFocus: (e: { target: { select: () => void } }) => e.target.select(),
          }),
      }),
      exists ? h('div', { key: 'w', className: 'gp-modal__err' }, props.t('modal.branchExists')) : null,
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(),
        busy, disabled: trimmed === '' || exists, confirmLabel: props.t('modal.track'),
      }),
    ],
  })
}
