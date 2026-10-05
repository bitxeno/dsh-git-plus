/**
 * dsh-git-plus host wire data model — authoritative type source.
 * Extends dsh-git-panel with stash / merge / branch-tag management /
 * conflict + operation state for the sidebar panel.
 */
export type DiffViewMode = 'unified' | 'split';
export interface GitSnapshotRequest {
    readonly sessionId: string;
}
export type GitSnapshotResult = {
    readonly ok: true;
    readonly value: GitSnapshot;
} | {
    readonly ok: false;
    readonly error: GitFailure;
};
export type GitFailure = {
    readonly code: 'cwd-unavailable';
    readonly sessionId: string;
} | {
    readonly code: 'not-a-git-repo';
    readonly cwd?: string;
    readonly showInputPill?: boolean;
} | {
    readonly code: 'git-unavailable';
    readonly detail: string;
} | {
    readonly code: 'timeout';
} | {
    readonly code: 'cancelled';
};
export interface GitSnapshot {
    readonly root: string;
    readonly branch: string | null;
    readonly head: string | null;
    readonly unborn: boolean;
    readonly dirty: boolean;
    readonly staged: number;
    readonly modified: number;
    readonly untracked: number;
    readonly ahead: number;
    readonly behind: number;
    readonly lastCommit: GitCommit | null;
    readonly changes: readonly GitChange[];
    readonly stats: WorktreeStats;
    readonly truncated: boolean;
    readonly refreshIntervalMs: number;
    readonly showInputPill: boolean;
    readonly defaultDiffView: DiffViewMode;
    readonly checkedAt: number;
    /** Files with unresolved merge conflicts (diff --name-only --diff-filter=U). */
    readonly conflictFiles: readonly string[];
    /** In-progress operation (merge/rebase/cherry-pick/revert) or null. */
    readonly operation: GitOperationState | null;
    /** Number of stash entries (cheap count for the sidebar badge). */
    readonly stashCount: number;
}
export interface GitCommit {
    readonly hash: string;
    readonly shortHash: string;
    readonly subject: string;
    readonly author: string;
    readonly dateIso: string;
}
export interface GraphCommit extends GitCommit {
    readonly parents: readonly string[];
    readonly refs: readonly GitRef[];
}
export interface GitRef {
    readonly kind: 'branch' | 'remote' | 'tag';
    readonly name: string;
    readonly head: boolean;
}
export type GitChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicted' | 'typechange';
export interface GitChange {
    readonly path: string;
    readonly status: GitChangeStatus;
    readonly staged: boolean;
    readonly isDirectory: boolean;
}
/** One stash entry from `git stash list`. */
export interface StashEntry {
    readonly index: number;
    readonly message: string;
    readonly dateIso: string;
    readonly hash: string;
    readonly parentHash: string;
}
/** In-progress git operation detected from the git dir. */
export type GitOperationKind = 'merge' | 'rebase' | 'cherry-pick' | 'revert';
export interface GitOperationState {
    readonly kind: GitOperationKind;
    /** Conflicted paths with per-file resolved flag (staged vs still U). */
    readonly files: readonly {
        readonly path: string;
        readonly resolved: boolean;
    }[];
}
export type GitAction = {
    readonly kind: 'stage';
    readonly paths: readonly string[];
} | {
    readonly kind: 'stage-all';
} | {
    readonly kind: 'unstage';
    readonly paths: readonly string[];
} | {
    readonly kind: 'unstage-all';
} | {
    readonly kind: 'discard';
    readonly paths: readonly string[];
} | {
    readonly kind: 'commit';
    readonly message: string;
    readonly paths?: readonly string[];
    readonly amend?: boolean;
} | {
    readonly kind: 'branch-checkout';
    readonly name: string;
} | {
    readonly kind: 'fetch';
} | {
    readonly kind: 'create-branch';
    readonly name: string;
    readonly startPoint?: string;
    readonly checkout?: boolean;
} | {
    readonly kind: 'delete-branch';
    readonly name: string;
    readonly force?: boolean;
} | {
    readonly kind: 'create-tag';
    readonly name: string;
    readonly ref?: string;
    readonly message?: string;
    /** Push the new tag to a remote after creating it. */
    readonly push?: boolean;
    /** Host-resolved push target (origin, else the first remote). */
    readonly pushRemote?: string;
} | {
    readonly kind: 'delete-tag';
    readonly name: string;
} | {
    readonly kind: 'merge';
    readonly branch: string;
    readonly noFf?: boolean;
    readonly ffOnly?: boolean;
    readonly squash?: boolean;
} | {
    readonly kind: 'merge-abort';
} | {
    readonly kind: 'merge-continue';
} | {
    readonly kind: 'stash-save';
    readonly message?: string;
    readonly includeUntracked?: boolean;
    readonly keepIndex?: boolean;
} | {
    readonly kind: 'stash-apply';
    readonly index: number;
} | {
    readonly kind: 'stash-pop';
    readonly index: number;
} | {
    readonly kind: 'stash-drop';
    readonly index: number;
} | {
    readonly kind: 'rebase';
    readonly onto: string;
    readonly autostash?: boolean;
} | {
    readonly kind: 'worktree-add';
    readonly path: string;
    readonly branch?: string;
    readonly newBranch?: string;
};
export type GitErrorCode = 'cwd-unavailable' | 'not-a-git-repo' | 'git-unavailable' | 'invalid-path' | 'invalid-name' | 'git-error' | 'timeout' | 'cancelled' | 'empty-message' | 'local-changes-block' | 'conflicted' | 'no-remote' | 'not-implemented';
export type GitActionResult = {
    readonly ok: true;
    readonly snapshot: GitSnapshot;
    readonly output?: string;
    readonly conflicted?: boolean;
    readonly conflictFiles?: readonly string[];
} | {
    readonly ok: false;
    readonly error: {
        readonly code: GitErrorCode;
        readonly message?: string;
        readonly conflictFiles?: readonly string[];
    };
};
export interface GitActionRequest {
    readonly sessionId: string;
    readonly action: GitAction;
}
export type GitQuery = {
    readonly kind: 'history';
    readonly limit: number;
    readonly skip: number;
    readonly ref?: string;
    readonly search?: string;
    readonly author?: string;
    readonly since?: string;
} | {
    readonly kind: 'diff';
    readonly path: string;
    readonly base: 'worktree' | 'staged';
    readonly context?: number;
} | {
    readonly kind: 'diff';
    readonly path: string;
    readonly base: 'commit';
    readonly commit: string;
    readonly context?: number;
} | {
    readonly kind: 'file-lines';
    readonly path: string;
    readonly base: 'worktree' | 'staged';
    readonly start: number;
    readonly end: number;
} | {
    readonly kind: 'file-lines';
    readonly path: string;
    readonly base: 'commit';
    readonly commit: string;
    readonly start: number;
    readonly end: number;
} | {
    readonly kind: 'image-diff';
    readonly path: string;
    readonly base: 'worktree' | 'staged';
} | {
    readonly kind: 'image-diff';
    readonly path: string;
    readonly base: 'commit';
    readonly commit: string;
} | {
    readonly kind: 'dir-list';
    readonly path: string;
} | {
    readonly kind: 'file-content';
    readonly path: string;
} | {
    readonly kind: 'show';
    readonly ref: string;
} | {
    readonly kind: 'branches';
} | {
    readonly kind: 'tags';
} | {
    readonly kind: 'authors';
} | {
    readonly kind: 'last-commit-message';
} | {
    readonly kind: 'worktree-stats';
} | {
    readonly kind: 'stash-list';
} | {
    readonly kind: 'conflicts';
} | {
    readonly kind: 'operation-state';
};
export interface DirEntry {
    readonly name: string;
    readonly dir: boolean;
    readonly size?: number;
    readonly ignored?: boolean;
}
export interface GitFileStat {
    readonly path: string;
    readonly status: GitChangeStatus;
}
export interface GitBranch {
    readonly name: string;
    readonly shortHash: string | null;
    readonly ahead?: number;
    readonly behind?: number;
}
export interface WorktreeStats {
    readonly fileCount: number;
    readonly staged: number;
    readonly modified: number;
    readonly untracked: number;
    readonly insertions: number;
    readonly deletions: number;
    readonly lastChangeAt: number | null;
    readonly headCommittedAt: string | null;
}
export type GitQueryResult = {
    readonly kind: 'history';
    readonly commits: readonly GraphCommit[];
    readonly total: number;
} | {
    readonly kind: 'diff';
    readonly path: string;
    readonly text: string;
} | {
    readonly kind: 'file-lines';
    readonly path: string;
    readonly start: number;
    readonly lines: readonly string[];
    readonly eof: boolean;
} | {
    readonly kind: 'image-diff';
    readonly path: string;
    readonly mime: string | null;
    readonly old?: string;
    readonly new?: string;
    readonly tooLarge?: true;
} | {
    readonly kind: 'show';
    readonly ref: string;
    readonly commit: GitCommit | null;
    readonly body: string;
    readonly stats: readonly GitFileStat[];
} | {
    readonly kind: 'branches';
    readonly current: string | null;
    readonly defaultBranch: string | null;
    readonly local: readonly GitBranch[];
    readonly remote: readonly GitBranch[];
} | {
    readonly kind: 'tags';
    readonly tags: readonly GitBranch[];
} | {
    readonly kind: 'authors';
    readonly authors: readonly string[];
} | {
    readonly kind: 'last-commit-message';
    readonly message: string;
} | {
    readonly kind: 'worktree-stats';
    readonly stats: WorktreeStats;
} | {
    readonly kind: 'dir-list';
    readonly path: string;
    readonly entries: readonly DirEntry[];
    readonly truncated: boolean;
} | {
    readonly kind: 'file-content';
    readonly path: string;
    readonly variant: 'text' | 'image' | 'binary';
    readonly content?: string;
    readonly lines?: number;
    readonly dataUrl?: string;
    readonly tooLarge?: true;
} | {
    readonly kind: 'stash-list';
    readonly stashes: readonly StashEntry[];
} | {
    readonly kind: 'conflicts';
    readonly files: readonly string[];
} | {
    readonly kind: 'operation-state';
    readonly operation: GitOperationState | null;
};
export type GitQueryResponse = {
    readonly ok: true;
    readonly value: GitQueryResult;
} | {
    readonly ok: false;
    readonly error: {
        readonly code: GitErrorCode;
        readonly message?: string;
    };
};
export interface GitQueryRequest {
    readonly sessionId: string;
    readonly query: GitQuery;
}
export declare const IMAGE_MIME: Readonly<Record<string, string>>;
export declare function imageMimeFor(path: string): string | null;
export interface GitVersionRequest {
    readonly check?: boolean;
}
export interface GitVersionInfo {
    readonly current: string;
    readonly repositoryUrl?: string;
    readonly latest?: string;
    readonly updateAvailable: boolean;
    readonly releaseUrl?: string;
    readonly checkedRemote: boolean;
    readonly error?: string;
}
