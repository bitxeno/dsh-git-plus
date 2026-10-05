/**
 * GitAction → command sequence construction + execution (dsh-git-plus).
 * Extends the panel baseline with branch/tag/merge/stash management.
 */
import { join, sep } from 'node:path'
import type { SnapshotDeps, GitPanelConfig } from './core.ts'
import { mapWorkspaceFailure, resolveWorkspace, runCommand, snapshotForSession } from './core.ts'
import { isSafeBranchName, isSafePath, isSafeRev } from './validate.ts'
import type { GitAction, GitActionRequest, GitActionResult, GitErrorCode } from './types.ts'

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
    case 'fetch':
      return { argv: [['git', 'fetch', '--all', '--prune']] }
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
      const args = ['git', 'branch', action.name]
      if (action.startPoint) args.push(action.startPoint)
      return { argv: [args] }
    }
    case 'delete-branch': {
      const bad = safeBranch(action.name)
      if (bad) return bad
      return { argv: [['git', 'branch', action.force === true ? '-D' : '-d', '--end-of-options', action.name]] }
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
      return { argv: [args] }
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
      return { argv: [['git', 'merge', '--abort']] }
    case 'merge-continue': {
      // Stage everything then commit the merge (matches continueOperation).
      return { argv: [['git', 'add', '-A'], ['git', 'commit', '--no-edit']] }
    }
    case 'stash-save': {
      const args = ['git', 'stash', 'push']
      if (action.message !== undefined && action.message !== '') args.push('-m', action.message)
      if (action.includeUntracked === true) args.push('--include-untracked')
      if (action.keepIndex === true) args.push('--keep-index')
      return { argv: [args] }
    }
    case 'stash-apply':
    case 'stash-pop':
    case 'stash-drop': {
      if (!Number.isInteger(action.index) || action.index < 0) return { error: 'invalid-name', message: `bad stash index: ${action.index}` }
      const verb = action.kind === 'stash-apply' ? 'apply' : action.kind === 'stash-pop' ? 'pop' : 'drop'
      return { argv: [['git', 'stash', verb, `stash@{${action.index}}`]] }
    }
    case 'rebase':
    case 'worktree-add':
      return { error: 'not-implemented', message: `${action.kind} is planned for V2` }
  }
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

  const plan = planAction(request.action, unborn)
  if ('error' in plan) return { ok: false, error: { code: plan.error, ...(plan.message ? { message: plan.message } : {}) } }

  let lastOutput = ''
  for (let step = 0; step < plan.argv.length; step += 1) {
    const argv = plan.argv[step]!
    const outcome = await runCommand(deps.run, argv, root, 'action', deps.signal)
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
      // Merge conflicts: surface as a typed conflicted result with the file
      // list so the client can jump straight to the conflict banner.
      if (request.action.kind === 'merge' || request.action.kind === 'stash-apply' || request.action.kind === 'stash-pop') {
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
