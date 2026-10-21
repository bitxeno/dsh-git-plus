import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseStashList, pickDefaultRemote, planAction, planContinueAbort, resolvePushRemote, parseBranches, parseAuthors, partitionUntracked, markRemotePresence, isNetworkCommand, isEmptyCherryPick, renameStashReflogEntry, stashReflogMessage, isSafeIgnorePattern, escapeIgnorePattern, extensionPattern, ignorePatternsForFile, ignorePatternForDir, parseMergeTreeConflicts, buildChangeMenuItems, buildSelectionMenuItems, rowKeyOf, dirKeyOf, isRowInSelection, isSelectedDirAlive, resolveMenuTarget } from '../../lib/testkit.mjs'

describe('parseStashList', () => {
  it('parses stash entries', () => {
    const N = String.fromCharCode(0)
    const out = parseStashList(`stash@{0}${N}WIP on main: abc${N}2026-01-01T00:00:00+00:00${N}abc123${N}def456\nstash@{1}${N}my stash${N}2026-01-02T00:00:00+00:00${N}aaa${N}bbb\n`)
    assert.equal(out.length, 2)
    assert.equal(out[0].index, 0)
    assert.equal(out[0].message, 'WIP on main: abc')
    assert.equal(out[1].index, 1)
  })
  it('ignores malformed lines', () => {
    assert.deepEqual(parseStashList('garbage\n'), [])
    assert.deepEqual(parseStashList(''), [])
  })
})

