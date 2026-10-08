import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { ModalFooter, ModalShell } from './shell'
import { BranchIcon, GitHubIcon } from '../icons'

/**
 * Delete-branch confirmation (GitHub Desktop style, our dialog metrics):
 * branch ref row plus, when the branch exists on a remote, a checkbox to
 * also delete it there (`git push <remote> --delete`). Local-only branches
 * skip the checkbox entirely.
 */
export function DeleteBranchModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly branchName: string
  /** Remote to also delete from (`origin`), or null for local-only branches. */
  readonly remote: string | null
  readonly remoteIsGitHub: boolean
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alsoRemote, setAlsoRemote] = useState(false)
  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({
      kind: 'delete-branch', name: props.branchName,
      ...(alsoRemote && props.remote !== null ? { remote: props.remote } : {}),
    })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return h(ModalShell, {
    title: props.t('modal.deleteBranchTitle'), onClose: props.onClose, children: [
      h('div', { key: 'd', className: 'gp-delbranch__desc' }, props.t('modal.deleteBranchDesc')),
      h('div', { key: 'b', className: 'gp-delbranch' }, [
        h('span', { key: 'i', className: 'gp-delbranch__icon' }, h(BranchIcon, { size: 13 })),
        h('span', { key: 'n', className: 'gp-delbranch__name' }, props.branchName),
      ]),
      props.remote !== null ? h('label', { key: 'r', className: 'gp-check-row' }, [
        h('input', { key: 'c', type: 'checkbox', checked: alsoRemote, onChange: () => setAlsoRemote((v) => !v) }),
        h('span', { key: 't' }, props.t('modal.deleteRemoteToo')),
        h('span', { key: 'i', className: 'gp-delbranch__icon' }, props.remoteIsGitHub ? h(GitHubIcon, { size: 13 }) : h(BranchIcon, { size: 13 })),
        h('span', { key: 'n', className: 'gp-delbranch__name' }, `${props.remote}/${props.branchName}`),
      ]) : null,
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, { key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(), busy, confirmLabel: props.t('side.delete') }),
    ],
  })
}
