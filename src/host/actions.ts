/**
 * GitAction → command sequence construction + execution (dsh-git-plus).
 * Extends the panel baseline with branch/tag/merge/stash management.
 */
import { join, sep } from 'node:path'
import type { SnapshotDeps, GitPanelConfig } from './core.ts'
import { mapWorkspaceFailure, resolveWorkspace, runCommand, snapshotForSession } from './core.ts'
import { detectOperation } from './queries.ts'
import { isSafeBranchName, isSafeIgnorePattern, isSafePath, isSafeRev } from './validate.ts'
import type { GitAction, GitActionRequest, GitActionResult, GitErrorCode, GitOperationKind } from './types.ts'

export { isSafePath }

interface CommandPlan {
  readonly argv: readonly (readonly string[])[]
}
type PlanResult = CommandPlan | { readonly error: GitErrorCode; readonly message?: string }

function withPaths(prefixes: readonly (readonly string[])[], paths: readonly string[]): PlanResult {
  if (paths.length === 0) return { error: 'invalid-path', message: 'no paths given' }
  for (const path of paths) {
    if (!isSafePath(path)) return { error: 'invalid-path', message: `unsafe path: ${path}` }
  }
  return { argv: prefixes.map((prefix) => [...prefix, ...paths]) }
}

function safeBranch(name: string): PlanResult | null {
  if (!isSafeBranchName(name)) return { error: 'invalid-name', message: `unsafe branch name: ${name}` }
  return null
}

/** Network-bound git commands: they stall on remote round-trips, so they run
 * under the generous network timeout instead of the fast local-command cap. */
export function isNetworkCommand(argv: readonly string[]): boolean {
  return argv[0] === 'git' && (argv[1] === 'fetch' || argv[1] === 'pull' || argv[1] === 'push')
}

