import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseBranchHeader, quickFingerprint } from '../../lib/testkit.mjs'

describe('quickFingerprint', () => {
  it('is stable for identical inputs', () => {
    const a = quickFingerprint('main', 'abc123', 1, 2, 3, 0, 0)
    assert.equal(a, quickFingerprint('main', 'abc123', 1, 2, 3, 0, 0))
  })
  it('moves on branch, head, counts, or ahead/behind changes', () => {
    const base = quickFingerprint('main', 'abc123', 1, 2, 3, 0, 0)
    assert.notEqual(quickFingerprint('dev', 'abc123', 1, 2, 3, 0, 0), base)
    assert.notEqual(quickFingerprint('main', 'def456', 1, 2, 3, 0, 0), base)
    assert.notEqual(quickFingerprint('main', 'abc123', 0, 2, 3, 0, 0), base)
    assert.notEqual(quickFingerprint('main', 'abc123', 1, 0, 3, 0, 0), base)
    assert.notEqual(quickFingerprint('main', 'abc123', 1, 2, 0, 0, 0), base)
    assert.notEqual(quickFingerprint('main', 'abc123', 1, 2, 3, 2, 0), base)
    assert.notEqual(quickFingerprint('main', 'abc123', 1, 2, 3, 0, 1), base)
  })
  it('handles detached (null branch) and unborn (null head)', () => {
    const a = quickFingerprint(null, 'abc123', 0, 0, 0, 0, 0)
    const b = quickFingerprint(null, null, 0, 0, 0, 0, 0)
    assert.equal(a, quickFingerprint(null, 'abc123', 0, 0, 0, 0, 0))
    assert.notEqual(a, b)
  })
})

describe('parseBranchHeader', () => {
  it('parses tracking branches with ahead/behind', () => {
    assert.deepEqual(parseBranchHeader('## main...origin/main'), { branch: 'main', ahead: 0, behind: 0 })
    assert.deepEqual(parseBranchHeader('## main...origin/main [ahead 2]'), { branch: 'main', ahead: 2, behind: 0 })
    assert.deepEqual(parseBranchHeader('## main...origin/main [ahead 2, behind 1]'), { branch: 'main', ahead: 2, behind: 1 })
    assert.deepEqual(parseBranchHeader('## main'), { branch: 'main', ahead: 0, behind: 0 })
  })
  it('handles detached, unborn, and spaced names', () => {
    assert.deepEqual(parseBranchHeader('## HEAD (no branch)'), { branch: null, ahead: 0, behind: 0 })
    assert.deepEqual(parseBranchHeader('## HEAD (no branch, rebasing main)'), { branch: null, ahead: 0, behind: 0 })
    assert.deepEqual(parseBranchHeader('## No commits yet on main'), { branch: 'main', ahead: 0, behind: 0 })
    assert.deepEqual(parseBranchHeader('## my branch...origin/my branch [behind 3]'), { branch: 'my branch', ahead: 0, behind: 3 })
  })
})
