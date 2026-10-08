import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildFileTree } from '../../lib/testkit.mjs'

describe('buildFileTree', () => {
  it('keeps plain files as file leaves', () => {
    const [docs] = buildFileTree([{ path: 'docs/a.png', meta: 'A' }])
    assert.equal(docs.dir, true)
    assert.equal(docs.children.length, 1)
    assert.equal(docs.children[0].dir, false)
    assert.equal(docs.children[0].meta, 'A')
  })
  it('keeps a directory leaf as a folder node with its payload', () => {
    // `git status` collapses untracked dirs to one `dir/` entry.
    const [docs] = buildFileTree([{ path: 'docs/image', meta: 'D', dir: true }])
    assert.equal(docs.name, 'docs/image')
    assert.equal(docs.dir, true)
    assert.equal(docs.children.length, 0)
    assert.equal(docs.meta, 'D')
  })
  it('does not collapse a lone file into its parent', () => {
    const [docs] = buildFileTree([{ path: 'docs/a.png', meta: 'A' }])
    assert.equal(docs.name, 'docs')
    assert.equal(docs.meta, undefined)
  })
  it('sorts folders before files', () => {
    const [root] = buildFileTree([
      { path: 'root/b.txt', meta: 'B' },
      { path: 'root/sub/c.txt', meta: 'C' },
    ])
    assert.deepEqual(root.children.map((c) => c.name), ['sub', 'b.txt'])
  })
  it('mixes dir leaves and files under one parent', () => {
    const [root] = buildFileTree([
      { path: 'root/newdir', meta: 'D', dir: true },
      { path: 'root/a.txt', meta: 'A' },
    ])
    assert.deepEqual(root.children.map((c) => [c.name, c.dir]), [['newdir', true], ['a.txt', false]])
    assert.equal(root.children[0].meta, 'D')
  })
})