/** Build the git command sequence for an action. */
export function planAction(action: GitAction, unborn: boolean): PlanResult {
  switch (action.kind) {
    case 'stage':
      return withPaths([['git', 'add', '--']], action.paths)
    case 'stage-all':
      return { argv: [['git', 'add', '-A']] }
    case 'unstage':
      return unborn
        ? withPaths([['git', 'rm', '--cached', '-r', '--']], action.paths)
        : withPaths([['git', 'restore', '--staged', '--']], action.paths)
    case 'unstage-all':
      return unborn
        ? { argv: [['git', 'rm', '--cached', '-r', '--', '.']] }
        : { argv: [['git', 'restore', '--staged', '--', '.']] }
    case 'discard':
      return withPaths([['git', 'restore', '--']], action.paths)
    case 'commit': {
      const message = action.message.trim()
      const amend = action.amend === true
      if (message === '' && !amend) return { error: 'empty-message' }
      const amendFlag = amend ? ['--amend'] : []
      const msgArgs = message === '' ? ['--no-edit'] : ['-m', message]
      if (action.paths === undefined || action.paths.length === 0) {
        return { argv: [['git', 'commit', ...amendFlag, ...msgArgs]] }
      }
      const staged = withPaths([['git', 'add', '--']], action.paths)
      if ('error' in staged) return staged
      const commitCmd = ['git', 'commit', ...amendFlag, ...msgArgs, '--', ...action.paths]
      return { argv: [...staged.argv, commitCmd] }
    }
    case 'branch-checkout': {
      const bad = safeBranch(action.name)
      if (bad) return bad
      return { argv: [['git', 'checkout', '--end-of-options', action.name]] }
    }
    case 'fetch': {
      // Default (no fields) keeps the historical `--all --prune` behavior.
      const args = ['git', 'fetch']
      if (action.remote !== undefined && action.remote !== '') {
        const bad = safeBranch(action.remote)
        if (bad) return bad
        args.push('--end-of-options', action.remote)
      } else {
        args.push('--all')
      }
      if (action.prune !== false) args.push('--prune')
      return { argv: [args] }
    }
    case 'pull': {
      if (!isSafeRev(action.remote)) return { error: 'invalid-name', message: `unsafe remote: ${action.remote}` }
      if (action.branch !== undefined && action.branch !== '' && !isSafeBranchName(action.branch)) {
        return { error: 'invalid-name', message: `unsafe branch: ${action.branch}` }
      }
      const args = ['git', 'pull']
      if (action.rebase === true) args.push('--rebase')
      if (action.autostash === true) args.push('--autostash')
      args.push('--end-of-options', action.remote)
      if (action.branch !== undefined && action.branch !== '') args.push(action.branch)
      return { argv: [args] }
    }
    case 'push': {
      if (!isSafeRev(action.remote)) return { error: 'invalid-name', message: `unsafe remote: ${action.remote}` }
      if (action.tag !== undefined) {
        if (!isSafeRev(action.tag) || action.tag.startsWith('/')) return { error: 'invalid-name', message: `unsafe tag name: ${action.tag}` }
        return { argv: [['git', 'push', ...(action.force === true ? ['--force'] : []), '--end-of-options', action.remote, action.tag]] }
      }
      if (!isSafeBranchName(action.branch)) return { error: 'invalid-name', message: `unsafe branch: ${action.branch}` }
      const to = action.toBranch ?? action.branch
      if (!isSafeBranchName(to)) return { error: 'invalid-name', message: `unsafe branch: ${to}` }
      const args = ['git', 'push']
      if (action.setUpstream === true) args.push('--set-upstream')
      if (action.tags === true) args.push('--tags')
      if (action.force === true) args.push('--force')
      args.push('--end-of-options', action.remote, `refs/heads/${action.branch}:refs/heads/${to}`)
      return { argv: [args] }
    }
    case 'create-branch': {
      const bad = safeBranch(action.name)
      if (bad) return bad
      if (action.startPoint !== undefined && action.startPoint !== '' && !isSafeRev(action.startPoint)) {
        return { error: 'invalid-name', message: `unsafe start point: ${action.startPoint}` }
      }
      if (action.checkout === true) {
        const args = ['git', 'checkout', '-b', action.name]
        if (action.startPoint) args.push('--end-of-options', action.startPoint)
        return { argv: [args] }
      }
      // Explicit --track (not just autoSetupMerge): the Track dialog promises
      // the new branch tracks its start point regardless of user config.
      const args = ['git', 'branch']
      if (action.track === true) args.push('--track')
      args.push(action.name)
      if (action.startPoint) args.push(action.startPoint)
      return { argv: [args] }
    }
    case 'delete-branch': {
      const bad = safeBranch(action.name)
      if (bad) return bad
      // Local first: an unmerged `-d` aborts before anything remote is
      // touched. The push step runs under the network timeout (isNetworkCommand).
      const argv: string[][] = [['git', 'branch', action.force === true ? '-D' : '-d', '--end-of-options', action.name]]
      if (action.remote !== undefined && action.remote !== '') {
        if (!isSafeRev(action.remote)) return { error: 'invalid-name', message: `unsafe remote: ${action.remote}` }
        argv.push(['git', 'push', '--delete', '--end-of-options', action.remote, action.name])
      }
      return { argv }
    }
    case 'rename-branch': {
      if (!isSafeBranchName(action.oldName)) return { error: 'invalid-name', message: `unsafe branch name: ${action.oldName}` }
      if (!isSafeBranchName(action.newName)) return { error: 'invalid-name', message: `unsafe branch name: ${action.newName}` }
      if (action.oldName === action.newName) return { error: 'invalid-name', message: 'branch name unchanged' }
      return { argv: [['git', 'branch', '-m', '--end-of-options', action.oldName, action.newName]] }
    }
    case 'create-tag': {
      if (!isSafeRev(action.name) || action.name.startsWith('/')) return { error: 'invalid-name', message: `unsafe tag name: ${action.name}` }
      if (action.ref !== undefined && action.ref !== '' && !isSafeRev(action.ref)) {
        return { error: 'invalid-name', message: `unsafe ref: ${action.ref}` }
      }
      const args = ['git', 'tag']
      if (action.message !== undefined && action.message !== '') {
        args.push('-a', action.name, '-m', action.message)
      } else {
        args.push(action.name)
      }
      if (action.ref) args.push(action.ref)
      const argv: string[][] = [args]
      if (action.push === true) {
        const remote = action.pushRemote ?? ''
        if (remote === '') return { error: 'no-remote', message: 'no push remote resolved' }
        if (!isSafeRev(remote)) return { error: 'invalid-name', message: `unsafe push remote: ${remote}` }
        argv.push(['git', 'push', '--end-of-options', remote, `refs/tags/${action.name}`])
      }
      return { argv }
    }
    case 'delete-tag': {
      if (!isSafeRev(action.name)) return { error: 'invalid-name', message: `unsafe tag name: ${action.name}` }
      return { argv: [['git', 'tag', '-d', '--end-of-options', action.name]] }
    }
    case 'merge': {
      if (!isSafeRev(action.branch)) return { error: 'invalid-name', message: `unsafe branch: ${action.branch}` }
      const args = ['git', 'merge', '--end-of-options', action.branch]
      // Order: --ff-only is exclusive; --squash implies --no-ff semantics.
      if (action.ffOnly === true) args.splice(2, 0, '--ff-only')
      else if (action.squash === true) args.splice(2, 0, '--squash')
      else if (action.noFf === true) args.splice(2, 0, '--no-ff')
      const argv: string[][] = [args]
      if (action.squash === true) argv.push(['git', 'commit', '--no-edit'])
      return { argv }
    }
    case 'merge-abort':
    case 'merge-continue':
      // Resolved in runAction (needs the live operation kind); reaching the
      // planner with them is a programming error.
      return { error: 'git-error', message: `${action.kind} is planned in runAction` }
    case 'stash-save': {
      const args = ['git', 'stash', 'push']
      if (action.message !== undefined && action.message !== '') args.push('-m', action.message)
      if (action.includeUntracked === true) args.push('--include-untracked')
      if (action.keepIndex === true) args.push('--keep-index')
      if (action.paths !== undefined && action.paths.length > 0) {
        for (const path of action.paths) {
          if (!isSafePath(path)) return { error: 'invalid-path', message: `unsafe path: ${path}` }
        }
        args.push('--', ...action.paths)
      }
      return { argv: [args] }
    }
    case 'stash-apply':
    case 'stash-pop':
    case 'stash-drop': {
      if (!Number.isInteger(action.index) || action.index < 0) return { error: 'invalid-name', message: `bad stash index: ${action.index}` }
      const verb = action.kind === 'stash-apply' ? 'apply' : action.kind === 'stash-pop' ? 'pop' : 'drop'
      return { argv: [['git', 'stash', verb, `stash@{${action.index}}`]] }
    }
    case 'ignore':
      // Executed directly in runAction (a .gitignore file write, not a git
      // command); reaching the planner with it is a programming error.
      return { error: 'git-error', message: 'ignore has no command plan' }
    case 'rebase':
    case 'worktree-add':
      return { error: 'not-implemented', message: `${action.kind} is planned for V2` }
  }
}

