import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { stripRefNamespace, parseRemoteUrls } from '../../lib/testkit.mjs'

describe('stripRefNamespace', () => {
  it('strips the queried namespace to the true short name', () => {
    // Regression: branch `Go` vs tag `go` made `%(refname:short)` report
    // `heads/Go` (and the tag `tags/go`); full names strip exactly.
    assert.equal(stripRefNamespace('refs/heads/Go', 'heads'), 'Go')
    assert.equal(stripRefNamespace('refs/remotes/origin/Go', 'remotes'), 'origin/Go')
    assert.equal(stripRefNamespace('refs/tags/go', 'tags'), 'go')
  })
  it('keeps a genuine nested prefix (single strip only)', () => {
    assert.equal(stripRefNamespace('refs/heads/heads/foo', 'heads'), 'heads/foo')
    assert.equal(stripRefNamespace('refs/heads/feature/x', 'heads'), 'feature/x')
    assert.equal(stripRefNamespace('refs/remotes/origin/HEAD', 'remotes'), 'origin/HEAD')
  })
  it('passes through names outside the namespace', () => {
    assert.equal(stripRefNamespace('main', 'heads'), 'main')
    assert.equal(stripRefNamespace('', 'heads'), '')
    assert.equal(stripRefNamespace('refs/tags/v1', 'heads'), 'refs/tags/v1')
  })
})

describe('parseRemoteUrls', () => {
  it('maps each remote to its fetch URL', () => {
    const out = parseRemoteUrls(
      'origin\tgit@github.com:bitxeno/GuguClip.git (fetch)\n' +
      'origin\tgit@github.com:bitxeno/GuguClip.git (push)\n' +
      'upstream\thttps://gitlab.com/acme/fork.git (fetch)\n' +
      'upstream\thttps://gitlab.com/acme/fork.git (push)\n',
    )
    assert.deepEqual(out, {
      origin: 'git@github.com:bitxeno/GuguClip.git',
      upstream: 'https://gitlab.com/acme/fork.git',
    })
  })
  it('prefers fetch over push and skips garbage', () => {
    const out = parseRemoteUrls('solo\thttps://example.com/r.git (push)\nnot-a-remote-line\n')
    assert.deepEqual(out, { solo: 'https://example.com/r.git' })
    assert.deepEqual(parseRemoteUrls(''), {})
  })
})
