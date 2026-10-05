/**
 * Commit-graph layout ported from git-graph-plus `src/git/git-graph-builder.ts`
 * (itself ported from SourceGit, MIT licensed — see original headers).
 *
 * Produces SourceGit-style continuous rails: `paths` (branch lines as point
 * lists), `links` (merge curves), `dots` (one node per commit, in order) and
 * `commitLeftMargin` (message start X per row). The view renders one absolute
 * SVG overlay (halo + core strokes) instead of per-row fragments.
 */

export type PlusRefType = 'head' | 'branch' | 'remote-branch' | 'tag' | 'stash'

export interface PlusRef {
  readonly type: PlusRefType
  readonly name: string
  readonly remote?: string
}

export interface PlusCommit {
  readonly hash: string
  readonly parents: readonly string[]
  readonly refs: readonly PlusRef[]
}

export interface PlusBranch {
  readonly name: string
  readonly remote?: string
  readonly upstream?: string
  readonly hash: string
}

export interface GraphPath {
  readonly points: Array<{ x: number; y: number }>
  readonly color: number
  readonly colorOverride?: string
}

export interface GraphLink {
  readonly start: { x: number; y: number }
  readonly control: { x: number; y: number }
  readonly end: { x: number; y: number }
  readonly color: number
  readonly colorOverride?: string
}

export interface GraphDot {
  readonly center: { x: number; y: number }
  readonly color: number
  colorOverride?: string
  readonly type: 'default' | 'head' | 'merge'
  readonly localOnly: boolean
  readonly remoteTip: boolean
}

export interface FullGraphData {
  readonly paths: GraphPath[]
  readonly links: GraphLink[]
  readonly dots: GraphDot[]
  /** Per-commit left margin (message start X, unit coords). */
  readonly commitLeftMargin: number[]
}

export const GRAPH_PALETTE = [
  '#63b0f4', '#73d13d', '#ff7a45', '#b37feb',
  '#f759ab', '#36cfc9', '#ffc53d', '#ff4d4f',
  '#597ef7', '#9254de', '#43e8d8', '#faad14',
]

export function resolveGraphColor(palette: readonly string[], index: number, override?: string): string {
  if (override) return override
  return palette[index % palette.length]!
}

/** Row height (px) and X scale shared by the layout and the renderer. */
export const GRAPH_ROW_H = 30
export const GRAPH_X_SCALE = 1.05

export function laneX(col: number): number {
  return col * GRAPH_X_SCALE
}

// ── PathHelper (SourceGit port) ────────────────────────────────────────────

class PathHelper {
  path: { points: Array<{ x: number; y: number }>; color: number; colorOverride?: string }
  next: string
  lastX: number
  private lastY: number
  private endY = 0

  constructor(next: string, color: number, start: { x: number; y: number }, to?: { x: number; y: number }) {
    this.next = next
    this.path = { points: [], color }
    if (to) {
      this.lastX = to.x
      this.lastY = to.y
      this.path.points.push(start)
      this.path.points.push(to)
    } else {
      this.lastX = start.x
      this.lastY = start.y
      this.path.points.push(start)
    }
  }

  pass(x: number, y: number, halfH: number): void {
    if (x > this.lastX) {
      this.add(this.lastX, this.lastY)
      this.add(x, y - halfH)
    } else if (x < this.lastX) {
      this.add(this.lastX, y - halfH)
      y += halfH
      this.add(x, y)
    }
    this.lastX = x
    this.lastY = y
  }

  goto(x: number, y: number, halfH: number): void {
    if (x > this.lastX) {
      this.add(this.lastX, this.lastY)
      this.add(x, y - halfH)
    } else if (x < this.lastX) {
      let minY = y - halfH
      if (minY > this.lastY) minY -= halfH
      this.add(this.lastX, minY)
      this.add(x, y)
    }
    this.lastX = x
    this.lastY = y
  }

  end(x: number, y: number, halfH: number): void {
    if (x > this.lastX) {
      this.add(this.lastX, this.lastY)
      this.add(x, y - halfH)
    } else if (x < this.lastX) {
      this.add(this.lastX, y - halfH)
    }
    this.add(x, y)
    this.lastX = x
    this.lastY = y
  }

