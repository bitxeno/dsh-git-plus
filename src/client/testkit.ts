/**
 * Test kit barrel: re-exports the pure client algorithms so `node --test`
 * can import them from a built ESM bundle (lib/testkit.mjs) without a
 * TypeScript loader. Not part of the plugin runtime.
 */
export { parseStatus, parseGraphLog, parseBranches, parseNameStatus, parseStashList, parseTags, markRemotePresence, parseBranchHeader, sumNumstat, parseRefs } from '../host/parser.ts'
export { extractRepoAvatars, isGhPathName } from '../host/github.ts'
export { isSafePath, isSafeRev, isSafeBranchName } from '../host/validate.ts'
export { planAction, pickDefaultRemote, resolvePushRemote, isNetworkCommand } from '../host/actions.ts'
export { buildSideBySide, summarize, isBinaryDiff, isAddOnlyDiff, isDeleteOnlyDiff, isLargeDiff, diffLineCount, LARGE_DIFF_LINES, LARGE_DIFF_BYTES, extractAddedContent, extractDeletedContent, isImagePath, isSvgPath, intraLineDiff, spliceGap, contextRowsFromLines, flattenToUnified, GAP_STEP } from './diff.ts'
export { buildFileTree } from './file-tree.ts'
export { layoutGraph, graphWidth } from './git-graph.ts'
export { authorAvatarUrl, githubUsernameFromNoreply, gravatarUrlFor, isGitHubRemote, md5Hex, parseGitHubRepo } from './avatar.ts'
export { buildFullGraph, buildPathD, computeCurrentBranchSet, computeRefAncestorSet, resolveGraphColor } from './graph-plus.ts'
export { gitPanelRemoteOf, queryAs, hasSession } from './rpc.ts'
export { quickFingerprint } from './controller.ts'
export { splitHighlightSpans } from './code-spans.ts'
export { activateGitTab, isGitTabActive, returnToConversation } from './jump.ts'
