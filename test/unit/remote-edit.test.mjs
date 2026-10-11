import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { convertRemoteUrl, detectRemoteProtocol, isSafeRemoteName, isSafeRemoteUrl, planAction } from '../../lib/testkit.mjs'

describe('detectRemoteProtocol', () => {
  it('detects scp-like and ssh:// URLs as ssh', () => {
    assert.equal(detectRemoteProtocol('git@github.com:bitxeno/atvloadly.git'), 'ssh')
    assert.equal(detectRemoteProtocol('ssh://git@github.com/bitxeno/atvloadly.git'), 'ssh')
  })
  it('detects http(s) URLs as https', () => {
    assert.equal(detectRemoteProtocol('https://github.com/bitxeno/atvloadly.git'), 'https')
    assert.equal(detectRemoteProtocol('http://git.example.com/repo.git'), 'https')
  })
  it('returns null for anything else', () => {
    assert.equal(detectRemoteProtocol(''), null)
    assert.equal(detectRemoteProtocol('origin'), null)
    assert.equal(detectRemoteProtocol('/local/path.git'), null)
  })
})

describe('convertRemoteUrl', () => {
  it('converts scp-like SSH to HTTPS', () => {
    assert.equal(
      convertRemoteUrl('git@github.com:bitxeno/atvloadly.git', 'https'),
      'https://github.com/bitxeno/atvloadly.git',
    )
  })
  it('converts HTTPS to scp-like SSH', () => {
    assert.equal(
      convertRemoteUrl('https://github.com/bitxeno/atvloadly.git', 'ssh'),
      'git@github.com:bitxeno/atvloadly.git',
    )
  })
  it('keeps explicit ports across the conversion', () => {
    assert.equal(convertRemoteUrl('ssh://git@example.com:2222/a/b.git', 'https'), 'https://example.com:2222/a/b.git')
    assert.equal(convertRemoteUrl('https://example.com:8443/a/b.git', 'ssh'), 'ssh://git@example.com:8443/a/b.git')
  })
  it('round-trips github URLs', () => {
    const ssh = 'git@github.com:bitxeno/atvloadly.git'
    const https = convertRemoteUrl(ssh, 'https')
    assert.equal(convertRemoteUrl(https, 'ssh'), ssh)
  })
  it('returns null when not convertible', () => {
    assert.equal(convertRemoteUrl('not-a-url', 'https'), null)
    assert.equal(convertRemoteUrl('', 'ssh'), null)
  })
})

describe('edit-remote validation', () => {
  it('accepts safe remote names and urls', () => {
    assert.equal(isSafeRemoteName('origin'), true)
    assert.equal(isSafeRemoteName('upstream'), true)
    assert.equal(isSafeRemoteUrl('git@github.com:bitxeno/atvloadly.git'), true)
    assert.equal(isSafeRemoteUrl('https://github.com/bitxeno/atvloadly.git'), true)
  })
  it('rejects slashes in names and option-like urls', () => {
    assert.equal(isSafeRemoteName('foo/bar'), false)
    assert.equal(isSafeRemoteName('-evil'), false)
    assert.equal(isSafeRemoteUrl('-evil'), false)
    assert.equal(isSafeRemoteUrl('   '), false)
    assert.equal(isSafeRemoteUrl('git@github.com:bad name.git'), false)
  })
})

describe('planAction edit-remote', () => {
  it('plans rename plus set-url in order', () => {
    const r = planAction({ kind: 'edit-remote', oldName: 'origin', newName: 'upstream', url: 'https://example.com/r.git' }, false)
    assert.ok('argv' in r)
    assert.deepEqual(r.argv, [
      ['git', 'remote', 'rename', 'origin', 'upstream'],
      ['git', 'remote', 'set-url', 'upstream', 'https://example.com/r.git'],
    ])
  })
  it('plans set-url alone when the name is unchanged', () => {
    const r = planAction({ kind: 'edit-remote', oldName: 'origin', newName: 'origin', url: 'git@example.com:r.git' }, false)
    assert.ok('argv' in r)
    assert.deepEqual(r.argv, [['git', 'remote', 'set-url', 'origin', 'git@example.com:r.git']])
  })
  it('rejects unsafe names and urls', () => {
    assert.ok('error' in planAction({ kind: 'edit-remote', oldName: 'origin', newName: 'a/b', url: 'https://example.com/r.git' }, false))
    assert.ok('error' in planAction({ kind: 'edit-remote', oldName: 'origin', newName: 'origin', url: '-evil' }, false))
  })
})
