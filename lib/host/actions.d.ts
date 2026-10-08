import type { SnapshotDeps, GitPanelConfig } from './core.ts';
import { isSafePath } from './validate.ts';
import type { GitAction, GitActionRequest, GitActionResult, GitErrorCode, GitOperationKind } from './types.ts';
export { isSafePath };
interface CommandPlan {
    readonly argv: readonly (readonly string[])[];
}
type PlanResult = CommandPlan | {
    readonly error: GitErrorCode;
    readonly message?: string;
};
/** Network-bound git commands: they stall on remote round-trips, so they run
 * under the generous network timeout instead of the fast local-command cap. */
export declare function isNetworkCommand(argv: readonly string[]): boolean;
/** Build the git command sequence for an action. */
export declare function planAction(action: GitAction, unborn: boolean): PlanResult;
/**
 * Continue/abort command plan for an in-progress operation (mirrors the
 * reference `continueOperation`/`abortOperation` dispatch). Continue always
 * stages resolved files first; without an operation marker there is nothing
 * to finalize, so continue degrades to staging while abort reports an error.
 */
export declare function planContinueAbort(kind: 'merge-continue' | 'merge-abort', op: GitOperationKind | null): PlanResult;
/** Default push target: `origin` when present, else the first configured
 *  remote; null when the repository has no remotes. */
export declare function pickDefaultRemote(names: readonly string[]): string | null;
/** Read the configured remote names and pick the default push target. */
export declare function resolvePushRemote(deps: SnapshotDeps, root: string): Promise<string | null>;
/** Execute a management action, returning the fresh snapshot on success. */
export declare function runAction(deps: SnapshotDeps, config: GitPanelConfig, request: GitActionRequest): Promise<GitActionResult>;
/**
 * Split discard paths into untracked (removed from disk) vs tracked (git
 * restore). A path inside an untracked directory entry is itself untracked,
 * covering rows the client synthesizes by expanding such dirs (they are not
 * snapshot entries, so an exact match alone would misroute them to restore).
 */
export declare function partitionUntracked(paths: readonly string[], untracked: readonly {
    readonly path: string;
    readonly isDirectory: boolean;
}[]): {
    untracked: string[];
    tracked: string[];
};
