import type { SnapshotDeps, GitPanelConfig } from './core.ts';
import type { GitQueryRequest, GitQueryResponse } from './types.ts';
export declare function runQuery(deps: SnapshotDeps, config: GitPanelConfig, request: GitQueryRequest): Promise<GitQueryResponse>;
/**
 * Conflicted paths from `git merge-tree --write-tree` output. The header tree
 * OID is followed by one `<mode> <oid> <stage>\t<path>` line per conflicted
 * index entry, terminated by a blank line; the prose "CONFLICT (...)" section
 * after it is unreliable (wording varies by conflict type), so we read the
 * structured entries only. Pure so the parsing stays unit-testable.
 */
export declare function parseMergeTreeConflicts(stdout: string): string[];
/** Resolve the git dir (handles worktree .git files) then probe MERGE/REBASE state. */
export declare function detectOperation(deps: SnapshotDeps, root: string): Promise<import('./types.ts').GitOperationState | null>;
