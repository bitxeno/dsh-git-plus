/**
 * git output parsers: porcelain status, log, branch, numstat, name-status.
 * Pure functions over raw stdout, no I/O.
 */
import type { GitBranch, GitChange, GitFileStat, GraphCommit, GitRef, StashEntry } from './types.ts';
/**
 * Parse `git status --porcelain=v1 -z`. A mixed XY (both non-space, e.g. MM)
 * is split into a staged side (X) and an unstaged side (Y). Untracked (??) is
 * a single unstaged entry. Real conflicts (UU/AA/DD…) stay one entry.
 */
export declare function parseStatus(stdout: string): GitChange[];
/**
 * Parse a graph log emitted with the record format:
 *   %H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%s%x1e
 * (unit sep 0x1f between fields, record sep 0x1e between commits.)
 */
export declare function parseGraphLog(stdout: string): GraphCommit[];
/** Parse the `%D` decoration into structured refs. */
export declare function parseRefs(decoration: string): GitRef[];
/** Parse `git for-each-ref` branch lines: `name\0shortHash\0track\0upstream`. */
export declare function parseBranches(stdout: string): GitBranch[];
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
export declare function markRemotePresence(local: readonly GitBranch[], remote: readonly GitBranch[] | null, remotes: readonly string[]): GitBranch[];
/** Parse `git for-each-ref` tag lines: `name\0shortHash` per line. */
export declare function parseTags(stdout: string): GitBranch[];
/**
 * Parse `git show --name-status -z` into stats with an explicit state machine:
 * read a status token, then consume exactly the paths it owns (2 for R/C, 1
 * otherwise). A malformed token stops the scan rather than silently shifting
 * every later field, so one bad entry can't corrupt the whole list.
 */
export declare function parseNameStatus(stdout: string): GitFileStat[];
/** Sum `git diff --numstat` output: { insertions, deletions }. Binary rows ("-") skipped. */
export declare function sumNumstat(stdout: string): {
    insertions: number;
    deletions: number;
};
/**
 * Parse `git stash list --format=%gd%00%gs%00%aI%00%P%00%H`:
 * one line per entry, NUL-separated fields. Failure yields [] upstream.
 */
export declare function parseStashList(stdout: string): StashEntry[];
export interface BranchHeader {
    readonly branch: string | null;
    readonly ahead: number;
    readonly behind: number;
}
/**
 * Parse the `## ...` lead field of `git status -b --porcelain=v1 -z`:
 * `## main...origin/main [ahead 2]`, `## main`, `## HEAD (no branch)`,
 * `## No commits yet on main`. Detached covers rebase/bisect variants.
 */
export declare function parseBranchHeader(field: string): BranchHeader;
