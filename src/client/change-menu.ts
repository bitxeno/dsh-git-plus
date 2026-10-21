/**
 * Change-list context menu construction: what a right-click offers for a file,
 * a folder, or a Cmd/Ctrl+A selection. Pure (no React, no DOM), so the section
 * layout — which actions hide for conflicted/staged targets, which side a
 * mixed selection acts on — is unit-testable.
 */
import type { GitChange } from './types'
import type { GitKey } from './locales'
import type { MenuItem } from './ContextMenu'
import { ignorePatternForDir, ignorePatternsForFile } from './ignore-pattern'

export type ChangeMenuTarget =
  | { readonly kind: 'file'; readonly change: GitChange }
  | { readonly kind: 'dir'; readonly dir: string; readonly stagedSide: boolean; readonly leaves: readonly GitChange[] }
  /**
   * Multi-row selection (Cmd/Ctrl+A, or Cmd/Ctrl+click on any mix of files and
   * folders). `revealPath` is set when the right-click landed on a folder in
   * the selection, so "show in Finder" still has a single path to open.
   */
  | {
    readonly kind: 'multi'
    readonly stagedSide: boolean
    readonly leaves: readonly GitChange[]
    readonly revealPath?: string
  }

export interface ChangeMenuCbs {
  readonly view: (path: string) => void
  /** Reveal-in-file-manager entry; null hides it (unsupported platform). */
  readonly reveal: { readonly label: string; readonly run: (path: string) => void } | null
  readonly stage: (paths: readonly string[], stagedSide: boolean) => void
  readonly stash: (paths: readonly string[], includeUntracked: boolean) => void
  readonly patch: (paths: readonly string[]) => void
  readonly ignore: (patterns: readonly string[]) => void
  readonly discard: (paths: readonly string[], count: number) => void
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
}

/**
 * Context menu items for a file or folder target, grouped by function with
 * separators: stage | stash + patch | ignore patterns | discard (danger).
 * Stash/patch hide for conflicted targets (git cannot stash unmerged paths);
 * ignore only offers for untracked content.
 *
 * A `multi` target is a whole-pane Cmd/Ctrl+A selection; its entries come from
 * buildSelectionMenuItems, which has no navigation rows (one preview per file
 * would open N windows).
 */