describe('planAction git-plus', () => {
  it('plans create-branch', () => {
    const r = planAction({ kind: 'create-branch', name: 'feature/x' }, false)
    assert.ok('argv' in r)
  })
  it('plans create-branch with checkout', () => {
    const r = planAction({ kind: 'create-branch', name: 'feature/x', checkout: true }, false)
    assert.ok('argv' in r && r.argv[0][1] === 'checkout')
  })
  it('plans create-branch with explicit track', () => {
    const r = planAction({ kind: 'create-branch', name: 'quickgui', startPoint: 'origin/quickgui', track: true }, false)
    assert.ok('argv' in r)
    assert.deepEqual(r.argv, [['git', 'branch', '--track', 'quickgui', 'origin/quickgui']])
  })
  it('rejects unsafe branch name', () => {
    const r = planAction({ kind: 'create-branch', name: '-evil' }, false)
    assert.ok('error' in r)
  })
  it('plans delete-branch with optional remote delete', () => {
    const plain = planAction({ kind: 'delete-branch', name: 'foo' }, false)
    assert.ok('argv' in plain)
    assert.deepEqual(plain.argv, [['git', 'branch', '-d', '--end-of-options', 'foo']])
    const forced = planAction({ kind: 'delete-branch', name: 'foo', force: true }, false)
    assert.ok('argv' in forced)
    assert.deepEqual(forced.argv, [['git', 'branch', '-D', '--end-of-options', 'foo']])
    const full = planAction({ kind: 'delete-branch', name: 'foo', remote: 'origin' }, false)
    assert.ok('argv' in full)
    assert.deepEqual(full.argv, [
      ['git', 'branch', '-d', '--end-of-options', 'foo'],
      ['git', 'push', '--delete', '--end-of-options', 'origin', 'foo'],
    ])
    assert.ok('error' in planAction({ kind: 'delete-branch', name: '-evil', remote: 'origin' }, false))
    assert.ok('error' in planAction({ kind: 'delete-branch', name: 'foo', remote: '-evil' }, false))
  })
  it('plans reset-branch per mode', () => {
    for (const [mode, flag] of [['soft', '--soft'], ['mixed', '--mixed'], ['hard', '--hard']]) {
      const r = planAction({ kind: 'reset-branch', ref: 'abc1234', mode }, false)
      assert.ok('argv' in r)
      assert.deepEqual(r.argv, [['git', 'reset', flag, '--end-of-options', 'abc1234']])
    }
    assert.ok('error' in planAction({ kind: 'reset-branch', ref: '-evil', mode: 'mixed' }, false))
  })
  it('answers unknown actions with a typed error instead of throwing', () => {
    const r = planAction({ kind: 'future-action' }, false)
    assert.ok('error' in r)
  })
  it('plans cherry-pick with no-commit and record-origin flags', () => {
    const plain = planAction({ kind: 'cherry-pick', ref: 'abc1234' }, false)
    assert.ok('argv' in plain)
    assert.deepEqual(plain.argv, [['git', 'cherry-pick', '--end-of-options', 'abc1234']])
    const full = planAction({ kind: 'cherry-pick', ref: 'abc1234', noCommit: true, recordOrigin: true }, false)
    assert.ok('argv' in full)
    assert.deepEqual(full.argv, [['git', 'cherry-pick', '--no-commit', '-x', '--end-of-options', 'abc1234']])
    assert.ok('error' in planAction({ kind: 'cherry-pick', ref: '-evil' }, false))
  })
  it('plans revert with and without --no-commit', () => {
    const plain = planAction({ kind: 'revert', ref: 'abc1234' }, false)
    assert.ok('argv' in plain)
    assert.deepEqual(plain.argv, [['git', 'revert', '--no-edit', '--end-of-options', 'abc1234']])
    const staged = planAction({ kind: 'revert', ref: 'abc1234', noCommit: true }, false)
    assert.ok('argv' in staged)
    assert.deepEqual(staged.argv, [['git', 'revert', '--no-edit', '--no-commit', '--end-of-options', 'abc1234']])
    assert.ok('error' in planAction({ kind: 'revert', ref: '-evil' }, false))
  })
  it('parses conflicted paths from merge-tree --write-tree output', () => {
    const out = [
      '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
      '100644 1111111111111111111111111111111111111111 1\tsrc/a.ts',
      '100644 2222222222222222222222222222222222222222 3\tsrc/a.ts',
      '100644 3333333333333333333333333333333333333333 2\tsrc/b.ts',
      '',
      'CONFLICT (content): Merge conflict in src/a.ts',
      'Auto-merging src/c.ts',
    ].join('\n')
    assert.deepEqual(parseMergeTreeConflicts(out), ['src/a.ts', 'src/b.ts'])
    // Clean merge: just the tree OID, no file-info section.
    assert.deepEqual(parseMergeTreeConflicts('4b825dc642cb6eb9a060e54bf8d69288fbee4904\n'), [])
    assert.deepEqual(parseMergeTreeConflicts(''), [])
  })
  it('spots an empty cherry-pick (already applied) vs a real conflict', () => {
    const emptyOut = 'The previous cherry-pick is now empty, possibly due to conflict resolution.\nOtherwise, please use \'git cherry-pick --skip\'\nnothing to commit, working tree clean'
    assert.equal(isEmptyCherryPick(emptyOut, []), true)
    // Unmerged files mean a real conflict even when the output mentions empty.
    assert.equal(isEmptyCherryPick(emptyOut, ['a.vue']), false)
    assert.equal(isEmptyCherryPick('CONFLICT (content): Merge conflict in a.vue', []), false)
    assert.equal(isEmptyCherryPick('error: could not apply abc1234...', []), false)
  })
  it('plans reveal per platform', () => {
    const mac = planAction({ kind: 'reveal', path: 'docs/a.png' }, false, 'darwin')
    assert.ok('argv' in mac)
    assert.deepEqual(mac.argv, [['open', '-R', 'docs/a.png']])
    const dash = planAction({ kind: 'reveal', path: '-evil' }, false, 'darwin')
    assert.ok('argv' in dash)
    assert.deepEqual(dash.argv, [['open', '-R', './-evil']])
    const win = planAction({ kind: 'reveal', path: 'docs/a.png' }, false, 'win32')
    assert.ok('argv' in win)
    assert.deepEqual(win.argv, [['explorer', '/select,docs/a.png']])
    assert.ok('error' in planAction({ kind: 'reveal', path: 'a.png' }, false, 'linux'))
    assert.ok('error' in planAction({ kind: 'reveal', path: '../x' }, false, 'darwin'))
  })
  it('routes write-file past the planner (direct execution)', () => {
    assert.ok('error' in planAction({ kind: 'write-file', path: 'a.txt', content: 'hi' }, false))
  })
  it('plans rename-branch', () => {
    const r = planAction({ kind: 'rename-branch', oldName: 'foo', newName: 'bar' }, false)
    assert.ok('argv' in r)
    assert.deepEqual(r.argv, [['git', 'branch', '-m', '--end-of-options', 'foo', 'bar']])
  })
  it('rejects unsafe or unchanged rename-branch names', () => {
    assert.ok('error' in planAction({ kind: 'rename-branch', oldName: '-evil', newName: 'bar' }, false))
    assert.ok('error' in planAction({ kind: 'rename-branch', oldName: 'foo', newName: '-evil' }, false))
    assert.ok('error' in planAction({ kind: 'rename-branch', oldName: 'foo', newName: 'foo' }, false))
  })
  it('plans single-tag push', () => {
    const r = planAction({ kind: 'push', remote: 'origin', branch: 'main', tag: 'v1.0.0' }, false)
    assert.ok('argv' in r)
    assert.deepEqual(r.argv, [['git', 'push', '--end-of-options', 'origin', 'v1.0.0']])
  })
  it('rejects unsafe tag push names', () => {
    assert.ok('error' in planAction({ kind: 'push', remote: 'origin', branch: 'main', tag: '-evil' }, false))
    assert.ok('error' in planAction({ kind: 'push', remote: 'origin', branch: 'main', tag: '/x' }, false))
  })
  it('flags fetch/pull/push commands for the network timeout', () => {
    assert.equal(isNetworkCommand(['git', 'fetch', '--all', '--prune']), true)
    assert.equal(isNetworkCommand(['git', 'pull', '--rebase', 'origin', 'main']), true)
    assert.equal(isNetworkCommand(['git', 'push', 'origin', 'refs/heads/main']), true)
    assert.equal(isNetworkCommand(['git', 'status', '--porcelain']), false)
    assert.equal(isNetworkCommand(['git', 'commit', '-m', 'push later']), false)
    assert.equal(isNetworkCommand(['git']), false)
  })
  it('plans fetch: all+prune by default, a single remote on request', () => {
    const all = planAction({ kind: 'fetch' }, false)
    assert.deepEqual(all.argv, [['git', 'fetch', '--all', '--prune']])
    const one = planAction({ kind: 'fetch', remote: 'upstream' }, false)
    assert.deepEqual(one.argv, [['git', 'fetch', '--end-of-options', 'upstream', '--prune']])
    const noPrune = planAction({ kind: 'fetch', remote: 'origin', prune: false }, false)
    assert.deepEqual(noPrune.argv, [['git', 'fetch', '--end-of-options', 'origin']])
  })
  it('rejects unsafe fetch/pull remotes and pull branches', () => {
    assert.ok('error' in planAction({ kind: 'fetch', remote: '-evil' }, false))
    assert.ok('error' in planAction({ kind: 'pull', remote: '-evil', branch: 'main' }, false))
    assert.ok('error' in planAction({ kind: 'pull', remote: 'origin', branch: '~bad' }, false))
    assert.ok('error' in planAction({ kind: 'push', remote: 'origin', branch: '-evil' }, false))
    assert.ok('error' in planAction({ kind: 'push', remote: 'origin', branch: 'main', toBranch: 'a..b' }, false))
  })
  it('plans pull with rebase/autostash and an optional branch', () => {
    const plain = planAction({ kind: 'pull', remote: 'origin' }, false)
    assert.deepEqual(plain.argv, [['git', 'pull', '--end-of-options', 'origin']])
    const full = planAction({ kind: 'pull', remote: 'origin', branch: 'main', rebase: true, autostash: true }, false)
    assert.deepEqual(full.argv, [['git', 'pull', '--rebase', '--autostash', '--end-of-options', 'origin', 'main']])
  })
  it('plans push with refspec, tracking, tags and force', () => {
    const plain = planAction({ kind: 'push', remote: 'origin', branch: 'main' }, false)
    assert.deepEqual(plain.argv, [['git', 'push', '--end-of-options', 'origin', 'refs/heads/main:refs/heads/main']])
    const full = planAction({ kind: 'push', remote: 'origin', branch: 'feat', toBranch: 'preview', setUpstream: true, tags: true, force: true }, false)
    assert.deepEqual(full.argv, [['git', 'push', '--set-upstream', '--tags', '--force', '--end-of-options', 'origin', 'refs/heads/feat:refs/heads/preview']])
  })
  it('plans merge default/no-ff/ff-only/squash', () => {
    const m1 = planAction({ kind: 'merge', branch: 'feature' }, false)
    assert.ok('argv' in m1)
    const m2 = planAction({ kind: 'merge', branch: 'feature', noFf: true }, false)
    assert.ok('argv' in m2 && m2.argv[0].includes('--no-ff'))
    const m3 = planAction({ kind: 'merge', branch: 'feature', ffOnly: true }, false)
    assert.ok('argv' in m3 && m3.argv[0].includes('--ff-only'))
    const m4 = planAction({ kind: 'merge', branch: 'feature', squash: true }, false)
    assert.ok('argv' in m4 && m4.argv.length === 2)
  })
  it('plans stash-save with paths after --', () => {
    const r = planAction({ kind: 'stash-save', message: 'wip', paths: ['a.txt', 'sub/b.txt'] }, false)
    assert.ok('argv' in r)
    assert.deepEqual(r.argv, [['git', 'stash', 'push', '-m', 'wip', '--', 'a.txt', 'sub/b.txt']])
    const bad = planAction({ kind: 'stash-save', paths: ['../evil'] }, false)
    assert.ok('error' in bad && bad.error === 'invalid-path')
  })
  it('plans stash-save/apply/pop/drop', () => {
    const s = planAction({ kind: 'stash-save', message: 'wip', includeUntracked: true }, false)
    assert.ok('argv' in s && s.argv[0].includes('--include-untracked'))
    const a = planAction({ kind: 'stash-apply', index: 0 }, false)
    assert.ok('argv' in a)
    const p = planAction({ kind: 'stash-pop', index: 1 }, false)
    assert.ok('argv' in p)
    const d = planAction({ kind: 'stash-drop', index: 0 }, false)
    assert.ok('argv' in d)
    const bad = planAction({ kind: 'stash-apply', index: -1 }, false)
    assert.ok('error' in bad)
  })
  it('plans create-tag lightweight and annotated', () => {
    const l = planAction({ kind: 'create-tag', name: 'v1.0.0' }, false)
    assert.ok('argv' in l)
    const a = planAction({ kind: 'create-tag', name: 'v1.0.0', message: 'rel' }, false)
    assert.ok('argv' in a && a.argv[0].includes('-a'))
  })
  it('plans create-tag with a push step to the resolved remote', () => {
    const r = planAction({ kind: 'create-tag', name: 'v2.0.0', message: 'rel', ref: 'abc123', push: true, pushRemote: 'origin' }, false)
    assert.ok('argv' in r && r.argv.length === 2)
    assert.deepEqual(r.argv[1], ['git', 'push', '--end-of-options', 'origin', 'refs/tags/v2.0.0'])
    const lightweight = planAction({ kind: 'create-tag', name: 'v2.0.1', push: true, pushRemote: 'upstream' }, false)
    assert.ok('argv' in lightweight && lightweight.argv[0].includes('v2.0.1') && !lightweight.argv[0].includes('-a'))
  })
  it('rejects create-tag push without a remote or with an unsafe one', () => {
    const none = planAction({ kind: 'create-tag', name: 'v1.0.0', push: true }, false)
    assert.ok('error' in none && none.error === 'no-remote')
    const bad = planAction({ kind: 'create-tag', name: 'v1.0.0', push: true, pushRemote: '-evil' }, false)
    assert.ok('error' in bad && bad.error === 'invalid-name')
  })
  it('picks origin as the default push remote, else the first', () => {
    assert.equal(pickDefaultRemote(['origin', 'mirror']), 'origin')
    assert.equal(pickDefaultRemote(['upstream', 'origin']), 'origin')
    assert.equal(pickDefaultRemote(['upstream', 'fork']), 'upstream')
    assert.equal(pickDefaultRemote([]), null)
  })
  it('resolves the push remote from `git remote` output', async () => {
    const deps = {
      run: { run: async (argv) => ({ exitCode: 0, stdout: argv.includes('remote') ? 'upstream\norigin\n' : '', stderr: '', timedOut: false, cancelled: false, stdoutLossy: false }) },
      fs: { realpath: async (p) => p, stat: async () => ({ mtimeMs: 0, size: 0 }), readFile: async () => Buffer.from(''), readdir: async () => [], remove: async () => {}, writeFile: async () => {} },
      sessions: { liveCwd: () => '/x', persistedMeta: async () => undefined },
    }
    assert.equal(await resolvePushRemote(deps, '/x'), 'origin')
    const none = { ...deps, run: { run: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false, cancelled: false, stdoutLossy: false }) } }
    assert.equal(await resolvePushRemote(none, '/x'), null)
    const failed = { ...deps, run: { run: async () => ({ exitCode: 128, stdout: '', stderr: 'fatal', timedOut: false, cancelled: false, stdoutLossy: false }) } }
    assert.equal(await resolvePushRemote(failed, '/x'), null)
  })
  it('stubs rebase/worktree as not-implemented (V2)', () => {
    const r = planAction({ kind: 'rebase', onto: 'main' }, false)
    assert.ok('error' in r && r.error === 'not-implemented')
    const w = planAction({ kind: 'worktree-add', path: '/tmp/x' }, false)
    assert.ok('error' in w && w.error === 'not-implemented')
  })
  it('routes merge-continue/abort planning through runAction', () => {
    assert.ok('error' in planAction({ kind: 'merge-abort' }, false))
    assert.ok('error' in planAction({ kind: 'merge-continue' }, false))
  })
  it('plans continue/abort per operation kind', () => {
    assert.deepEqual(planContinueAbort('merge-continue', 'merge').argv, [['git', 'add', '-A'], ['git', 'commit', '--no-edit']])
    assert.deepEqual(planContinueAbort('merge-continue', 'rebase').argv, [['git', 'add', '-A'], ['git', 'rebase', '--continue']])
    assert.deepEqual(planContinueAbort('merge-continue', 'cherry-pick').argv, [['git', 'add', '-A'], ['git', 'cherry-pick', '--continue']])
    assert.deepEqual(planContinueAbort('merge-continue', 'revert').argv, [['git', 'add', '-A'], ['git', 'revert', '--continue']])
    assert.deepEqual(planContinueAbort('merge-continue', null).argv, [['git', 'add', '-A']])
    assert.deepEqual(planContinueAbort('merge-abort', 'merge').argv, [['git', 'merge', '--abort']])
    assert.deepEqual(planContinueAbort('merge-abort', 'rebase').argv, [['git', 'rebase', '--abort']])
    assert.deepEqual(planContinueAbort('merge-abort', 'cherry-pick').argv, [['git', 'cherry-pick', '--abort']])
    assert.deepEqual(planContinueAbort('merge-abort', 'revert').argv, [['git', 'revert', '--abort']])
    assert.ok('error' in planContinueAbort('merge-abort', null))
  })
})

