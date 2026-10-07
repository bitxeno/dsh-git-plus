/**
 * .gitignore pattern derivation for the changes context menu. A pattern is
 * always repo-relative; leading `#`/`!` are escaped so the line stays a plain
 * pattern (the host rejects raw comment/negation lines).
 */

export interface IgnoreOptions {
  /** Exact-match pattern (file path, or `dir/` for directories). */
  readonly exact: string
  /** Extension pattern (`*.ext`) when the file has a usable extension. */
  readonly ext?: string
}

/** Escape a leading `#`/`!` so gitignore reads the line as a pattern. */
export function escapeIgnorePattern(pattern: string): string {
  if (pattern.startsWith('#') || pattern.startsWith('!')) return `\\${pattern}`
  return pattern
}

/** Extension ignore pattern for a file path, or undefined when none applies
 * (no extension, dotfile without a real extension). A bare `*.ext` already
 * matches at any depth in gitignore, so no recursive prefix is needed. */
export function extensionPattern(path: string): string | undefined {
  const base = path.split('/').pop() ?? path
  // A leading-dot name (`.env`) has no extension; otherwise take the suffix
  // after the last dot when it is not the first or last character.
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return undefined
  const ext = base.slice(dot + 1)
  if (ext === '' || /[\s\\]/.test(ext)) return undefined
  return `*.${ext}`
}

/** Ignore options for an untracked file. */
export function ignorePatternsForFile(path: string): IgnoreOptions {
  const exact = escapeIgnorePattern(path)
  const ext = extensionPattern(path)
  return ext === undefined ? { exact } : { exact, ext }
}

/** Ignore pattern for a directory (always the `dir/` form). */
export function ignorePatternForDir(dir: string): string {
  const trimmed = dir.replace(/\/+$/, '')
  return escapeIgnorePattern(`${trimmed}/`)
}
