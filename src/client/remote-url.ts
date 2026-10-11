/**
 * Remote URL protocol helpers for the Edit-remote dialog: detect whether a
 * remote URL is SSH or HTTPS shaped, and convert between the two so the
 * protocol dropdown can rewrite the URL in place (Tower-style).
 *
 * SSH shapes: scp-like `user@host:path` and `ssh://[user@]host[:port]/path`.
 * HTTPS shapes: `http(s)://host[:port]/path` (userinfo, when present, is
 * dropped on the way to SSH — the `git` user is used instead).
 */

export type RemoteProtocol = 'ssh' | 'https'

/** `user@host:path` (scp-like); the colon must come after the `@`. */
const SCP_LIKE = /^([^@/\s]+)@([^:/\s]+):(.+)$/

/** `ssh://[user@]host[:port]/path`. */
const SSH_URL = /^ssh:\/\/(?:([^@/:\s]+)@)?([^/:\s]+)(?::(\d+))?(\/.*)?$/

/** `http(s)://[user[:pass]@]host[:port]/path`. */
const HTTP_URL = /^(https?):\/\/(?:([^@/\s]+)@)?([^/:\s]+)(?::(\d+))?(\/.*)?$/

/** SSH vs HTTPS shape of a remote URL, or null when neither applies. */
export function detectRemoteProtocol(url: string): RemoteProtocol | null {
  const trimmed = url.trim()
  if (trimmed === '') return null
  if (SSH_URL.test(trimmed) || SCP_LIKE.test(trimmed)) return 'ssh'
  const http = HTTP_URL.exec(trimmed)
  if (http !== null && (http[1] === 'http' || http[1] === 'https')) return 'https'
  return null
}

function stripLeadingSlash(path: string | undefined): string {
  if (path === undefined || path === '') return ''
  return path.startsWith('/') ? path.slice(1) : path
}

/**
 * Rewrite `url` into the `target` protocol shape. Returns the rewritten URL,
 * or null when the input is not a convertible remote URL.
 */
export function convertRemoteUrl(url: string, target: RemoteProtocol): string | null {
  const trimmed = url.trim()
  if (trimmed === '') return null
  if (target === 'https') {
    const ssh = SSH_URL.exec(trimmed)
    if (ssh !== null) {
      const host = ssh[2]!
      const port = ssh[3] !== undefined ? `:${ssh[3]}` : ''
      return `https://${host}${port}/${stripLeadingSlash(ssh[4])}`
    }
    const scp = SCP_LIKE.exec(trimmed)
    if (scp !== null) return `https://${scp[2]}/${stripLeadingSlash(scp[3])}`
    return detectRemoteProtocol(trimmed) === 'https' ? trimmed : null
  }
  const http = HTTP_URL.exec(trimmed)
  if (http !== null) {
    const host = http[3]!
    const path = stripLeadingSlash(http[5])
    if (http[4] !== undefined) return `ssh://git@${host}:${http[4]}/${path}`
    return `git@${host}:${path}`
  }
  return detectRemoteProtocol(trimmed) === 'ssh' ? trimmed : null
}