describe('ignore patterns', () => {
  it('validates gitignore patterns', () => {
    assert.equal(isSafeIgnorePattern('logs/a.log'), true)
    assert.equal(isSafeIgnorePattern('build/'), true)
    assert.equal(isSafeIgnorePattern('*.log'), true)
    assert.equal(isSafeIgnorePattern(''), false)
    assert.equal(isSafeIgnorePattern('#comment'), false)
    assert.equal(isSafeIgnorePattern('!neg'), false)
    assert.equal(isSafeIgnorePattern('/abs'), false)
    assert.equal(isSafeIgnorePattern('../up'), false)
    assert.equal(isSafeIgnorePattern('a\nb'), false)
  })
  it('escapes comment/negation leaders', () => {
    assert.equal(escapeIgnorePattern('#x'), '\\#x')
    assert.equal(escapeIgnorePattern('!x'), '\\!x')
    assert.equal(escapeIgnorePattern('a.log'), 'a.log')
  })
  it('derives exact and extension patterns for files', () => {
    assert.deepEqual(ignorePatternsForFile('logs/a.log'), { exact: 'logs/a.log', ext: '*.log' })
    assert.deepEqual(ignorePatternsForFile('TODO'), { exact: 'TODO' })
    assert.deepEqual(ignorePatternsForFile('.env'), { exact: '.env' })
    assert.equal(extensionPattern('a.TXT'), '*.TXT')
    assert.equal(extensionPattern('noext'), undefined)
  })
  it('derives dir patterns with a trailing slash', () => {
    assert.equal(ignorePatternForDir('dist'), 'dist/')
    assert.equal(ignorePatternForDir('a/b/'), 'a/b/')
  })
})

