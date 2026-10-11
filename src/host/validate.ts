/**
 * Input validation for the host trust boundary. Paths, refs, and branch names
 * arriving over RPC are the only untrusted argv material; every git command
 * that would otherwise place them in an option position is guarded here and,
 * belt-and-suspenders, passes them after `--end-of-options`.
 */
import { isAbsolute, normalize } from 'node:path'

/** A repository-relative path is safe when it stays inside the work tree. */
export function isSafePath(path: string): boolean {
  if (path === '' || isAbsolute(path)) return false
  const norm = normalize(path)
  if (norm === '..' || norm.startsWith('../') || norm.startsWith('..\\')) return false
  return true
}

// Control chars, space, DEL, and the glob / rev-expression metacharacters a
// plain branch/tag/commit ref we filter by must never contain.
const REV_META = /[\x00-\x20\x7f~^:?*[\\]/

/**
 * A ref (branch / tag / commit-ish) is safe as a bare argv element: no leading
 * `-` (would be parsed as a git option — the `--output=` file-write vector),
 * no whitespace/control chars, no glob or rev-range metacharacters.
 */
export function isSafeRev(input: string): boolean {
  if (input === '' || input.startsWith('-')) return false
  if (REV_META.test(input)) return false
  if (input.includes('..') || input.includes('@{')) return false
  return true
}

/** A branch name for `git checkout`: the ref rules plus no leading slash. */
export function isSafeBranchName(name: string): boolean {
  return isSafeRev(name) && !name.startsWith('/')
}

/**
 * A remote name for `git remote rename` / `set-url`: ref-safe, and no `/`
 * (it becomes `refs/remotes/<name>/…`, so a slash would nest tracking refs).
 */
export function isSafeRemoteName(name: string): boolean {
  return isSafeRev(name) && !name.includes('/')
}

/**
 * A remote URL for `git remote set-url` / `git ls-remote`: a trimmed,
 * non-empty single line that cannot be parsed as a git option. Colons,
 * `@` and `/` are legitimate URL material, so only whitespace/control
 * characters and a leading `-` are rejected.
 */
export function isSafeRemoteUrl(url: string): boolean {
  const trimmed = url.trim()
  if (trimmed === '' || trimmed.length > 2048) return false
  if (trimmed.startsWith('-')) return false
  if (/[\x00-\x20\x7f]/.test(trimmed)) return false
  return true
}

// A .gitignore pattern is safe when it is a single line without control
// characters that stays inside the work tree: no absolute paths, no `..`
// segments (meaningless in a gitignore and a traversal smell). Leading
// `#`/`!` (comment/negation) are rejected — the caller escapes them instead.
export function isSafeIgnorePattern(pattern: string): boolean {
  if (pattern === '' || pattern.length > 512) return false
  if (/[\x00-\x1f\x7f]/.test(pattern)) return false
  if (isAbsolute(pattern)) return false
  const trimmed = pattern.trim()
  if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!')) return false
  const segs = trimmed.split('/')
  return !segs.some((s) => s === '..')
}
