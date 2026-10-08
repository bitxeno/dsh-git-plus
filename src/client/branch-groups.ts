/**
 * Sidebar branch grouping: fold `/`-separated names into collapsible folder
 * nodes, optionally hoisting one ref (a default branch) to the front of the
 * folder it lives in — never out of that folder.
 */
import type { GitBranch } from './types'

export interface BranchFolderNode {
  readonly kind: 'folder'
  /** Full folder path, e.g. `feature` or `feature/sub`. Stable key for collapse state. */
  readonly path: string
  /** Last segment display name, e.g. `sub` for `feature/sub`. */
  readonly name: string
  readonly depth: number
  readonly children: readonly BranchTreeNode[]
  /** Total leaf branches under this folder (recursive), for the count badge. */
  readonly count: number
}

export interface BranchLeafNode {
  readonly kind: 'branch'
  readonly branch: GitBranch
  /** Short display name inside a folder (last `/` segment); full name at root. */
  readonly displayName: string
  readonly depth: number
  /** The hoisted `pinnedRef` leaf, so the row can carry the "default" badge. */
  readonly isDefault?: boolean
}

export type BranchTreeNode = BranchFolderNode | BranchLeafNode

/** Move the default branch to the front, preserving the rest of the order. */
export function orderBranchesWithDefaultFirst(
  local: readonly GitBranch[],
  defaultBranch: string | null,
): readonly GitBranch[] {
  if (defaultBranch === null || defaultBranch === '') return local
  const idx = local.findIndex((b) => b.name === defaultBranch)
  if (idx <= 0) return local
  return [local[idx]!, ...local.slice(0, idx), ...local.slice(idx + 1)]
}

/**
 * Split the pinned default branch from the rest, then fold `/` names in `rest`
 * into a sorted folder tree. The default branch is returned separately so the
 * caller can render it as a fixed first row (outside any folder, even when its
 * own name contains `/`).
 */
export function splitDefaultBranch(
  local: readonly GitBranch[],
  defaultBranch: string | null,
): { readonly pinned: GitBranch | null; readonly rest: readonly GitBranch[] } {
  if (defaultBranch === null || defaultBranch === '') return { pinned: null, rest: local }
  const found = local.find((b) => b.name === defaultBranch) ?? null
  if (found === null) return { pinned: null, rest: local }
  return { pinned: found, rest: local.filter((b) => b.name !== defaultBranch) }
}

interface MutableFolder {
  path: string
  name: string
  depth: number
  folders: Map<string, MutableFolder>
  branches: GitBranch[]
}

/**
 * Fold `branches` with `/` into nested folders; plain names stay as root leaves.
 *
 * `options.pinnedRef` hoists one branch to the front of the sibling list it
 * already belongs to — it is never pulled out of its folder. So `origin/main`
 * with `pinnedRef: 'origin/main'` stays inside the `origin` folder and leads
 * it (the row carries the "default" badge), which is how a remote's default
 * branch should read: the folder still owns the ref.
 */
export function buildBranchFolderTree(
  branches: readonly GitBranch[],
  options: { readonly pinnedRef?: string | null } = {},
): readonly BranchTreeNode[] {
  const pinnedRef = options.pinnedRef ?? null
  const rootFolders = new Map<string, MutableFolder>()
  const rootBranches: GitBranch[] = []

  for (const branch of branches) {
    const slash = branch.name.indexOf('/')
    if (slash <= 0 || slash === branch.name.length - 1) {
      rootBranches.push(branch)
      continue
    }
    const segments = branch.name.split('/').filter((s) => s !== '')
    // Guard against degenerate names like `a//b` (empty segments dropped above):
    // a single remaining segment has no folder to live in.
    if (segments.length < 2) {
      rootBranches.push(branch)
      continue
    }
    let level = rootFolders
    let acc = ''
    let node: MutableFolder | undefined
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]!
      acc = acc === '' ? seg : `${acc}/${seg}`
      let next = level.get(seg)
      if (next === undefined) {
        next = { path: acc, name: seg, depth: i, folders: new Map(), branches: [] }
        level.set(seg, next)
      }
      node = next
      level = next.folders
    }
    node!.branches.push(branch)
  }

  const sortBranches = (list: GitBranch[]): GitBranch[] =>
    pinFirst([...list].sort((a, b) => a.name.localeCompare(b.name)), pinnedRef)

  // Root level: folders from the map + loose root branches.
  const folderNodes: BranchFolderNode[] = [...rootFolders.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => collapseFolder(f, 0, pinnedRef))
  const leafNodes: BranchLeafNode[] = sortBranches(rootBranches).map((b) => ({
    kind: 'branch',
    branch: b,
    displayName: b.name,
    depth: 0,
    ...(b.name === pinnedRef ? { isDefault: true } : {}),
  }))
  // Folders first, then loose branches — both alphabetical.
  return [...folderNodes, ...leafNodes]
}

/**
 * Move `pinnedRef` to the front of an already-sorted sibling list, keeping the
 * rest in order. A ref that is absent or already first leaves the list as is.
 */
function pinFirst(list: GitBranch[], pinnedRef: string | null): GitBranch[] {
  if (pinnedRef === null) return list
  const idx = list.findIndex((b) => b.name === pinnedRef)
  if (idx <= 0) return list
  return [list[idx]!, ...list.slice(0, idx), ...list.slice(idx + 1)]
}

function countLeaves(f: MutableFolder): number {
  let n = f.branches.length
  for (const sub of f.folders.values()) n += countLeaves(sub)
  return n
}

/**
 * Collapse single-child folder chains (`a` → `b` becomes `a/b`) so deep
 * single-branch paths don't render as a staircase of one-item folders.
 */
function collapseFolder(f: MutableFolder, depth: number, pinnedRef: string | null): BranchFolderNode {
  let name = f.name
  let path = f.path
  let current = f
  while (current.folders.size === 1 && current.branches.length === 0) {
    const only = [...current.folders.values()][0]!
    name = `${name}/${only.name}`
    path = only.path
    current = only
  }
  const sortBranches = (list: GitBranch[]): GitBranch[] =>
    pinFirst([...list].sort((a, b) => a.name.localeCompare(b.name)), pinnedRef)
  const subFolders: BranchFolderNode[] = [...current.folders.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((sub) => collapseFolder(sub, depth + 1, pinnedRef))
  const leaves: BranchLeafNode[] = sortBranches(current.branches).map((b) => ({
    kind: 'branch',
    branch: b,
    displayName: b.name.slice(path.length + 1),
    depth: depth + 1,
    ...(b.name === pinnedRef ? { isDefault: true } : {}),
  }))
  return {
    kind: 'folder',
    path,
    name,
    depth,
    children: [...subFolders, ...leaves],
    count: countLeaves(f),
  }
}

/** Count leaf branch rows under (possibly nested) tree nodes. */
export function countTreeBranches(nodes: readonly BranchTreeNode[]): number {
  let n = 0
  for (const node of nodes) {
    if (node.kind === 'branch') n += 1
    else n += node.count
  }
  return n
}