describe('parseAuthors', () => {
  const N = String.fromCharCode(0)
  it('dedups by name keeping the first email, sorted', () => {
    const out = parseAuthors(`bob${N}b@x.io\nAlice${N}a@x.io\nbob${N}b2@x.io\n\n`)
    assert.deepEqual(out, [
      { name: 'Alice', email: 'a@x.io' },
      { name: 'bob', email: 'b@x.io' },
    ])
  })
  it('tolerates missing emails and blank lines', () => {
    assert.deepEqual(parseAuthors(''), [])
    assert.deepEqual(parseAuthors(`solo\n${N}\n`), [{ name: 'solo', email: '' }])
  })
})

describe('partitionUntracked', () => {
  // Second arg mirrors discardUntracked's input: snapshot changes already
  // filtered to status untracked.
  const untracked = [
    { path: 'docs/image', isDirectory: true },
    { path: 'new.txt', isDirectory: false },
  ]
  it('matches exact entries and paths under untracked dirs', () => {
    assert.deepEqual(
      partitionUntracked(['docs/image', 'docs/image/a.png', 'new.txt', 'tracked.txt'], untracked),
      { untracked: ['docs/image', 'docs/image/a.png', 'new.txt'], tracked: ['tracked.txt'] },
    )
  })
  it('does not match sibling prefixes', () => {
    assert.deepEqual(
      partitionUntracked(['docs/imagery/x.png'], untracked),
      { untracked: [], tracked: ['docs/imagery/x.png'] },
    )
  })
})