/**
 * Continue/abort command plan for an in-progress operation (mirrors the
 * reference `continueOperation`/`abortOperation` dispatch). Continue always
 * stages resolved files first; without an operation marker there is nothing
 * to finalize, so continue degrades to staging while abort reports an error.
 */
export function planContinueAbort(
  kind: 'merge-continue' | 'merge-abort',
  op: GitOperationKind | null,
): PlanResult {
  if (kind === 'merge-continue') {
    const step = (cmd: string): string[] => ['git', cmd, '--continue']
    if (op === 'rebase') return { argv: [['git', 'add', '-A'], step('rebase')] }
    if (op === 'cherry-pick') return { argv: [['git', 'add', '-A'], step('cherry-pick')] }
    if (op === 'revert') return { argv: [['git', 'add', '-A'], step('revert')] }
    if (op === null) return { argv: [['git', 'add', '-A']] }
    return { argv: [['git', 'add', '-A'], ['git', 'commit', '--no-edit']] }
  }
  if (op === 'rebase') return { argv: [['git', 'rebase', '--abort']] }
  if (op === 'cherry-pick') return { argv: [['git', 'cherry-pick', '--abort']] }
  if (op === 'revert') return { argv: [['git', 'revert', '--abort']] }
  if (op === null) return { error: 'git-error', message: 'no merge, rebase, cherry-pick or revert in progress' }
  return { argv: [['git', 'merge', '--abort']] }
}

/** Default push target: `origin` when present, else the first configured
 *  remote; null when the repository has no remotes. */
export function pickDefaultRemote(names: readonly string[]): string | null {
  if (names.length === 0) return null
  return names.includes('origin') ? 'origin' : names[0] ?? null
}

/** Read the configured remote names and pick the default push target. */
export async function resolvePushRemote(deps: SnapshotDeps, root: string): Promise<string | null> {
  const res = await runCommand(deps.run, ['git', 'remote'], root, 'remotes', deps.signal)
  if (!('run' in res) || res.run.exitCode !== 0) return null
  return pickDefaultRemote(res.run.stdout.split('\n').map((s) => s.trim()).filter((s) => s !== ''))
}

