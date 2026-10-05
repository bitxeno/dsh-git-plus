/**
 * Fetch / Pull / Push dialogs (sidebar sync toolbar). All three load the same
 * `branches` query for configured remotes and branch lists, submit one host
 * action, and close on success — git failures surface inline above the footer.
 */
import { createElement as h, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { queryAs, type GitPanelRemote } from '../rpc'
import type { GitAction, GitBranch } from '../types'
import type { GitKey } from '../locales'
import { BranchIcon } from '../icons'
import { Field, ModalFooter, ModalShell } from './shell'

interface BranchData {
  readonly current: string | null
  readonly local: readonly GitBranch[]
  readonly remoteBranches: readonly GitBranch[]
  readonly remotes: readonly string[]
}

function useBranchData(remote: GitPanelRemote, sessionId: string): BranchData | null {
  const [data, setData] = useState<BranchData | null>(null)
  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await remote.query({ sessionId, query: { kind: 'branches' } })
      const b = queryAs(res, 'branches')
      if (!alive) return
      setData({
        current: b?.current ?? null,
        local: b?.local ?? [],
        remoteBranches: b?.remote ?? [],
        // Older hosts predate the remotes field; derive a fallback from the
        // remote-tracking refs so the dialogs stay usable either way.
        remotes: b?.remotes ?? [...new Set((b?.remote ?? []).map((r) => r.name.split('/')[0] ?? ''))].filter((r) => r !== ''),
      })
    })()
    return () => { alive = false }
  }, [remote, sessionId])
  return data
}

function defaultRemote(remotes: readonly string[]): string {
  return remotes.includes('origin') ? 'origin' : remotes[0] ?? ''
}

/** Short branch names under one remote (`origin/main` → `main`). */
function branchesOf(data: BranchData | null, remoteName: string): readonly string[] {
  const prefix = `${remoteName}/`
  return (data?.remoteBranches ?? [])
    .filter((b) => b.name.startsWith(prefix) && b.name !== `${prefix}HEAD`)
    .map((b) => b.name.slice(prefix.length))
}

interface SyncModalProps {
  readonly remote: GitPanelRemote
  readonly sessionId: string
  readonly t: (key: GitKey) => string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}

function useSubmit(props: SyncModalProps): {
  busy: boolean
  error: string | null
  submit: (action: GitAction) => Promise<void>
} {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (action: GitAction): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await props.onSubmit(action)
    setBusy(false)
    if (res.ok) props.onClose()
    else setError(res.error ?? '')
  }
  return { busy, error, submit }
}

function RemoteSelect(props: {
  readonly label: string
  readonly remotes: readonly string[]
  readonly value: string
  readonly disabled?: boolean
  readonly onChange: (v: string) => void
}): JSX.Element {
  return h(Field, {
    label: props.label,
    children: h('select', {
      className: 'gp-select',
      value: props.value, disabled: props.disabled === true || props.remotes.length === 0,
      onChange: (e: { target: { value: string } }) => props.onChange(e.target.value),
    }, props.remotes.map((r) => h('option', { key: r, value: r }, r))),
  })
}

// ── fetch ────────────────────────────────────────────────────────────────

export function FetchModal(props: SyncModalProps): JSX.Element {
  const data = useBranchData(props.remote, props.sessionId)
  const [all, setAll] = useState(true)
  const [remoteName, setRemoteName] = useState('')
  const { busy, error, submit } = useSubmit(props)
  const remotes = data?.remotes ?? []
  const selected = remoteName !== '' ? remoteName : defaultRemote(remotes)
  return h(ModalShell, {
    title: props.t('modal.fetch'), onClose: props.onClose, children: [
      h('div', { key: 'd', className: 'gp-modal__subject' }, props.t('modal.fetchDesc')),
      h(RemoteSelect, {
        key: 'r', label: props.t('modal.remote'), remotes, value: selected,
        disabled: all, onChange: setRemoteName,
      }),
      h('label', { key: 'a', className: 'gp-check-row' }, [
        h('input', { key: 'i', type: 'checkbox', checked: all, onChange: () => setAll((v) => !v) }),
        ` ${props.t('modal.fetchAll')}`,
      ]),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, busy, confirmLabel: props.t('modal.fetchBtn'),
        onConfirm: () => void submit(all ? { kind: 'fetch' } : { kind: 'fetch', remote: selected }),
      }),
    ],
  })
}