describe('parseBranches / markRemotePresence', () => {
  const N = String.fromCharCode(0)
  const remotes = ['origin']
  it('parses the upstream short name when present', () => {
    const out = parseBranches(`main${N}abc1234${N}${N}origin/main\nlocal${N}def5678${N}${N}${N}`)
    assert.equal(out.length, 2)
    assert.equal(out[0].upstream, 'origin/main')
    assert.equal(out[1].upstream, undefined)
  })
  it('flags a branch with no remote counterpart as local-only', () => {
    const local = parseBranches(`main${N}a1${N}${N}origin/main\nsolo${N}b2${N}${N}${N}`)
    const remote = parseBranches(`origin/main${N}a1${N}${N}${N}`)
    const marked = markRemotePresence(local, remote, remotes)
    assert.equal(marked[0].onRemote, true)
    assert.equal(marked[1].onRemote, false)
  })
  it('matches a slash-containing branch name against any remote', () => {
    const local = parseBranches(`feature/x${N}a1${N}${N}${N}`)
    const remote = parseBranches(`upstream/feature/x${N}a1${N}${N}${N}`)
    assert.equal(markRemotePresence(local, remote, ['upstream'])[0].onRemote, true)
  })
  it('treats a missing remote-tracking ref for a configured upstream as local-only', () => {
    const local = parseBranches(`gone${N}a1${N}${N}origin/gone\nother${N}b2${N}${N}origin/other`)
    const remote = parseBranches(`origin/other${N}b2${N}${N}${N}`)
    const marked = markRemotePresence(local, remote, remotes)
    assert.equal(marked[0].onRemote, false)
    assert.equal(marked[1].onRemote, true)
  })
  it('ignores a local-only upstream and falls back to a by-name match', () => {
    const local = parseBranches(`main${N}a1${N}${N}other\nsolo${N}b2${N}${N}other`)
    const remote = parseBranches(`origin/main${N}a1${N}${N}${N}`)
    const marked = markRemotePresence(local, remote, remotes)
    assert.equal(marked[0].onRemote, true)
    assert.equal(marked[1].onRemote, false)
  })
  it('does not treat a slash-containing local branch upstream as a remote', () => {
    // `git branch -u feature/base solo` gives upstream "feature/base" — the
    // first segment is a local branch name, not a configured remote.
    const local = parseBranches(`solo${N}a1${N}${N}feature/base`)
    assert.equal(markRemotePresence(local, [], remotes)[0].onRemote, false)
    const remote = parseBranches(`origin/base${N}b2${N}${N}${N}`)
    assert.equal(markRemotePresence(local, remote, remotes)[0].onRemote, false)
  })
  it('flags every branch when the remote is configured but nothing is fetched', () => {
    // A remote that was added but never fetched/pushed holds none of our
    // branches, so each one is local-only — the empty list is a real answer,
    // not missing evidence.
    const local = parseBranches(`main${N}a1${N}${N}${N}\nTest${N}b2${N}${N}${N}`)
    const marked = markRemotePresence(local, [], remotes)
    assert.equal(marked[0].onRemote, false)
    assert.equal(marked[1].onRemote, false)
  })
  it('marks nothing when the remote listing could not be read', () => {
    // `null` means the `for-each-ref refs/remotes` command failed: unknown, so
    // no row may be claimed local-only.
    const local = parseBranches(`main${N}a1${N}${N}${N}`)
    assert.equal(markRemotePresence(local, null, remotes)[0].onRemote, undefined)
    assert.equal(markRemotePresence(local, null, [])[0].onRemote, undefined)
  })
  it('leaves the flag undefined when no remote is configured', () => {
    const local = parseBranches(`main${N}a1${N}${N}${N}`)
    // Nothing to be absent from, so the whole list stays unmarked.
    assert.equal(markRemotePresence(local, [], [])[0].onRemote, undefined)
    const remote = parseBranches(`origin/main${N}a1${N}${N}${N}`)
    assert.equal(markRemotePresence(local, remote, [])[0].onRemote, undefined)
  })
})

