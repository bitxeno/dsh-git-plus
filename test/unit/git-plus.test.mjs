import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseStashList, planAction } from '../../lib/testkit.mjs'

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
  it('rejects unsafe branch name', () => {
    const r = planAction({ kind: 'create-branch', name: '-evil' }, false)
    assert.ok('error' in r)
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
  it('stubs rebase/worktree as not-implemented (V2)', () => {
    const r = planAction({ kind: 'rebase', onto: 'main' }, false)
    assert.ok('error' in r && r.error === 'not-implemented')
    const w = planAction({ kind: 'worktree-add', path: '/tmp/x' }, false)
    assert.ok('error' in w && w.error === 'not-implemented')
  })
  it('plans merge-abort/continue', () => {
    assert.ok('argv' in planAction({ kind: 'merge-abort' }, false))
    const c = planAction({ kind: 'merge-continue' }, false)
    assert.ok('argv' in c && c.argv.length === 2)
  })
})
