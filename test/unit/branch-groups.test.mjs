import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildBranchFolderTree, splitDefaultBranch } from '../../lib/testkit.mjs'

const b = (name) => ({ name, shortHash: null })

describe('buildBranchFolderTree', () => {
  it('folds slash names into folders and leaves plain names at root', () => {
    const nodes = buildBranchFolderTree([b('main'), b('feature/x'), b('feature/sub/y')])
    assert.deepEqual(nodes.map((n) => n.kind), ['folder', 'branch'])
    const [feature, main] = nodes
    assert.equal(feature.path, 'feature')
    assert.equal(feature.count, 2)
    // `feature/x` is a direct leaf; `feature/sub` stays a nested folder.
    assert.deepEqual(feature.children.map((n) => (n.kind === 'branch' ? n.branch.name : n.path)), ['feature/sub', 'feature/x'])
    assert.equal(main.branch.name, 'main')
  })

  it('collapses single-child folder chains', () => {
    const [folder] = buildBranchFolderTree([b('a/b/c')])
    assert.equal(folder.path, 'a/b')
    assert.equal(folder.name, 'a/b')
  })
})

describe('buildBranchFolderTree pinnedRef', () => {
  it('keeps a pinned remote ref inside its folder and leads the folder', () => {
    const nodes = buildBranchFolderTree(
      [b('origin/10.11'), b('origin/10.8'), b('origin/main'), b('origin/protobuf')],
      { pinnedRef: 'origin/main' },
    )
    assert.equal(nodes.length, 1)
    const [origin] = nodes
    assert.equal(origin.kind, 'folder')
    assert.equal(origin.path, 'origin')
    // `origin` owns every ref: nothing is hoisted out of it.
    assert.deepEqual(origin.children.map((c) => c.branch.name), [
      'origin/main',
      'origin/10.11',
      'origin/10.8',
      'origin/protobuf',
    ])
    assert.equal(origin.children[0].isDefault, true)
    assert.equal(origin.children[0].displayName, 'main')
    assert.equal(origin.count, 4)
  })

  it('leaves the order untouched when the pinned ref is absent', () => {
    const nodes = buildBranchFolderTree([b('origin/10.8'), b('origin/main')])
    assert.deepEqual(nodes[0].children.map((c) => c.branch.name), ['origin/10.8', 'origin/main'])
    assert.equal(nodes[0].children.some((c) => c.isDefault === true), false)
  })

  it('hoists a pinned root leaf to the front without a folder', () => {
    const nodes = buildBranchFolderTree([b('alpha'), b('main'), b('zeta')], { pinnedRef: 'main' })
    assert.deepEqual(nodes.map((n) => n.branch.name), ['main', 'alpha', 'zeta'])
    assert.equal(nodes[0].isDefault, true)
    assert.equal(nodes[1].isDefault, undefined)
  })

  it('keeps a pinned ref in a nested folder rather than the root', () => {
    const nodes = buildBranchFolderTree(
      [b('origin/feature/a'), b('origin/feature/b')],
      { pinnedRef: 'origin/feature/b' },
    )
    assert.equal(nodes.length, 1)
    const [origin] = nodes
    // The `origin` → `feature` chain collapses, but the ref stays nested.
    assert.equal(origin.kind, 'folder')
    assert.equal(origin.path, 'origin/feature')
    assert.deepEqual(origin.children.map((c) => c.branch.name), ['origin/feature/b', 'origin/feature/a'])
    assert.equal(origin.children[0].isDefault, true)
  })
})

describe('splitDefaultBranch', () => {
  it('splits the default branch from the rest', () => {
    const { pinned, rest } = splitDefaultBranch([b('main'), b('dev')], 'main')
    assert.equal(pinned.name, 'main')
    assert.deepEqual(rest.map((x) => x.name), ['dev'])
  })

  it('returns no pin when the default branch is missing or unset', () => {
    assert.deepEqual(splitDefaultBranch([b('dev')], 'main'), { pinned: null, rest: [b('dev')] })
    assert.equal(splitDefaultBranch([b('dev')], null).pinned, null)
  })
})