describe('stash reflog rename', () => {
  // Real `git stash` reflog: oldest first, newest last, so stash@{0} is the
  // final line. Ident field: name <email> ts tz, then TAB, then the message.
  const reflog = [
    '0000000000000000000000000000000000000000 abc111 a <a@b> 1792565847 +0800\tOn master: first message',
    'abc111 def222 a <a@b> 1792565876 +0800\tOn master: second message',
    'def222 aaa333 a <a@b> 1792565899 +0800\tOn master: third message',
    '',
  ].join('\n')

  it('rewrites the newest entry (stash@{0})', () => {
    const out = renameStashReflogEntry(reflog, 0, 'renamed')
    assert.equal(stashReflogMessage(out, 0), 'renamed')
    assert.equal(stashReflogMessage(out, 1), 'On master: second message')
    assert.equal(stashReflogMessage(out, 2), 'On master: first message')
  })

  it('rewrites an older entry by counting back from the newest', () => {
    const out = renameStashReflogEntry(reflog, 2, 'oldest renamed')
    assert.equal(stashReflogMessage(out, 2), 'oldest renamed')
    assert.equal(stashReflogMessage(out, 0), 'On master: third message')
  })

  it('keeps the commit fields before the tab and the trailing newline', () => {
    const out = renameStashReflogEntry(reflog, 1, 'x')
    const line = out.split('\n')[1]
    assert.ok(line.startsWith('abc111 def222 a <a@b> 1792565876 +0800\t'))
    assert.ok(out.endsWith('\n'))
  })

  it('flattens newlines so an entry stays one line', () => {
    const out = renameStashReflogEntry(reflog, 0, 'line1\nline2')
    assert.equal(out.split('\n').length, reflog.split('\n').length)
    assert.equal(stashReflogMessage(out, 0), 'line1 line2')
  })

  it('handles a reflog without a trailing newline', () => {
    const out = renameStashReflogEntry(reflog.replace(/\n$/, ''), 0, 'z')
    assert.equal(out.endsWith('\n'), false)
    assert.equal(stashReflogMessage(out, 0), 'z')
  })

  it('returns null for out-of-range or invalid indexes', () => {
    assert.equal(renameStashReflogEntry(reflog, 3, 'x'), null)
    assert.equal(renameStashReflogEntry(reflog, -1, 'x'), null)
    assert.equal(renameStashReflogEntry(reflog, 1.5, 'x'), null)
    assert.equal(renameStashReflogEntry('', 0, 'x'), null)
  })
})

