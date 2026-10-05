/**
 * Client-side re-export of the host wire types.
 */
export type {
  GitSnapshot, GitSnapshotResult, GitSnapshotRequest, GitFailure, GitCommit, GraphCommit, GitRef,
  GitChange, GitChangeStatus, GitAction, GitActionRequest, GitActionResult, GitErrorCode,
  GitQuery, GitQueryRequest, GitQueryResponse, GitQueryResult, GitBranch, GitFileStat, WorktreeStats,
  GitVersionRequest, GitVersionInfo, DiffViewMode, DirEntry, StashEntry, GitOperationState, GitOperationKind,
} from '../host/types.ts'

export { imageMimeFor } from '../host/types.ts'
