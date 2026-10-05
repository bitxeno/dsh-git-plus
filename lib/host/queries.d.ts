import type { SnapshotDeps, GitPanelConfig } from './core.ts';
import type { GitQueryRequest, GitQueryResponse } from './types.ts';
export declare function runQuery(deps: SnapshotDeps, config: GitPanelConfig, request: GitQueryRequest): Promise<GitQueryResponse>;
/** Resolve the git dir (handles worktree .git files) then probe MERGE/REBASE state. */
export declare function detectOperation(deps: SnapshotDeps, root: string): Promise<import('./types.ts').GitOperationState | null>;
