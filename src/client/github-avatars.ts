/**
 * GitHub commit avatars by SHA.
 *
 * Email alone cannot resolve a GitHub user, so for github.com repos we
 * resolve SHA → `avatar_url` in two tiers:
 *   1. Host `github-avatars` query (local `gh` auth: private repos included).
 *   2. Anonymous `api.github.com` fetch (public repos only).
 * Results persist in localStorage for a week. Anything unresolved (offline,
 * rate-limited, unlinked email) falls back to the rule-based
 * `authorAvatarUrl`.
 */
import { useEffect, useState } from 'react'
import { queryAs, type GitPanelRemote } from './rpc'
import type { GitHubRepo } from './avatar'

interface CachedAvatar {
  readonly url: string
  readonly at: number
}

const CACHE_KEY = 'gp.github-avatars.v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_CAP = 2000

function readCache(): Map<string, CachedAvatar> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return new Map()
    const obj = JSON.parse(raw) as Record<string, CachedAvatar>
    const now = Date.now()
    const out = new Map<string, CachedAvatar>()
    for (const [sha, entry] of Object.entries(obj)) {
      if (typeof entry?.url === 'string' && typeof entry?.at === 'number' && now - entry.at < CACHE_TTL_MS) {
        out.set(sha, entry)
      }
    }
    return out
  } catch {
    return new Map()
  }
}

function writeCache(map: Map<string, CachedAvatar>): void {
  try {
    const entries = [...map.entries()].slice(-CACHE_CAP)
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch { /* quota or privacy mode: in-memory map still works for the session */ }
}

function toUrlMap(cache: Map<string, CachedAvatar>): Map<string, string> {
  return new Map([...cache.entries()].map(([sha, e]) => [sha, e.url] as const))
}

interface ApiCommit {
  readonly sha?: string
  readonly author?: { readonly avatar_url?: string } | null
}

function mergeCommits(into: Map<string, CachedAvatar>, list: ApiCommit[]): boolean {
  if (!Array.isArray(list)) return false
  let changed = false
  for (const c of list) {
    const url = c.author?.avatar_url
    if (typeof c.sha === 'string' && typeof url === 'string' && url !== '' && !into.has(c.sha)) {
      into.set(c.sha, { url, at: Date.now() })
      changed = true
    }
  }
  return changed
}

/** SHA → avatar_url for the repo's first commits page (cached). */
export function useGitHubAvatarMap(
  repo: GitHubRepo | null,
  remote: GitPanelRemote,
  sessionId: string,
): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(() => new Map())
  useEffect(() => {
    if (repo === null) return
    let alive = true
    const cache = readCache()
    if (cache.size > 0) setMap(toUrlMap(cache))
    void (async () => {
      // Tier 1: host `gh` auth (private repos included, token never exposed).
      try {
        const res = await remote.query({ sessionId, query: { kind: 'github-avatars', owner: repo.owner, repo: repo.repo } })
        const v = queryAs(res, 'github-avatars')
        if (alive && v !== null && v.avatars.length > 0) {
          const next = new Map(cache)
          let changed = false
          for (const a of v.avatars) {
            if (!next.has(a.sha)) {
              next.set(a.sha, { url: a.url, at: Date.now() })
              changed = true
            }
          }
          if (changed) {
            writeCache(next)
            if (alive) setMap(toUrlMap(next))
            return
          }
        }
      } catch { /* fall through to the anonymous fetch */ }
      // Tier 2: anonymous API (public repos; private yields 404 → fallbacks).
      if (typeof fetch !== 'function') return
      try {
        const res = await fetch(
          `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits?per_page=100`,
          { headers: { Accept: 'application/vnd.github+json' } },
        )
        if (!alive || !res.ok) return
        const next = new Map(cache)
        if (!mergeCommits(next, (await res.json()) as ApiCommit[])) return
        writeCache(next)
        if (alive) setMap(toUrlMap(next))
      } catch { /* offline / rate-limited: keep cache + fallbacks */ }
    })()
    return () => { alive = false }
  }, [repo?.owner, repo?.repo])
  return map
}
