/**
 * git output parsers: porcelain status, log, branch, numstat, name-status.
 * Pure functions over raw stdout, no I/O.
 */
import type { GitBranch, GitChange, GitChangeStatus, GitFileStat, GraphCommit, GitRef, StashEntry } from './types.ts'

/** Map a porcelain single-column status char to our status vocabulary. */
function statusOf(code: string): GitChangeStatus {
  switch (code) {
    case 'A': return 'added'
    case 'M': return 'modified'
    case 'D': return 'deleted'
    case 'R': return 'renamed'
    case 'C': return 'added'
    case 'T': return 'typechange'
    case 'U': return 'conflicted'
    case '?': return 'untracked'
    default: return 'modified'
  }
}

/**
 * Parse `git status --porcelain=v1 -z`. A mixed XY (both non-space, e.g. MM)
 * is split into a staged side (X) and an unstaged side (Y). Untracked (??) is
 * a single unstaged entry. Real conflicts (UU/AA/DD…) stay one entry.
 */
export function parseStatus(stdout: string): GitChange[] {
  const out: GitChange[] = []
  const records = stdout.split('\0')
  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    if (rec === undefined || rec.length < 3) continue
    const x = rec[0]!
    const y = rec[1]!
    let path = rec.slice(3)
    // Renames/copies encode "new\0old" — the old path is the next NUL field.
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') {
      i++ // consume the old-path field
    }
    const isDirectory = path.endsWith('/')
    if (isDirectory) path = path.replace(/\/+$/, '')
    if (x === '?' && y === '?') {
      out.push({ path, status: 'untracked', staged: false, isDirectory })
      continue
    }
    if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
      out.push({ path, status: 'conflicted', staged: false, isDirectory })
      continue
    }
    if (x !== ' ' && x !== '?') {
      out.push({ path, status: statusOf(x), staged: true, isDirectory })
    }
    if (y !== ' ' && y !== '?') {
      out.push({ path, status: statusOf(y), staged: false, isDirectory })
    }
  }
  return out
}

/**
 * Parse a graph log emitted with the record format:
 *   %H%x1f%h%x1f%P%x1f%an%x1f%aI%x1f%D%x1f%s%x1e
 * (unit sep 0x1f between fields, record sep 0x1e between commits.)
 */
export function parseGraphLog(stdout: string): GraphCommit[] {
  const out: GraphCommit[] = []
  for (const record of stdout.split('\x1e')) {
    const rec = record.replace(/^\n+/, '')
    if (rec.trim() === '') continue
    // Bounded split: the subject (last field) may itself contain a stray 0x1f
    // from crafted commit metadata; capping at 7 pieces keeps every earlier
    // field aligned and folds any extra separators back into the subject.
    const parts = rec.split('\x1f')
    if (parts.length < 7) continue
    const [hash, shortHash, parentsRaw, author, dateIso, decoration] = parts
    const subject = parts.slice(6).join('\x1f')
    const parents = (parentsRaw ?? '').trim() === '' ? [] : parentsRaw!.trim().split(/\s+/)
    out.push({
      hash: hash ?? '',
      shortHash: shortHash ?? '',
      subject,
      author: author ?? '',
      dateIso: dateIso ?? '',
      parents,
      refs: parseRefs(decoration ?? ''),
    })
  }
  return out
}

/** Parse the `%D` decoration into structured refs. */
export function parseRefs(decoration: string): GitRef[] {
  const refs: GitRef[] = []
  for (const raw of decoration.split(',')) {
    let token = raw.trim()
    if (token === '') continue
    let head = false
    if (token.startsWith('HEAD -> ')) {
      head = true
      token = token.slice('HEAD -> '.length).trim()
    } else if (token === 'HEAD') {
      continue
    }
    if (token.startsWith('tag: ')) {
      refs.push({ kind: 'tag', name: token.slice('tag: '.length).trim(), head: false })
    } else if (token.startsWith('origin/') || token.includes('/')) {
      refs.push({ kind: 'remote', name: token, head })
    } else {
      refs.push({ kind: 'branch', name: token, head })
    }
  }
  return refs
}

/** Parse `git for-each-ref` branch lines: `name\0shortHash\0track\0upstream`. */
export function parseBranches(stdout: string): GitBranch[] {
  const out: GitBranch[] = []
  for (const line of stdout.split('\n')) {
    if (line.trim() === '') continue
    const [name, shortHash = '', track = '', upstream = ''] = line.split('\0')
    if (name === undefined || name === '') continue
    const branch: {
      name: string
      shortHash: string | null
      ahead?: number
      behind?: number
      upstream?: string
    } = {
      name,
      shortHash: shortHash === '' ? null : shortHash,
    }
    if (upstream !== '') branch.upstream = upstream
    const ahead = /ahead (\d+)/.exec(track)
    const behind = /behind (\d+)/.exec(track)
    if (ahead) branch.ahead = Number(ahead[1])
    if (behind) branch.behind = Number(behind[1])
    out.push(branch)
  }
  return out
}