/** Execute a management action, returning the fresh snapshot on success. */
export async function runAction(
  deps: SnapshotDeps,
  config: GitPanelConfig,
  request: GitActionRequest,
): Promise<GitActionResult> {
  const workspace = await resolveWorkspace(deps, request.sessionId)
  if (!workspace.ok) return { ok: false, error: mapWorkspaceFailure(workspace.failure) }
  const root = workspace.root

  const headProbe = await runCommand(deps.run, ['git', 'rev-parse', '--verify', 'HEAD'], root, 'head-probe', deps.signal)
  const unborn = !('run' in headProbe) || headProbe.run.exitCode !== 0

  if (request.action.kind === 'discard') {
    const removed = await discardUntracked(deps, config, root, request.sessionId, request.action.paths)
    if (removed !== null) {
      if (!removed.ok) return removed.result
      if (removed.remainingTracked.length === 0) {
        const snapshot = await snapshotForSession(deps, config, request.sessionId)
        if (!snapshot.ok) return { ok: false, error: { code: 'git-error', message: 'snapshot after action failed' } }
        return { ok: true, snapshot: snapshot.value, output: '' }
      }
      request = { ...request, action: { kind: 'discard', paths: removed.remainingTracked } }
    }
  }

  // Push-after-create needs the remote resolved at execution time (origin,
  // else the first configured remote); the client never names a remote.
  let action = request.action
  if (action.kind === 'ignore') {
    return await appendGitignore(deps, config, root, request.sessionId, action.patterns)
  }
  if (action.kind === 'create-tag' && action.push === true && action.pushRemote === undefined) {
    const remote = await resolvePushRemote(deps, root)
    if (remote === null) {
      return { ok: false, error: { code: 'no-remote', message: 'no git remote configured' } }
    }
    action = { ...action, pushRemote: remote }
  }

  // Continue/abort dispatch on the live operation kind (merge / rebase /
  // cherry-pick / revert); a static plan cannot know which one is running.
  const plan = action.kind === 'merge-continue' || action.kind === 'merge-abort'
    ? planContinueAbort(action.kind, (await detectOperation(deps, root))?.kind ?? null)
    : planAction(action, unborn)
  if ('error' in plan) return { ok: false, error: { code: plan.error, ...(plan.message ? { message: plan.message } : {}) } }

  let lastOutput = ''
  for (let step = 0; step < plan.argv.length; step += 1) {
    const argv = plan.argv[step]!
    const outcome = await runCommand(deps.run, argv, root, 'action', deps.signal, undefined,
      isNetworkCommand(argv) ? config.networkTimeoutMs : undefined)
    const where = plan.argv.length > 1 ? ` (step ${step + 1}/${plan.argv.length}: ${argv.join(' ')})` : ''
    if ('failure' in outcome) {
      const message = outcome.failure instanceof Error ? outcome.failure.message : String(outcome.failure)
      return { ok: false, error: { code: 'git-unavailable', message: message + where } }
    }
    if (outcome.run.cancelled) return { ok: false, error: { code: 'cancelled' } }
    if (outcome.run.timedOut) return { ok: false, error: { code: 'timeout' } }
    lastOutput = outcome.run.stdout || outcome.run.stderr
    if (outcome.run.exitCode !== 0) {
      const stderr = outcome.run.stderr
      // create-tag + push: step 0 (the tag) already succeeded, so name the
      // partial state — retrying the whole action would hit "already exists".
      if (action.kind === 'create-tag' && action.push === true && step > 0) {
        return { ok: false, error: { code: 'git-error', message: `tag created locally, but push failed: ${stderr.trim() || `git exited ${outcome.run.exitCode}`}` } }
      }
      // delete-branch + remote: the local branch is already gone, so name the
      // partial state instead of a bare push failure.
      if (action.kind === 'delete-branch' && action.remote !== undefined && action.remote !== '' && step > 0) {
        return { ok: false, error: { code: 'git-error', message: `branch deleted locally, but remote delete failed: ${stderr.trim() || `git exited ${outcome.run.exitCode}`}` } }
      }
      // Merge/pull conflicts: surface as a typed conflicted result with the file
      // list so the client can jump straight to the conflict banner.
      if (request.action.kind === 'merge' || request.action.kind === 'pull' || request.action.kind === 'stash-apply' || request.action.kind === 'stash-pop') {
        const files = await readConflictFiles(deps, root)
        if (files.length > 0 || /conflict|CONFLICT|needs merge|already exists/i.test(stderr + lastOutput)) {
          const snapshot = await snapshotForSession(deps, config, request.sessionId)
          if (snapshot.ok) {
            return { ok: true, snapshot: snapshot.value, output: lastOutput.trim(), conflicted: true, conflictFiles: files }
          }
          return { ok: false, error: { code: 'conflicted', message: (stderr.trim() || 'merge conflict') + where, conflictFiles: files } }
        }
      }
      if (/nothing to commit|no changes added/i.test(stderr + lastOutput)) {
        return { ok: false, error: { code: 'git-error', message: (stderr.trim() || 'nothing to commit') + where } }
      }
      if (/would be overwritten by checkout|local changes/i.test(stderr)) {
        return { ok: false, error: { code: 'local-changes-block', message: stderr.trim() + where } }
      }
      return { ok: false, error: { code: 'git-error', message: (stderr.trim() || `git exited ${outcome.run.exitCode}`) + where } }
    }
  }

  const snapshot = await snapshotForSession(deps, config, request.sessionId)
  if (!snapshot.ok) {
    return { ok: false, error: { code: 'git-error', message: 'snapshot after action failed' } }
  }
  return { ok: true, snapshot: snapshot.value, output: lastOutput.trim() }
}