describe('buildSelectionMenuItems (Cmd/Ctrl+A pane selection)', () => {
  const change = (path, staged, status = 'modified', isDirectory = false) => ({ path, staged, status, isDirectory })
  const cbs = (spy) => ({
    view: () => {},
    reveal: null,
    stage: (paths, stagedSide) => spy.push(['stage', paths, stagedSide]),
    stash: (paths, includeUntracked) => spy.push(['stash', paths, includeUntracked]),
    patch: (paths) => spy.push(['patch', paths]),
    ignore: (patterns) => spy.push(['ignore', patterns]),
    discard: (paths, count) => spy.push(['discard', paths, count]),
    t: (key, params) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
  })
  const keys = (items) => items.map((i) => i.key)
  const label = (items, key) => items.find((i) => i.key === key)?.label

  it('offers stage, stash, patch and discard for an unstaged selection', () => {
    const spy = []
    const items = buildSelectionMenuItems([change('a.txt', false), change('b.txt', false)], false, cbs(spy))
    assert.deepEqual(keys(items), ['stage', 's1', 'stash', 'patch', 's2', 'discard'])
    assert.equal(label(items, 'stage'), 'menu.stageFiles:{"n":2}')
    assert.equal(label(items, 'discard'), 'menu.discardFiles:{"n":2}')
  })

  it('offers unstage and no discard for a staged selection', () => {
    const spy = []
    const items = buildSelectionMenuItems([change('a.txt', true), change('b.txt', true)], true, cbs(spy))
    assert.deepEqual(keys(items), ['stage', 's1', 'stash', 'patch'])
    assert.equal(label(items, 'stage'), 'menu.unstageFiles:{"n":2}')
  })

  it('uses the singular label for a one-row selection', () => {
    const items = buildSelectionMenuItems([change('only.txt', false)], false, cbs([]))
    assert.equal(label(items, 'stage'), 'changes.stage')
    assert.equal(label(items, 'discard'), 'changes.discard')
  })

  it('hides stash and patch when the selection has a conflict', () => {
    const items = buildSelectionMenuItems([change('a.txt', false), change('c.txt', false, 'conflicted')], false, cbs([]))
    assert.ok(!keys(items).includes('stash'))
    assert.ok(!keys(items).includes('patch'))
  })

  it('dedupes ignore patterns for untracked files and dirs', () => {
    const spy = []
    const changes = [
      change('new.txt', false, 'untracked'),
      change('other/new.txt', false, 'untracked'),
      change('docs', false, 'untracked', true),
    ]
    const items = buildSelectionMenuItems(changes, false, cbs(spy))
    const ign = items.find((i) => i.key === 'ign')
    assert.ok(ign !== undefined)
    ign.onSelect()
    assert.deepEqual(spy, [['ignore', ['new.txt', 'other/new.txt', 'docs/']]])
  })

  it('omits the ignore entry when nothing is untracked', () => {
    const items = buildSelectionMenuItems([change('a.txt', false)], false, cbs([]))
    assert.ok(!keys(items).includes('ign'))
  })

  it('routes every action through the callbacks with the selected paths', () => {
    const spy = []
    const items = buildSelectionMenuItems([change('a.txt', false), change('b/c.txt', false)], false, cbs(spy))
    for (const key of ['stage', 'stash', 'patch', 'discard']) {
      items.find((i) => i.key === key).onSelect()
    }
    assert.deepEqual(spy, [
      ['stage', ['a.txt', 'b/c.txt'], false],
      ['stash', ['a.txt', 'b/c.txt'], false],
      ['patch', ['a.txt', 'b/c.txt']],
      ['discard', ['a.txt', 'b/c.txt'], 2],
    ])
  })
})

describe('change selection keys (Cmd/Ctrl+click)', () => {
  const change = (path, staged, status = 'modified') => ({ path, staged, status })

  it('keys a row by path and side so one path can hold two rows', () => {
    assert.equal(rowKeyOf(change('a.txt', false)), 'a.txt:w')
    assert.equal(rowKeyOf(change('a.txt', true)), 'a.txt:s')
    assert.equal(dirKeyOf('docs', false), 'd:w:docs')
    assert.equal(dirKeyOf('a/b', true), 'd:s:a/b')
  })

  it('treats a file as selected through any selected ancestor folder', () => {
    const selected = new Set([dirKeyOf('docs', false)])
    assert.ok(isRowInSelection(selected, 'docs/api.txt:w', 'docs/api.txt', false))
    assert.ok(isRowInSelection(selected, 'docs/img/logo.png:w', 'docs/img/logo.png', false))
    assert.ok(!isRowInSelection(selected, 'docs/api.txt:s', 'docs/api.txt', true))
    assert.ok(!isRowInSelection(selected, 'other/api.txt:w', 'other/api.txt', false))
  })

  it('does not treat a sibling with a shared prefix as inside the folder', () => {
    const selected = new Set([dirKeyOf('docs', false)])
    assert.ok(!isRowInSelection(selected, 'docs2/a.txt:w', 'docs2/a.txt', false))
  })

  it('keeps a folder selection alive only while it still has changes', () => {
    const selectedKey = dirKeyOf('docs', false)
    assert.ok(isSelectedDirAlive(selectedKey, [change('docs/a.txt', false)]))
    assert.ok(isSelectedDirAlive(selectedKey, [change('docs', false, 'untracked')]))
    assert.ok(!isSelectedDirAlive(selectedKey, [change('docs/a.txt', true)]))
    assert.ok(!isSelectedDirAlive(selectedKey, [change('docshell/a.txt', false)]))
    assert.ok(!isSelectedDirAlive('a.txt:w', [change('a.txt', false)]))
  })
})