export function buildChangeMenuItems(target: ChangeMenuTarget, cb: ChangeMenuCbs): MenuItem[] {
  if (target.kind === 'multi') {
    return buildSelectionMenuItems([...target.leaves], target.stagedSide, cb, target.revealPath)
  }
  const changes = target.kind === 'file' ? [target.change] : [...target.leaves]
  const paths = changes.map((c) => c.path)
  const n = changes.length
  const stagedSide = target.kind === 'file' ? target.change.staged : target.stagedSide
  const hasConflicted = changes.some((c) => c.status === 'conflicted')
  const hasUntracked = changes.some((c) => c.status === 'untracked')
  const sep = (key: string): MenuItem => ({ key, separator: true })

  const sections: MenuItem[][] = []
  // View leads: a read-only preview modal (file targets only), then the
  // native file-manager reveal (macOS/Windows only).
  const nav: MenuItem[] = []
  if (target.kind === 'file') {
    nav.push({
      key: 'view',
      label: cb.t('menu.view'),
      onSelect: () => cb.view(target.change.path),
    })
  }
  if (cb.reveal !== null) {
    const reveal = cb.reveal
    // Directories reveal as one entry (opening every leaf would pop N windows).
    const revealPath = target.kind === 'file' ? target.change.path : target.dir
    nav.push({
      key: 'reveal',
      label: reveal.label,
      onSelect: () => reveal.run(revealPath),
    })
  }
  if (nav.length > 0) sections.push(nav)
  sections.push([{
    key: 'stage',
    label: stagedSide
      ? (n === 1 ? cb.t('changes.unstage') : cb.t('menu.unstageFiles', { n }))
      : (n === 1 ? cb.t('changes.stage') : cb.t('menu.stageFiles', { n })),
    onSelect: () => cb.stage(paths, stagedSide),
  }])
  if (!hasConflicted) {
    sections.push([
      { key: 'stash', label: cb.t('menu.stashFiles', { n }), onSelect: () => cb.stash(paths, hasUntracked) },
      { key: 'patch', label: cb.t('menu.savePatch'), onSelect: () => cb.patch(paths) },
    ])
  }
  const ignoreItems: MenuItem[] = []
  if (target.kind === 'file' && target.change.status === 'untracked') {
    if (target.change.isDirectory) {
      const pattern = ignorePatternForDir(target.change.path)
      ignoreItems.push({ key: 'ign', label: cb.t('menu.ignorePath', { pattern }), onSelect: () => cb.ignore([pattern]) })
    } else {
      const { exact, ext } = ignorePatternsForFile(target.change.path)
      ignoreItems.push({ key: 'ign', label: cb.t('menu.ignorePath', { pattern: exact }), onSelect: () => cb.ignore([exact]) })
      if (ext !== undefined) {
        ignoreItems.push({ key: 'ign-ext', label: cb.t('menu.ignoreExt', { ext: ext.slice(2) }), onSelect: () => cb.ignore([ext]) })
      }
    }
  } else if (target.kind === 'dir' && hasUntracked) {
    const pattern = ignorePatternForDir(target.dir)
    ignoreItems.push({ key: 'ign', label: cb.t('menu.ignorePath', { pattern }), onSelect: () => cb.ignore([pattern]) })
  }
  if (ignoreItems.length > 0) sections.push(ignoreItems)
  // Staged targets cannot be discarded directly (`git restore` clears the
  // worktree, not the index): the action only appears for unstaged content.
  if (!stagedSide) {
    sections.push([{
      key: 'discard',
      label: n === 1 ? cb.t('changes.discard') : cb.t('menu.discardFiles', { n }),
      danger: true,
      onSelect: () => cb.discard(paths, n),
    }])
  }
  const items: MenuItem[] = []
  sections.forEach((section, i) => {
    if (i > 0) items.push(sep(`s${i}`))
    items.push(...section)
  })
  return items
}

/**
 * Menu for a whole-pane selection (Cmd/Ctrl+A). The selection is one side's
 * rows, so the entries are the same as a folder target's — stage/unstage,
 * stash + patch, ignore patterns, discard — just labelled with the total the
 * selection covers instead of a subtree's.
 */
export function buildSelectionMenuItems(
  changes: readonly GitChange[],
  stagedSide: boolean,
  cb: ChangeMenuCbs,
  revealPath?: string,
): MenuItem[] {
  const paths = changes.map((c) => c.path)
  const n = changes.length
  const hasConflicted = changes.some((c) => c.status === 'conflicted')
  const hasUntracked = changes.some((c) => c.status === 'untracked')
  const sep = (key: string): MenuItem => ({ key, separator: true })
  const sections: MenuItem[][] = []

  // Navigation has a single target when the right-click landed on a folder;
  // revealing N files would pop N windows, so it appears only then.
  if (cb.reveal !== null && revealPath !== undefined) {
    const reveal = cb.reveal
    sections.push([{ key: 'reveal', label: reveal.label, onSelect: () => reveal.run(revealPath) }])
  }

  sections.push([{
    key: 'stage',
    label: stagedSide
      ? (n === 1 ? cb.t('changes.unstage') : cb.t('menu.unstageFiles', { n }))
      : (n === 1 ? cb.t('changes.stage') : cb.t('menu.stageFiles', { n })),
    onSelect: () => cb.stage(paths, stagedSide),
  }])
  if (!hasConflicted) {
    sections.push([
      { key: 'stash', label: cb.t('menu.stashFiles', { n }), onSelect: () => cb.stash(paths, hasUntracked) },
      { key: 'patch', label: cb.t('menu.savePatch'), onSelect: () => cb.patch(paths) },
    ])
  }
  const patterns = [...new Set(changes
    .filter((c) => c.status === 'untracked')
    .map((c) => (c.isDirectory ? ignorePatternForDir(c.path) : ignorePatternsForFile(c.path).exact)))]
  if (patterns.length > 0) {
    sections.push([{ key: 'ign', label: cb.t('menu.ignoreFiles', { n: patterns.length }), onSelect: () => cb.ignore(patterns) }])
  }
  // Staged rows cannot be discarded directly (`git restore` clears the
  // worktree, not the index), so discard only shows for the unstaged pane.
  if (!stagedSide) {
    sections.push([{
      key: 'discard',
      label: n === 1 ? cb.t('changes.discard') : cb.t('menu.discardFiles', { n }),
      danger: true,
      onSelect: () => cb.discard(paths, n),
    }])
  }
  const items: MenuItem[] = []
  sections.forEach((section, i) => {
    if (i > 0) items.push(sep(`s${i}`))
    items.push(...section)
  })
  return items
}

