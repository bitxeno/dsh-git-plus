import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildFullGraph, buildPathD, computeCurrentBranchSet } from '../../lib/testkit.mjs'

const linear = [
  { hash: 'c3', parents: ['c2'], refs: [{ type: 'head', name: 'main' }] },
  { hash: 'c2', parents: ['c1'], refs: [] },
  { hash: 'c1', parents: [], refs: [] },
]

describe('buildFullGraph (git-graph-plus port)', () => {
  it('lays out a linear history on one rail with a head dot', () => {
    const g = buildFullGraph(linear)
    assert.equal(g.dots.length, 3)
    assert.equal(g.dots[0].type, 'head')
    assert.equal(g.dots[1].type, 'default')
    assert.equal(g.dots[0].center.x, g.dots[1].center.x)
    assert.equal(g.commitLeftMargin.length, 3)
    // no remotes: everything is local-only
    assert.ok(g.dots.every((d) => d.localOnly))
  })
  it('creates a merge link when merging an already-tracked rail', () => {
    // m1 tracks rails a (major) and b; m2 merges b back in -> link.
    const commits = [
      { hash: 'm1', parents: ['a', 'b'], refs: [] },
      { hash: 'm2', parents: ['d', 'b'], refs: [] },
      { hash: 'a', parents: [], refs: [] },
      { hash: 'b', parents: [], refs: [] },
      { hash: 'd', parents: [], refs: [] },
    ]
    const g = buildFullGraph(commits)
    assert.equal(g.dots[0].type, 'merge')
    assert.equal(g.links.length, 1)
  })
  it('marks remote-only commits via the fallback name map', () => {
    const commits = [
      { hash: 'r1', parents: ['l1'], refs: [{ type: 'remote-branch', name: 'main', remote: 'origin' }] },
      { hash: 'l1', parents: [], refs: [{ type: 'branch', name: 'main' }] },
      { hash: 'u1', parents: ['l1'], refs: [{ type: 'branch', name: 'feature' }] },
    ]
    const g = buildFullGraph(commits)
    assert.equal(g.dots[0].remoteTip, true)
    // l1 is an ancestor of the remote tip, so it counts as pushed
    assert.equal(g.dots[1].localOnly, false)
    // u1 is on no remote rail, so it is local-only
    assert.equal(g.dots[2].localOnly, true)
  })
  it('buildPathD draws right turns, S-curves and straight lines', () => {
    assert.equal(buildPathD([{ x: 1, y: 1 }]), '')
    const right = buildPathD([{ x: 1, y: 0 }, { x: 2, y: 1 }])
    assert.ok(right.startsWith('M ') && right.includes('Q'))
    const leftMid = buildPathD([{ x: 3, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }])
    assert.ok(leftMid.includes('C'))
    const straight = buildPathD([{ x: 1, y: 0 }, { x: 1, y: 1 }])
    assert.ok(straight.includes('L'))
  })
  it('computeCurrentBranchSet walks HEAD ancestors only', () => {
    const set = computeCurrentBranchSet(linear)
    assert.deepEqual([...set].sort(), ['c1', 'c2', 'c3'])
    assert.deepEqual([...computeCurrentBranchSet([])], [])
  })
})