  private add(x: number, y: number): void {
    if (this.endY < y) {
      this.path.points.push({ x, y })
      this.endY = y
    }
  }
}

// ── Remote-only / pushed detection ─────────────────────────────────────────

function buildUpstreamMap(branches: readonly PlusBranch[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const b of branches) {
    if (!b.remote && b.upstream) map.set(b.upstream, b.hash)
  }
  return map
}

function buildRemoteOnlyData(
  commits: readonly PlusCommit[],
  branches: readonly PlusBranch[],
  hashIndex: Map<string, number>,
): { tipSet: Set<string>; allSet: Set<string> } {
  const upstreamMap = buildUpstreamMap(branches)
  const localBranchMap = new Map<string, string>()
  for (const c of commits) {
    for (const r of c.refs) {
      if (r.type === 'branch' || r.type === 'head') localBranchMap.set(r.name, c.hash)
    }
  }
  const tipSet = new Set<string>()
  const tips: Array<{ tipIdx: number; localHash: string }> = []
  for (const c of commits) {
    const hasRemoteRef = c.refs.some((r) => r.type === 'remote-branch')
    const hasLocalRef = c.refs.some((r) => r.type === 'branch' || r.type === 'head' || r.type === 'tag')
    if (!hasRemoteRef || hasLocalRef) continue
    for (const r of c.refs) {
      if (r.type !== 'remote-branch') continue
      const fullRemoteName = r.remote ? `${r.remote}/${r.name}` : r.name
      const localHash = upstreamMap.get(fullRemoteName) ?? localBranchMap.get(r.name)
      if (localHash && localHash !== c.hash) {
        tipSet.add(c.hash)
        const idx = hashIndex.get(c.hash)
        if (idx !== undefined) tips.push({ tipIdx: idx, localHash })
        break
      }
    }
  }
  const allSet = new Set<string>()
  const ancestorCache = new Map<string, Set<string>>()
  for (const { tipIdx, localHash } of tips) {
    let localAncestors = ancestorCache.get(localHash)
    if (!localAncestors) {
      localAncestors = new Set([localHash])
      const q: number[] = []
      const li = hashIndex.get(localHash)
      if (li !== undefined) q.push(li)
      let qHead = 0
      while (qHead < q.length) {
        const idx = q[qHead++]!
        for (const ph of commits[idx]!.parents) {
          if (!localAncestors.has(ph)) {
            localAncestors.add(ph)
            const pi = hashIndex.get(ph)
            if (pi !== undefined) q.push(pi)
          }
        }
      }
      ancestorCache.set(localHash, localAncestors)
    }
    allSet.add(commits[tipIdx]!.hash)
    const queue = [tipIdx]
    let qHead = 0
    while (qHead < queue.length) {
      const idx = queue[qHead++]!
      for (const parentHash of commits[idx]!.parents) {
        if (allSet.has(parentHash) || localAncestors.has(parentHash)) continue
        allSet.add(parentHash)
        const pi = hashIndex.get(parentHash)
        if (pi !== undefined) queue.push(pi)
      }
    }
  }
  return { tipSet, allSet }
}

function buildPushedSet(commits: readonly PlusCommit[], hashIndex: Map<string, number>): Set<string> {
  const pushed = new Set<string>()
  const queue: number[] = []
  for (let i = 0; i < commits.length; i++) {
    if (commits[i]!.refs.some((r) => r.type === 'remote-branch')) {
      if (!pushed.has(commits[i]!.hash)) {
        pushed.add(commits[i]!.hash)
        queue.push(i)
      }
    }
  }
  let qHead = 0
  while (qHead < queue.length) {
    const idx = queue[qHead++]!
    for (const parentHash of commits[idx]!.parents) {
      if (!pushed.has(parentHash)) {
        pushed.add(parentHash)
        const pi = hashIndex.get(parentHash)
        if (pi !== undefined) queue.push(pi)
      }
    }
  }
  return pushed
}