// ── pull ─────────────────────────────────────────────────────────────────

export function PullModal(props: SyncModalProps): JSX.Element {
  const data = useBranchData(props.remote, props.sessionId)
  const [remoteName, setRemoteName] = useState('')
  // '' = no explicit pick: fall through to the auto default (upstream, else
  // the same-name remote branch, else nothing — the footer stays disabled).
  const [pickedBranch, setPickedBranch] = useState('')
  const [rebase, setRebase] = useState(false)
  const [autostash, setAutostash] = useState(true)
  const { busy, error, submit } = useSubmit(props)
  const remotes = data?.remotes ?? []
  const selectedRemote = remoteName !== '' ? remoteName : defaultRemote(remotes)
  const remoteBranches = branchesOf(data, selectedRemote)
  const autoBranch = ((): string => {
    if (data === null) return ''
    const upstream = data.local.find((b) => b.name === data.current)?.upstream
    if (upstream !== undefined && upstream.startsWith(`${selectedRemote}/`)) {
      return upstream.slice(selectedRemote.length + 1)
    }
    const current = data.current
    if (current !== null && remoteBranches.includes(current)) return current
    return ''
  })()
  const branch = pickedBranch !== '' ? pickedBranch : autoBranch
  return h(ModalShell, {
    title: props.t('modal.pull'), onClose: props.onClose, children: [
      h('div', { key: 'd', className: 'gp-modal__subject' }, props.t('modal.pullDesc')),
      h(RemoteSelect, {
        key: 'r', label: props.t('modal.remote'), remotes, value: selectedRemote,
        onChange: (v) => { setRemoteName(v); setPickedBranch('') },
      }),
      h(Field, {
        key: 'b', label: props.t('modal.branch'), children:
          h('select', {
            className: 'gp-select',
            value: branch, disabled: remoteBranches.length === 0,
            onChange: (e: { target: { value: string } }) => setPickedBranch(e.target.value),
          }, [
            ...(branch === '' ? [h('option', { key: '_', value: '' }, props.t('modal.selectBranch'))] : []),
            ...remoteBranches.map((b) => h('option', { key: b, value: b }, b)),
          ]),
      }),
      h('div', { key: 'into', className: 'gp-field' }, [
        h('span', { key: 'l', className: 'gp-field__label' }, props.t('modal.into')),
        h('span', { key: 'v', className: 'gp-modal__into' }, [
          h(BranchIcon, { key: 'i', size: 13 }),
          data?.current ?? 'HEAD',
        ]),
      ]),
      h('label', { key: 'rb', className: 'gp-check-row' }, [
        h('input', { key: 'i', type: 'checkbox', checked: rebase, onChange: () => setRebase((v) => !v) }),
        ` ${props.t('modal.rebase')}`,
      ]),
      h('label', { key: 'as', className: 'gp-check-row' }, [
        h('input', { key: 'i', type: 'checkbox', checked: autostash, onChange: () => setAutostash((v) => !v) }),
        ` ${props.t('modal.stashReapply')}`,
      ]),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, busy, confirmLabel: props.t('modal.pullBtn'),
        disabled: branch === '' || remotes.length === 0,
        onConfirm: () => void submit({
          kind: 'pull', remote: selectedRemote, branch,
          ...(rebase ? { rebase: true } : {}),
          ...(autostash ? { autostash: true } : {}),
        }),
      }),
    ],
  })
}

// ── push ─────────────────────────────────────────────────────────────────

