/**
 * Edit-remote dialog (Tower-style Remote sheet, our dialog metrics): rename
 * the remote, rewrite its URL, switch the URL between SSH and HTTPS shapes,
 * and probe the endpoint before saving.
 */
import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import { queryAs, type GitPanelRemote } from '../rpc'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { DropSelect } from '../DropSelect'
import { convertRemoteUrl, detectRemoteProtocol, type RemoteProtocol } from '../remote-url'
import { Field, ModalFooter, ModalShell } from './shell'

type TestState =
  | { readonly status: 'idle' }
  | { readonly status: 'testing' }
  | { readonly status: 'ok' }
  | { readonly status: 'fail'; readonly message: string }

export function EditRemoteModal(props: {
  readonly remote: GitPanelRemote
  readonly sessionId: string
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly remoteName: string
  readonly remoteUrl: string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [name, setName] = useState(props.remoteName)
  const [url, setUrl] = useState(props.remoteUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const trimmedName = name.trim()
  const trimmedUrl = url.trim()
  const dirty = trimmedName !== props.remoteName || trimmedUrl !== props.remoteUrl
  const protocol = detectRemoteProtocol(url)

  const switchProtocol = (target: RemoteProtocol): void => {
    const next = convertRemoteUrl(url, target)
    if (next !== null) {
      setUrl(next)
      setTest({ status: 'idle' })
    }
  }

  const testConnection = async (): Promise<void> => {
    if (trimmedUrl === '' || test.status === 'testing') return
    setTest({ status: 'testing' })
    const res = await props.remote.query({ sessionId: props.sessionId, query: { kind: 'remote-test', url: trimmedUrl } })
    if (!res.ok) {
      setTest({ status: 'fail', message: res.error.message ?? props.t('modal.connectionFailed') })
      return
    }
    const v = queryAs(res, 'remote-test')
    if (v !== null && v.reachable) setTest({ status: 'ok' })
    else setTest({ status: 'fail', message: v?.message ?? props.t('modal.connectionFailed') })
  }

  const submit = async (): Promise<void> => {
    if (trimmedName === '' || trimmedUrl === '' || !dirty) return
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({ kind: 'edit-remote', oldName: props.remoteName, newName: trimmedName, url: trimmedUrl })
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }

  return h(ModalShell, {
    title: props.t('modal.editRemote'), onClose: props.onClose, children: [
      h('div', { key: 'd', className: 'gp-modal__subject' }, props.t('modal.editRemoteDesc')),
      h(Field, {
        key: 'n', label: props.t('modal.remote'), children:
          h('input', {
            type: 'text', value: name, autoFocus: true,
            onChange: (e: { target: { value: string } }) => { setName(e.target.value); setTest({ status: 'idle' }) },
            onKeyDown: (e: { key: string }) => { if (e.key === 'Enter') void submit() },
          }),
      }),
      h(Field, {
        key: 'u', label: props.t('modal.repositoryUrl'), children:
          h('div', { className: 'gp-remote-url' }, [
            h('input', {
              key: 'i', type: 'text', value: url, placeholder: 'git@github.com:owner/repo.git',
              onChange: (e: { target: { value: string } }) => { setUrl(e.target.value); setTest({ status: 'idle' }) },
              onKeyDown: (e: { key: string }) => { if (e.key === 'Enter') void submit() },
            }),
            protocol !== null ? h(DropSelect, {
              key: 'p', value: protocol,
              options: [
                { value: 'ssh', label: 'SSH' },
                { value: 'https', label: 'HTTPS' },
              ],
              onChange: (v: string) => { if (v === 'ssh' || v === 'https') switchProtocol(v) },
            }) : null,
          ]),
      }),
      h('div', { key: 't', className: 'gp-modal__test' }, [
        h('button', {
          key: 'b', type: 'button', className: 'gp-modal__link',
          disabled: trimmedUrl === '' || test.status === 'testing',
          onClick: () => void testConnection(),
        }, test.status === 'testing' ? props.t('modal.testingConnection') : props.t('modal.testConnection')),
        test.status === 'ok'
          ? h('span', { key: 's', className: 'gp-modal__ok' }, props.t('modal.connectionOk'))
          : test.status === 'fail'
            ? h('span', { key: 's', className: 'gp-modal__err', title: test.message }, `${props.t('modal.connectionFailed')}${test.message !== '' ? `: ${test.message}` : ''}`)
            : null,
      ]),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, onConfirm: () => void submit(),
        busy, disabled: trimmedName === '' || trimmedUrl === '' || !dirty,
        confirmLabel: props.t('modal.save'),
      }),
    ],
  })
}