function pickColor(unsolved: PathHelper[], overflow: { n: number }): number {
  let mask = 0
  for (let j = 0; j < unsolved.length; j++) {
    const c = unsolved[j]!.path.color
    if (c >= 0 && c < 32) mask |= 1 << c
  }
  for (let i = 0; i < GRAPH_PALETTE.length; i++) {
    if ((mask & (1 << i)) === 0) return i
  }
  return overflow.n++ % GRAPH_PALETTE.length
}

// ── Main layout (SourceGit CommitGraph.Parse port) ─────────────────────────

export function buildFullGraph(
  commits: readonly PlusCommit[],
  branches: readonly PlusBranch[] = [],
  resolveBranchColor?: (refName: string) => string | undefined,
): FullGraphData {
  const UNIT_W = 12
  const HALF_W = 6
  const UNIT_H = 1
  const HALF_H = 0.5

  const paths: GraphPath[] = []
  const links: GraphLink[] = []
  const dots: GraphDot[] = []
  const commitLeftMargin: number[] = []

  const unsolved: PathHelper[] = []
  const ended: PathHelper[] = []
  const colorOverflow = { n: 0 }
  const dotPaths: (PathHelper | null)[] = []
  const nextMap = new Map<string, PathHelper>()
  const trackNext = (l: PathHelper): void => { if (!nextMap.has(l.next)) nextMap.set(l.next, l) }
  const untrackNext = (l: PathHelper): void => { if (nextMap.get(l.next) === l) nextMap.delete(l.next) }
  let offsetY = -HALF_H
  const hashIndex = new Map<string, number>()
  for (let i = 0; i < commits.length; i++) hashIndex.set(commits[i]!.hash, i)
  const { tipSet: remoteTipSet, allSet: remoteOnlySet } = buildRemoteOnlyData(commits, branches, hashIndex)
  const pushedSet = buildPushedSet(commits, hashIndex)

  const tipColorMap = new Map<string, string>()
  if (resolveBranchColor) {
    for (const commit of commits) {
      for (const ref of commit.refs) {
        if (ref.type !== 'branch' && ref.type !== 'remote-branch') continue
        const c = resolveBranchColor(ref.name)
        if (c) { tipColorMap.set(commit.hash, c); break }
      }
    }
  }

  for (const commit of commits) {
    let major: PathHelper | null = null
    offsetY += UNIT_H

    let offsetX = 4 - HALF_W
    const maxOffsetOld = unsolved.length > 0 ? unsolved[unsolved.length - 1]!.lastX : offsetX + UNIT_W

    for (const l of unsolved) {
      if (l.next === commit.hash) {
        if (major === null) {
          offsetX += UNIT_W
          major = l
          if (commit.parents.length > 0) {
            untrackNext(major)
            major.next = commit.parents[0]!
            trackNext(major)
            major.goto(offsetX, offsetY, HALF_H)
          } else {
            major.end(offsetX, offsetY, HALF_H)
            ended.push(l)
          }
        } else {
          l.end(major.lastX, offsetY, HALF_H)
          ended.push(l)
        }
      } else {
        offsetX += UNIT_W
        l.pass(offsetX, offsetY, HALF_H)
      }
    }

    if (ended.length > 0) {
      const toRemove = new Set(ended)
      let w = 0
      for (let r = 0; r < unsolved.length; r++) {
        if (!toRemove.has(unsolved[r]!)) unsolved[w++] = unsolved[r]!
      }
      unsolved.length = w
      for (const e of ended) untrackNext(e)
      ended.length = 0
    }

    if (major === null) {
      offsetX += UNIT_W
      if (commit.parents.length > 0) {
        major = new PathHelper(commit.parents[0]!, pickColor(unsolved, colorOverflow), { x: offsetX, y: offsetY })
        unsolved.push(major)
        trackNext(major)
        paths.push(major.path)
      }
    }

    if (major && tipColorMap.size > 0 && major.path.colorOverride === undefined) {
      const override = tipColorMap.get(commit.hash)
      if (override) major.path.colorOverride = override
    }

    const position = { x: major?.lastX ?? offsetX, y: offsetY }
    const dotColor = major?.path.color ?? 0
    const dotColorOverride = major?.path.colorOverride ?? tipColorMap.get(commit.hash)
    const isRemoteOnly = remoteOnlySet.has(commit.hash)
    const isLocalOnly = !pushedSet.has(commit.hash)
    let dotType: GraphDot['type'] = 'default'
    if (commit.refs.some((r) => r.type === 'head')) dotType = 'head'
    else if (commit.parents.length > 1) dotType = 'merge'
    dots.push({ center: position, color: dotColor, ...(dotColorOverride !== undefined ? { colorOverride: dotColorOverride } : {}), type: dotType, localOnly: isLocalOnly, remoteTip: isRemoteOnly })
    dotPaths.push(major)

    if (!remoteTipSet.has(commit.hash) || commit.parents.length > 1) {
      for (let j = 1; j < commit.parents.length; j++) {
        const parentHash = commit.parents[j]!
        const parent = nextMap.get(parentHash)
        if (parent) {
          links.push({
            start: position,
            end: { x: parent.lastX, y: offsetY + HALF_H },
            control: { x: parent.lastX, y: position.y },
            color: parent.path.color,
            ...(parent.path.colorOverride !== undefined ? { colorOverride: parent.path.colorOverride } : {}),
          })
        } else {
          offsetX += UNIT_W
          const l = new PathHelper(parentHash, pickColor(unsolved, colorOverflow), position, { x: offsetX, y: position.y + HALF_H })
          unsolved.push(l)
          trackNext(l)
          paths.push(l.path)
        }
      }
    }

    commitLeftMargin.push(Math.max(offsetX, maxOffsetOld) + HALF_W + 2)
  }

  for (let i = 0; i < dots.length; i++) {
    const override = dotPaths[i]?.path.colorOverride ?? tipColorMap.get(commits[i]!.hash)
    if (override) dots[i]!.colorOverride = override
  }

  for (const path of unsolved) {
    const endY = (commits.length - 0.5) * UNIT_H
    if (path.path.points.length === 1 && Math.abs(path.path.points[0]!.y - endY) < 0.0001) continue
    path.end(path.lastX, endY + HALF_H, HALF_H)
  }

  return { paths, links, dots, commitLeftMargin }
}

