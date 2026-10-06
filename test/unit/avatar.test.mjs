import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { authorAvatarUrl, extractRepoAvatars, githubUsernameFromNoreply, gravatarUrlFor, isGhPathName, isGitHubRemote, md5Hex, parseGitHubRepo, parseGraphLog } from '../../lib/testkit.mjs'

describe('md5Hex', () => {
  it('matches known vectors', () => {
    assert.equal(md5Hex(''), 'd41d8cd98f00b204e9800998ecf8427e')
    assert.equal(md5Hex('abc'), '900150983cd24fb0d6963f7d28e17f72')
    // Gravatar docs example, normalized (verified against system md5)
    assert.equal(md5Hex('MyEmailAddress@example.com'.trim().toLowerCase()), '0bc83cb571cd1c50ba6f3e8a78ef1346')
  })
})

describe('gravatarUrlFor / isGitHubRemote', () => {
  it('builds a sized identicon URL from a normalized email', () => {
    const url = gravatarUrlFor('  Foo@Example.COM ', 36)
    assert.ok(url.startsWith('https://www.gravatar.com/avatar/'))
    assert.ok(url.includes('?s=36&d=identicon'))
    assert.equal(url, gravatarUrlFor('foo@example.com', 36))
  })
  it('detects github remotes in https and ssh forms', () => {
    assert.equal(isGitHubRemote('https://github.com/bitxeno/dsh-git-plus.git'), true)
    assert.equal(isGitHubRemote('git@github.com:bitxeno/dsh-git-plus.git'), true)
    assert.equal(isGitHubRemote('https://gitlab.com/x/y.git'), false)
    assert.equal(isGitHubRemote(''), false)
  })
  it('parses owner/repo from github remotes', () => {
    assert.deepEqual(parseGitHubRepo('https://github.com/bitxeno/dsh-git-plus.git'), { owner: 'bitxeno', repo: 'dsh-git-plus' })
    assert.deepEqual(parseGitHubRepo('git@github.com:bitxeno/dsh-git-plus.git'), { owner: 'bitxeno', repo: 'dsh-git-plus' })
    assert.deepEqual(parseGitHubRepo('https://github.com/bitxeno/dsh-git-plus'), { owner: 'bitxeno', repo: 'dsh-git-plus' })
    assert.equal(parseGitHubRepo('https://gitlab.com/x/y.git'), null)
    assert.equal(parseGitHubRepo(''), null)
  })
  it('extracts the login from noreply addresses', () => {
    assert.equal(githubUsernameFromNoreply('137328844+bitxeno@users.noreply.github.com'), 'bitxeno')
    assert.equal(githubUsernameFromNoreply('bitxeno@users.noreply.github.com'), 'bitxeno')
    assert.equal(githubUsernameFromNoreply('foo@example.com'), null)
    assert.equal(githubUsernameFromNoreply(''), null)
  })
  it('prefers the GitHub profile avatar for noreply addresses', () => {
    assert.equal(
      authorAvatarUrl('137328844+bitxeno@users.noreply.github.com', 36, true),
      'https://github.com/bitxeno.png?s=36',
    )
    const g = authorAvatarUrl('foo@example.com', 36, true)
    assert.ok(g.startsWith('https://www.gravatar.com/avatar/'))
    // non-GitHub repos never resolve (no avatar shown there)
    assert.equal(authorAvatarUrl('foo@example.com', 36, false), null)
    assert.equal(authorAvatarUrl('  ', 36, true), null)
  })
})

describe('parseGraphLog authorEmail', () => {
  it('parses the email field and keeps subjects with separators aligned', () => {
    const N = String.fromCharCode(0x1f)
    const R = String.fromCharCode(0x1e)
    const stdout = `abc123${N}abc${N}p1 p2${N}Name${N}mail@x.io${N}2026-01-01T00:00:00+00:00${N}HEAD -> main${N}subj${N}ect${R}`
    const out = parseGraphLog(stdout)
    assert.equal(out.length, 1)
    assert.equal(out[0].authorEmail, 'mail@x.io')
    assert.equal(out[0].subject, `subj${N}ect`)
  })
})

describe('extractRepoAvatars / isGhPathName', () => {
  it('pulls sha/url pairs and dedupes', () => {
    const out = extractRepoAvatars([
      { sha: 'aaa', author: { avatar_url: 'https://x/1.png' } },
      { sha: 'aaa', author: { avatar_url: 'https://x/1.png' } },
      { sha: 'bbb', author: null },
      { sha: '', author: { avatar_url: 'https://x/2.png' } },
      { sha: 'ccc', author: { avatar_url: '' } },
    ])
    assert.deepEqual(out, [{ sha: 'aaa', url: 'https://x/1.png' }])
  })
  it('rejects non-arrays and validates path names', () => {
    assert.deepEqual(extractRepoAvatars(null), [])
    assert.deepEqual(extractRepoAvatars({}), [])
    assert.equal(isGhPathName('bitxeno'), true)
    assert.equal(isGhPathName('dsh-git-plus'), true)
    assert.equal(isGhPathName('../x'), false)
    assert.equal(isGhPathName('a/b'), false)
    assert.equal(isGhPathName(''), false)
  })
})