export function PushModal(props: SyncModalProps): JSX.Element {
  const data = useBranchData(props.remote, props.sessionId)
  const [pickedBranch, setPickedBranch] = useState('')
  // `remote/branch` target; '' = the default remote with the same name.
  const [pickedTo, setPickedTo] = useState('')
  const [setUpstream, setSetUpstream] = useState(true)
  const [tags, setTags] = useState(false)
  const [force, setForce] = useState(false)
  const { busy, error, submit } = useSubmit(props)
  const remotes = data?.remotes ?? []
  const localNames = (data?.local ?? []).map((b) => b.name)
  const branch = pickedBranch !== '' ? pickedBranch : data?.current ?? localNames[0] ?? ''
  // To options: every remote's same-name slot plus its existing branches, so
  // both "create on remote" and "update existing ref" are selectable.
  const toOptions = ((): { readonly value: string; readonly label: string }[] => {
    if (branch === '') return []
    const out: { value: string; label: string }[] = []
    for (const r of remotes) {
      const existing = new Set(branchesOf(data, r))
      const same = existing.has(branch)
      out.push({
        value: `${r}/${branch}`,
        label: same ? `${branch} (${r}/${branch})` : `${props.t('modal.newOnRemote')} (${r}/${branch})`,
      })
      for (const b of existing) {
        if (b === branch) continue
        out.push({ value: `${r}/${b}`, label: `${b} (${r}/${b})` })
      }
    }
    return out
  })()
  const autoTo = remotes.length > 0 ? `${defaultRemote(remotes)}/${branch}` : ''
  const to = pickedTo !== '' ? pickedTo : autoTo
  // `to` is `<remote>/<name>`; resolve against the configured remote names
  // (longest prefix wins) so remote names containing '/' stay intact.
  const toRemote = remotes.filter((r) => to.startsWith(`${r}/`)).reduce<string>((best, r) => (r.length > best.length ? r : best), '')
  const toBranch = toRemote !== '' ? to.slice(toRemote.length + 1) : ''
  // Tracking only makes sense when the push creates the remote branch; an
  // existing remote branch already has (or doesn't need) an upstream, so the
  // option is hidden and never sent for it.
  const targetIsNew = toRemote !== '' && toBranch !== '' && !branchesOf(data, toRemote).includes(toBranch)
  return h(ModalShell, {
    title: props.t('modal.push'), onClose: props.onClose, children: [
      h('div', { key: 'd', className: 'gp-modal__subject' }, props.t('modal.pushDesc')),
      h(Field, {
        key: 'b', label: props.t('modal.branch'), children:
          h('select', {
            className: 'gp-select',
            value: branch, disabled: localNames.length === 0,
            onChange: (e: { target: { value: string } }) => { setPickedBranch(e.target.value); setPickedTo('') },
          }, localNames.map((b) => h('option', { key: b, value: b }, b))),
      }),
      h(Field, {
        key: 't', label: props.t('modal.to'), children:
          h('select', {
            className: 'gp-select',
            value: to, disabled: toOptions.length === 0,
            onChange: (e: { target: { value: string } }) => setPickedTo(e.target.value),
          }, toOptions.map((o) => h('option', { key: o.value, value: o.value }, o.label))),
      }),
      ...(targetIsNew ? [h('label', { key: 'up', className: 'gp-check-row' }, [
        h('input', { key: 'i', type: 'checkbox', checked: setUpstream, onChange: () => setSetUpstream((v) => !v) }),
        ` ${props.t('modal.tracking')}`,
      ])] : []),
      h('label', { key: 'tg', className: 'gp-check-row' }, [
        h('input', { key: 'i', type: 'checkbox', checked: tags, onChange: () => setTags((v) => !v) }),
        ` ${props.t('modal.pushTags')}`,
      ]),
      h('label', { key: 'fc', className: 'gp-check-row gp-check-row--danger' }, [
        h('input', { key: 'i', type: 'checkbox', checked: force, onChange: () => setForce((v) => !v) }),
        ` ${props.t('modal.forcePush')}`,
      ]),
      error ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      h(ModalFooter, {
        key: 'f', t: props.t, onClose: props.onClose, busy, confirmLabel: props.t('modal.pushBtn'),
        disabled: branch === '' || remotes.length === 0 || toRemote === '' || toBranch === '',
        onConfirm: () => void submit({
          kind: 'push', remote: toRemote, branch,
          ...(toBranch !== branch ? { toBranch } : {}),
          ...(targetIsNew && setUpstream ? { setUpstream: true } : {}),
          ...(tags ? { tags: true } : {}),
          ...(force ? { force: true } : {}),
        }),
      }),
    ],
  })
}
