/** Build a nested directory tree from flat repository-relative paths. */

export interface FileTreeNode {
  readonly name: string
  readonly path: string
  readonly dir: boolean
  readonly children: FileTreeNode[]
  /** Leaf payload passthrough (status, staged flag, etc.). */
  readonly meta?: unknown
}

interface Leaf {
  readonly path: string
  readonly meta?: unknown
  /** The leaf itself is a directory (e.g. a collapsed untracked dir from
   * `git status`, which reports `dir/` as one entry). */
  readonly dir?: boolean
}

/** Fold flat leaves into a directory tree, collapsing single-child chains. */
export function buildFileTree(leaves: readonly Leaf[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', dir: true, children: [] }
  for (const leaf of leaves) {
    const segments = leaf.path.split('/').filter((s) => s !== '')
    let node = root
    let acc = ''
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!
      acc = acc === '' ? seg : `${acc}/${seg}`
      const isLeaf = i === segments.length - 1
      // A directory leaf stays a directory node (with its payload); file
      // leaves and intermediate segments behave exactly as before.
      const dir = !isLeaf || leaf.dir === true
      let child = node.children.find((c) => c.name === seg && c.dir === dir)
      if (child === undefined) {
        child = { name: seg, path: acc, dir, children: [], ...(isLeaf ? { meta: leaf.meta } : {}) }
        node.children.push(child)
      }
      node = child
    }
  }
  sortTree(root)
  return collapse(root.children)
}

function sortTree(node: FileTreeNode): void {
  node.children.sort((a, b) => {
    if (a.dir !== b.dir) return a.dir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const child of node.children) sortTree(child)
}

/** Collapse a directory with exactly one directory child into "a/b". */
function collapse(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.map((node) => {
    if (!node.dir) return node
    let current = node
    while (current.children.length === 1 && current.children[0]!.dir) {
      const only = current.children[0]!
      // Carry the payload when folding into a childless directory leaf, so a
      // collapsed `docs/image` still knows it is the untracked-dir change.
      current = {
        name: `${current.name}/${only.name}`, path: only.path, dir: true, children: only.children,
        ...(only.children.length === 0 && only.meta !== undefined ? { meta: only.meta } : {}),
      }
    }
    return { ...current, children: collapse(current.children) }
  })
}