/**
 * Mark which local branches also exist on a remote, judged purely from local
 * state — no network probe. A branch is remote-backed when its configured
 * upstream is a remote-tracking ref that still exists, or when some remote
 * tracks a branch of the same name (`refs/remotes/<remote>/<name>`).
 *
 * `remotes` are the configured remote names; `remote` the fetched
 * remote-tracking refs, or `null` when that listing could not be read (a
 * failed command is *unknown*, not empty, and must not mark anything).
 *
 * With no remote configured nothing is marked (`onRemote` stays `undefined`):
 * there is no remote for a branch to be absent from, so a purely local repo is
 * left alone rather than greying its whole list. Once a remote is configured, a
 * branch with no matching remote-tracking ref is local-only — including the
 * case of an empty `remote` list, which is exactly a remote that has been
 * added but never fetched or pushed to (nothing of ours is on it yet).
 */
export function markRemotePresence(
  local: readonly GitBranch[],
  remote: readonly GitBranch[] | null,
  remotes: readonly string[],
): GitBranch[] {
  if (remotes.length === 0 || remote === null) return local.map((branch) => ({ ...branch }))
  const remoteSet = new Set(remotes)
  const remoteRefs = new Set(remote.map((branch) => branch.name))
  // Remote branch names with the `<remote>/` prefix stripped, so a local
  // `feature/x` matches `origin/feature/x` (and any other remote's copy).
  const remoteNames = new Set<string>()
  for (const branch of remote) {
    const slash = branch.name.indexOf('/')
    if (slash > 0 && slash < branch.name.length - 1) remoteNames.add(branch.name.slice(slash + 1))
  }
  return local.map((branch) => {
    const upstream = branch.upstream ?? ''
    // Only a `<configured remote>/<name>` upstream is authoritative: the branch
    // is published exactly when that remote-tracking ref exists. A local
    // upstream (`git branch -u other`) proves nothing, so fall back to the
    // by-name match.
    const slash = upstream.indexOf('/')
    const isRemoteUpstream = slash > 0 && remoteSet.has(upstream.slice(0, slash))
    const onRemote = isRemoteUpstream ? remoteRefs.has(upstream) : remoteNames.has(branch.name)
    return { ...branch, onRemote }
  })
}

/** Parse `git for-each-ref` tag lines: `name\0shortHash` per line. */
export function parseTags(stdout: string): GitBranch[] {
  const out: GitBranch[] = []
  for (const line of stdout.split('\n')) {
    if (line.trim() === '') continue
    const [name, shortHash = ''] = line.split('\0')
    if (name) out.push({ name, shortHash: shortHash === '' ? null : shortHash })
  }
  return out
}

/**
 * Parse `git show --name-status -z` into stats with an explicit state machine:
 * read a status token, then consume exactly the paths it owns (2 for R/C, 1
 * otherwise). A malformed token stops the scan rather than silently shifting
 * every later field, so one bad entry can't corrupt the whole list.
 */
export function parseNameStatus(stdout: string): GitFileStat[] {
  const out: GitFileStat[] = []
  const tokens = stdout.split('\0')
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok === undefined || tok === '') { i += 1; continue }
    const code = tok[0]
    if (code === undefined || !/[AMDRCTU]/.test(code)) break
    if (code === 'R' || code === 'C') {
      const newPath = tokens[i + 2] // R/C: status, old, new
      if (newPath === undefined) break
      out.push({ path: newPath, status: statusOf(code) })
      i += 3
    } else {
      const path = tokens[i + 1]
      if (path === undefined) break
      if (path !== '') out.push({ path, status: statusOf(code) })
      i += 2
    }
  }
  return out
}

/** Sum `git diff --numstat` output: { insertions, deletions }. Binary rows ("-") skipped. */
export function sumNumstat(stdout: string): { insertions: number; deletions: number } {
  let insertions = 0
  let deletions = 0
  for (const line of stdout.split('\n')) {
    if (line.trim() === '') continue
    const parts = line.split('\t')
    if (parts.length < 2) continue
    const add = Number(parts[0])
    const del = Number(parts[1])
    if (Number.isFinite(add)) insertions += add
    if (Number.isFinite(del)) deletions += del
  }
  return { insertions, deletions }
}

/**
 * Parse `git stash list --format=%gd%00%gs%00%aI%00%P%00%H`:
 * one line per entry, NUL-separated fields. Failure yields [] upstream.
 */
export function parseStashList(stdout: string): StashEntry[] {
  const out: StashEntry[] = []
  for (const line of stdout.split('\n')) {
    if (line.trim() === '') continue
    const [ref, msg = '', dateIso = '', parentHash = '', hash = ''] = line.split('\0')
    if (!ref) continue
    const m = /^stash@\{(\d+)\}$/.exec(ref.trim())
    if (!m) continue
    out.push({
      index: Number(m[1]),
      message: msg,
      dateIso,
      parentHash,
      hash,
    })
  }
  return out
}