/** Side a change row lives on, as the `s`/`w` prefix selection keys use. */
export function sideKeyOf(staged: boolean): string {
  return staged ? 's' : 'w'
}

/** Selection key for a change row: one path can be staged and unstaged. */
export function rowKeyOf(change: GitChange): string {
  return `${change.path}:${sideKeyOf(change.staged)}`
}

/** Selection key for a folder row on one side. */
export function dirKeyOf(path: string, staged: boolean): string {
  return `d:${sideKeyOf(staged)}:${path}`
}

/**
 * Whether a row falls under the selection: directly (its own row key) or
 * through a selected ancestor folder. Selecting a folder stands for everything
 * below it, so its files highlight and right-click keep the whole selection.
 */
export function isRowInSelection(selected: ReadonlySet<string>, key: string, path: string, staged: boolean): boolean {
  if (selected.has(key)) return true
  const segs = path.split('/')
  for (let i = segs.length - 1; i > 0; i--) {
    if (selected.has(dirKeyOf(segs.slice(0, i).join('/'), staged))) return true
  }
  return false
}

/**
 * Whether a stored folder-selection key still has changes under it, so the
 * selection can be pruned when the folder disappears from the snapshot.
 */
export function isSelectedDirAlive(
  key: string,
  changes: readonly GitChange[],
): boolean {
  if (!key.startsWith('d:')) return false
  const rest = key.slice(2)
  const sep = rest.indexOf(':')
  if (sep < 0) return false
  const staged = rest.slice(0, sep) === 's'
  const dir = rest.slice(sep + 1)
  return changes.some((c) => c.staged === staged && (c.path === dir || c.path.startsWith(dir + '/')))
}

/**
 * Which target a right-click should act on. A row inside the selection acts on
 * the whole selection — all selected folders expanded to their files — as soon
 * as that covers more than the row itself. A lone folder's own target already
 * means "everything under it" and carries the folder-specific entries, so it
 * stays as-is. The right-clicked folder still lends its path to "show in
 * Finder", which needs one target rather than one window per selected file.
 */
export function resolveMenuTarget(opts: {
  readonly selected: ReadonlySet<string>
  readonly rowKey: string
  readonly inSelection: boolean
  readonly stagedSide: boolean
  /** Change entries the whole selection covers on this side. */
  readonly leaves: readonly GitChange[]
  readonly single: ChangeMenuTarget
}): ChangeMenuTarget {
  const { selected, rowKey, inSelection, stagedSide, leaves, single } = opts
  if (!inSelection) return single
  // A lone folder's own target already means "everything under it" and
  // carries the folder-specific entries; anything broader (a second folder,
  // any file) needs the shared multi-row menu.
  if (single.kind === 'dir' && selected.size === 1 && selected.has(rowKey)) return single
  if (leaves.length <= 1 && single.kind === 'file') return single
  return {
    kind: 'multi',
    stagedSide,
    leaves,
    ...(single.kind === 'dir' ? { revealPath: single.dir } : {}),
  }
}
