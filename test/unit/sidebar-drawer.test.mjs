import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { expandGroup } from '../../lib/testkit.mjs'

/**
 * Narrow-mode drawer behaviour that is pure enough to test without a DOM: a
 * rail tap expands the group it is about to scroll to, and nothing else.
 * (Layout, scroll and the overlay itself are verified in the GUI.)
 */
describe('expandGroup (narrow-mode rail tap)', () => {
  it('removes the tapped group from the closed set', () => {
    const closed = new Set(['tags', 'stashes', 'remotes'])
    assert.deepEqual(expandGroup(closed, 'tags'), ['stashes', 'remotes'])
  })

  it('returns null when the group is already open — no state or storage write', () => {
    const closed = new Set(['tags', 'stashes'])
    assert.equal(expandGroup(closed, 'branches'), null)
  })

  it('leaves the other groups untouched', () => {
    const closed = new Set(['tags', 'stashes', 'remotes'])
    const next = expandGroup(closed, 'stashes')
    assert.ok(next !== null)
    assert.ok(next.includes('tags'))
    assert.ok(next.includes('remotes'))
    assert.ok(!next.includes('stashes'))
  })

  it('does not mutate the input set', () => {
    const closed = new Set(['tags'])
    expandGroup(closed, 'tags')
    assert.deepEqual([...closed], ['tags'])
  })

  it('handles an empty closed set (everything already open)', () => {
    assert.equal(expandGroup(new Set(), 'branches'), null)
  })
})