describe('buildChangeMenuItems multi target', () => {
  const change = (path, staged, status = 'modified', isDirectory = false) => ({ path, staged, status, isDirectory })
  const spyCbs = (spy) => ({
    view: () => {},
    reveal: { label: 'menu.revealFinder', run: (p) => spy.push(['reveal', p]) },
    stage: (paths, side) => spy.push(['stage', paths, side]),
    stash: (paths, untracked) => spy.push(['stash', paths, untracked]),
    patch: (paths) => spy.push(['patch', paths]),
    ignore: (patterns) => spy.push(['ignore', patterns]),
    discard: (paths, count) => spy.push(['discard', paths, count]),
    t: (key, params) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
  })

  it('counts every selected folder, not just the one right-clicked', () => {
    const spy = []
    const target = {
      kind: 'multi',
      stagedSide: false,
      leaves: [change('a/1.txt', false), change('a/2.txt', false), change('b/1.txt', false)],
      revealPath: 'a',
    }
    const items = buildChangeMenuItems(target, spyCbs(spy))
    assert.equal(items.find((i) => i.key === 'stage').label, 'menu.stageFiles:{"n":3}')
    items.find((i) => i.key === 'discard').onSelect()
    assert.deepEqual(spy, [['discard', ['a/1.txt', 'a/2.txt', 'b/1.txt'], 3]])
  })

  it('keeps show-in-Finder when the right-click landed on a selected folder', () => {
    const spy = []
    const items = buildChangeMenuItems({
      kind: 'multi', stagedSide: false, revealPath: 'a',
      leaves: [change('a/1.txt', false), change('b/1.txt', false)],
    }, spyCbs(spy))
    items.find((i) => i.key === 'reveal').onSelect()
    assert.deepEqual(spy, [['reveal', 'a']])
  })

  it('drops show-in-Finder when the selection has no single folder target', () => {
    const items = buildChangeMenuItems({
      kind: 'multi', stagedSide: false,
      leaves: [change('a.txt', false), change('b.txt', false)],
    }, spyCbs([]))
    assert.ok(!items.some((i) => i.key === 'reveal'))
  })
})

describe('resolveMenuTarget (right-click inside a multi-selection)', () => {
  const change = (path, staged = false) => ({ path, staged, status: 'modified' })
  const dirTarget = (dir, leaves) => ({ kind: 'dir', dir, stagedSide: false, leaves })

  it('covers both selected folders, not just the one right-clicked', () => {
    const selected = new Set([dirKeyOf('a', false), dirKeyOf('b', false)])
    const leaves = [change('a/1.txt'), change('a/2.txt'), change('b/1.txt')]
    const target = resolveMenuTarget({
      selected, rowKey: dirKeyOf('a', false), inSelection: true, stagedSide: false,
      leaves, single: dirTarget('a', leaves.slice(0, 2)),
    })
    assert.equal(target.kind, 'multi')
    assert.equal(target.leaves.length, 3)
    assert.equal(target.revealPath, 'a')
  })

  it('keeps the folder target when only that folder is selected', () => {
    const selected = new Set([dirKeyOf('a', false)])
    const leaves = [change('a/1.txt')]
    const target = resolveMenuTarget({
      selected, rowKey: dirKeyOf('a', false), inSelection: true, stagedSide: false,
      leaves, single: dirTarget('a', leaves),
    })
    assert.equal(target.kind, 'dir')
  })

  it('keeps a single file target when nothing else is selected', () => {
    const selected = new Set(['a.txt:w'])
    const single = { kind: 'file', change: change('a.txt') }
    const target = resolveMenuTarget({
      selected, rowKey: 'a.txt:w', inSelection: true, stagedSide: false,
      leaves: [change('a.txt')], single,
    })
    assert.equal(target.kind, 'file')
  })

  it('targets only the clicked row when it is outside the selection', () => {
    const selected = new Set([dirKeyOf('a', false)])
    const single = { kind: 'file', change: change('c.txt') }
    const target = resolveMenuTarget({
      selected, rowKey: 'c.txt:w', inSelection: false, stagedSide: false,
      leaves: [change('a/1.txt')], single,
    })
    assert.equal(target, single)
  })

  it('includes a selected folder when a file is right-clicked inside it', () => {
    const selected = new Set([dirKeyOf('a', false), 'b.txt:w'])
    const leaves = [change('a/1.txt'), change('b.txt')]
    const target = resolveMenuTarget({
      selected, rowKey: 'b.txt:w', inSelection: true, stagedSide: false,
      leaves, single: { kind: 'file', change: change('b.txt') },
    })
    assert.equal(target.kind, 'multi')
    assert.equal(target.leaves.length, 2)
    assert.equal(target.revealPath, undefined)
  })
})