// ── SVG path rendering (SourceGit DrawCurves port) ─────────────────────────

export function buildPathD(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return ''
  const parts: string[] = []
  let last = { x: laneX(points[0]!.x), y: points[0]!.y * GRAPH_ROW_H }
  parts.push(`M ${last.x} ${last.y}`)
  for (let i = 1; i < points.length; i++) {
    const cur = { x: laneX(points[i]!.x), y: points[i]!.y * GRAPH_ROW_H }
    if (cur.x > last.x) {
      parts.push(`Q ${cur.x} ${last.y}, ${cur.x} ${cur.y}`)
    } else if (cur.x < last.x) {
      if (i < points.length - 1) {
        const midY = (last.y + cur.y) / 2
        parts.push(`C ${last.x} ${midY + 4}, ${cur.x} ${midY - 4}, ${cur.x} ${cur.y}`)
      } else {
        parts.push(`Q ${last.x} ${cur.y}, ${cur.x} ${cur.y}`)
      }
    } else {
      parts.push(`L ${cur.x} ${cur.y}`)
    }
    last = cur
  }
  return parts.join(' ')
}

/** Commits reachable from HEAD (for dimming off-branch rows). */
export function computeCurrentBranchSet(commits: readonly PlusCommit[]): Set<string> {
  const out = new Set<string>()
  const hashIndex = new Map<string, number>()
  for (let i = 0; i < commits.length; i++) hashIndex.set(commits[i]!.hash, i)
  const head = commits.find((c) => c.refs.some((r) => r.type === 'head'))
  if (!head) return out
  const queue = [head.hash]
  while (queue.length > 0) {
    const hash = queue.pop()!
    if (out.has(hash)) continue
    out.add(hash)
    const idx = hashIndex.get(hash)
    if (idx === undefined) continue
    for (const p of commits[idx]!.parents) {
      if (!out.has(p)) queue.push(p)
    }
  }
  return out
}
