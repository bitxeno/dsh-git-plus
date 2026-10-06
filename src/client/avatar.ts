/**
 * Author avatars via Gravatar (email MD5, no dependency, no network at
 * lookup time — just URL construction). Shown only for GitHub remotes; the
 * `<img>` hides itself on load error so offline/broken hashes degrade to
 * the plain name.
 */

/** Lower-level MD5 (RFC 1321) returning lowercase hex. */
export function md5Hex(message: string): string {
  const bytes = new TextEncoder().encode(message)
  const bitLen = bytes.length * 8
  // Append 0x80 then zero-pad to 56 mod 64, then 64-bit little-endian length.
  const paddedLen = (((bytes.length + 8) >> 6) + 1) * 64
  const buf = new Uint8Array(paddedLen)
  buf.set(bytes)
  buf[bytes.length] = 0x80
  const view = new DataView(buf.buffer)
  view.setUint32(paddedLen - 8, bitLen >>> 0, true)
  view.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000), true)

  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]
  const T = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0)

  const M = new Array<number>(16)
  for (let off = 0; off < paddedLen; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(off + i * 4, true)
    let A = a
    let B = b
    let C = c
    let D = d
    for (let i = 0; i < 64; i++) {
      let F: number
      let g: number
      if (i < 16) { F = (B & C) | (~B & D); g = i }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16 }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16 }
      else { F = C ^ (B | ~D); g = (7 * i) % 16 }
      F = (F + A + T[i]! + M[g]!) >>> 0
      A = D
      D = C
      C = B
      B = (B + (((F << S[i]!) | (F >>> (32 - S[i]!))) >>> 0)) >>> 0
    }
    a = (a + A) >>> 0
    b = (b + B) >>> 0
    c = (c + C) >>> 0
    d = (d + D) >>> 0
  }

  const word = (n: number): string => {
    let out = ''
    for (let i = 0; i < 4; i++) out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
    return out
  }
  return word(a) + word(b) + word(c) + word(d)
}

/** Gravatar URL for an author email (`?d=identicon` keeps a deterministic fallback). */
export function gravatarUrlFor(email: string, size = 36): string {
  const hash = md5Hex(email.trim().toLowerCase())
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`
}

/**
 * GitHub login parsed from a noreply address
 * (`<id>+<login>@users.noreply.github.com` or `<login>@users.noreply.github.com`).
 * Null for ordinary addresses.
 */
export function githubUsernameFromNoreply(email: string): string | null {
  const m = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i.exec(email.trim())
  return m ? m[1]! : null
}

/**
 * Best avatar URL for a commit author. Only GitHub repos resolve (Gravatar
 * for ordinary addresses, the GitHub profile avatar for noreply addresses
 * that carry no Gravatar photo); anything else returns null (no avatar).
 */
export function authorAvatarUrl(email: string, size: number, isGitHub: boolean): string | null {
  if (!isGitHub) return null
  const trimmed = email.trim()
  if (trimmed === '') return null
  const login = githubUsernameFromNoreply(trimmed)
  if (login) return `https://github.com/${login}.png?s=${size}`
  return gravatarUrlFor(trimmed, size)
}

/** True for github.com remote URLs (https and ssh forms). */
export function isGitHubRemote(url: string): boolean {
  return /github\.com[:/]/i.test(url.trim())
}

export interface GitHubRepo {
  readonly owner: string
  readonly repo: string
}

/**
 * `owner/repo` parsed from a github.com remote URL (https, ssh, with or
 * without `.git`). Null for anything else.
 */
export function parseGitHubRepo(url: string): GitHubRepo | null {
  const m = /github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(url.trim())
  if (!m) return null
  return { owner: m[1]!, repo: m[2]! }
}
