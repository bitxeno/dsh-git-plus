/**
 * Create Patch dialog: export one commit as a mail-formatted patch file
 * (`git format-patch -1 --stdout`) and download it as `<shortHash>.patch`.
 */
import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import type { GitKey } from '../locales'
import type { GitPanelRemote } from '../rpc'
import { queryAs } from '../rpc'
import { downloadTextFile } from '../download'
import { CommitIcon } from '../icons'
import { Field, ModalFooter, ModalShell } from './shell'

export function CreatePatchModal(props: {
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly remote: GitPanelRemote
  readonly sessionId: string
  /** Full commit hash (never a `ref` prop: React #290 string-ref coercion). */
  readonly refName: string
  readonly shortHash: string
  readonly subject: string
  readonly onClose: () => void
}): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await props.remote.query({ sessionId: props.sessionId, query: { kind: 'commit-patch', ref: props.refName } })
    setBusy(false)
    const patch = queryAs(res, 'commit-patch')
    if (patch === null || patch.text === '') { setError(props.t('menu.patchEmpty')); return }
    // Never hand out a silently clipped patch: report it instead of saving.
    if (patch.truncated) { setError(props.t('menu.patchTruncated')); return }
    downloadTextFile(`${props.shortHash}.patch`, patch.text)
    props.onClose()
  }
  return h(ModalShell, {
    title: props.t('modal.createPatch'), onClose: props.onClose, children: [
      h('div', { key: 'd', className: 'gp-delbranch__desc' }, props.t('modal.createPatchDesc')),
      h(Field, {
        key: 'r', label: props.t('modal.revision'), children:
          h('div', { className: 'gp-delbranch' }, [
            h('span', { key: 'i', className: 'gp-delbranch__icon' }, h(CommitIcon, { size: 13 })),
            h('span', { key: 'n', className: 'gp-delbranch__name' }, `@ ${props.shortHash} ${props.subject}`.trim()),
          ]),
      }),
      error !== null ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void save(),
        busy, confirmLabel: props.t('modal.save'),
      }),
    ],
  })
}
