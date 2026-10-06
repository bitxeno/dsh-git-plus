/**
 * GitHub commit avatars via the local `gh` CLI (uses its own credential
 * store — the token never passes through our code). Covers private repos
 * where the anonymous API returns 404. Anything unresolved (no `gh`, not
 * logged in, rate-limited, offline) yields an empty list and callers fall
 * back to the client fetch + rule-based avatars.
 */

export interface RepoAvatar {
  readonly sha: string
  readonly url: string
}

/** Owner/repo names as they appear in a URL path segment. */
export function isGhPathName(name: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(name)
}

interface GhCommit {
  readonly sha?: unknown
  readonly author?: { readonly avatar_url?: unknown } | null
}

/** Pull `{sha, url}` pairs out of a `gh api .../commits` JSON payload. */
export function extractRepoAvatars(payload: unknown): RepoAvatar[] {
  if (!Array.isArray(payload)) return []
  const out: RepoAvatar[] = []
  const seen = new Set<string>()
  for (const c of payload as GhCommit[]) {
    if (typeof c?.sha !== 'string' || c.sha === '') continue
    const url = c?.author?.avatar_url
    if (typeof url !== 'string' || url === '' || seen.has(c.sha)) continue
    seen.add(c.sha)
    out.push({ sha: c.sha, url })
  }
  return out
}

const CACHE_TTL_MS = 10 * 60 * 1000
const cache = new Map<string, { at: number; avatars: readonly RepoAvatar[] }>()

export function getCachedAvatars(owner: string, repo: string): readonly RepoAvatar[] | null {
  const hit = cache.get(`${owner}/${repo}`)
  if (!hit || Date.now() - hit.at >= CACHE_TTL_MS) return null
  return hit.avatars
}

export function setCachedAvatars(owner: string, repo: string, avatars: readonly RepoAvatar[]): void {
  cache.set(`${owner}/${repo}`, { at: Date.now(), avatars })
}