async function readConflictFiles(deps: SnapshotDeps, root: string): Promise<string[]> {
  const res = await runCommand(deps.run, ['git', 'diff', '--name-only', '--diff-filter=U'], root, 'conflicts', deps.signal)
  if (!('run' in res) || res.run.exitCode !== 0) return []
  return res.run.stdout.split('\n').map((s) => s.trim()).filter((s) => s !== '')
}

/**
 * Append ignore patterns to the work-tree `.gitignore` (created when absent),
 * skipping lines that already exist. Returns the fresh snapshot on success.
 */
async function appendGitignore(
  deps: SnapshotDeps,
  config: GitPanelConfig,
  root: string,
  sessionId: string,
  patterns: readonly string[],
): Promise<GitActionResult> {
  const trimmed = patterns.map((p) => p.trim()).filter((p) => p !== '')
  if (trimmed.length === 0) return { ok: false, error: { code: 'invalid-path', message: 'no patterns given' } }
  const unique = [...new Set(trimmed)]
  for (const pattern of unique) {
    if (!isSafeIgnorePattern(pattern)) return { ok: false, error: { code: 'invalid-path', message: `unsafe pattern: ${pattern}` } }
  }
  const ignorePath = join(root, '.gitignore')
  let current = ''
  try {
    current = (await deps.fs.readFile(ignorePath)).toString('utf8')
  } catch {
    current = ''
  }
  const existing = new Set(current.split('\n').map((line) => line.trim()).filter((line) => line !== ''))
  const fresh = unique.filter((p) => !existing.has(p))
  if (fresh.length === 0) {
    const snapshot = await snapshotForSession(deps, config, sessionId)
    if (!snapshot.ok) return { ok: false, error: { code: 'git-error', message: 'snapshot after action failed' } }
    return { ok: true, snapshot: snapshot.value, output: '' }
  }
  const prefix = current === '' || current.endsWith('\n') ? '' : '\n'
  try {
    await deps.fs.writeFile(ignorePath, `${current}${prefix}${fresh.join('\n')}\n`)
  } catch (error) {
    return { ok: false, error: { code: 'git-error', message: error instanceof Error ? error.message : 'write .gitignore failed' } }
  }
  const snapshot = await snapshotForSession(deps, config, sessionId)
  if (!snapshot.ok) return { ok: false, error: { code: 'git-error', message: 'snapshot after action failed' } }
  return { ok: true, snapshot: snapshot.value, output: fresh.join('\n') }
}

async function discardUntracked(
  deps: SnapshotDeps,
  config: GitPanelConfig,
  root: string,
  sessionId: string,
  paths: readonly string[],
): Promise<null | { ok: true; remainingTracked: readonly string[] } | { ok: false; result: GitActionResult }> {
  const snap = await snapshotForSession(deps, config, sessionId)
  if (!snap.ok) return null
  const untrackedSet = new Set(snap.value.changes.filter((c) => c.status === 'untracked').map((c) => c.path))
  const untracked = paths.filter((p) => untrackedSet.has(p))
  if (untracked.length === 0) return null
  const tracked = paths.filter((p) => !untrackedSet.has(p))
  let rootReal: string
  try {
    rootReal = await deps.fs.realpath(root)
  } catch {
    return { ok: false, result: { ok: false, error: { code: 'git-error', message: 'repository root unavailable' } } }
  }
  for (const path of untracked) {
    if (!isSafePath(path)) return { ok: false, result: { ok: false, error: { code: 'invalid-path', message: `unsafe path: ${path}` } } }
    const target = join(root, path)
    let targetReal: string
    try {
      targetReal = await deps.fs.realpath(target)
    } catch {
      continue
    }
    if (targetReal !== rootReal && !targetReal.startsWith(rootReal + sep)) {
      return { ok: false, result: { ok: false, error: { code: 'invalid-path', message: `path escapes repository: ${path}` } } }
    }
    await deps.fs.remove(target).catch(() => {})
  }
  return { ok: true, remainingTracked: tracked }
}
