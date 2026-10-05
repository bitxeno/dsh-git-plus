/**
 * Commit graph rail (div-based, V1). Uses git-graph.ts lane layout;
 * V2 may swap to canvas without changing the caller.
 */
import { createElement as h, useMemo } from 'react'
import type { JSX } from 'react'
import { layoutGraph } from './git-graph'
import type { GraphCommit } from './types'

const PALETTE = ['#63b0f4', '#73d13d', '#ff7a45', '#b37feb', '#f759ab', '#36cfc9', '#ffc53d', '#ff4d4f', '#597ef7', '#9254de']

interface GraphRailProps {
  readonly commits: readonly GraphCommit[]
  readonly selected: string | null
  readonly onSelect: (hash: string) => void
}

export function GraphRail({ commits, selected, onSelect }: GraphRailProps): JSX.Element {
  const rows = useMemo(() => layoutGraph(commits), [commits])
  return h('div', { className: 'gp-rail' }, rows.map((row) => {
    const color = PALETTE[row.color % PALETTE.length]!
    return h('button', {
      key: row.commit.hash, type: 'button',
      className: `gp-rail__row${selected === row.commit.hash ? ' gp-rail__row--sel' : ''}`,
      onClick: () => onSelect(row.commit.hash),
      title: `${row.commit.subject} (${row.commit.shortHash})`,
    }, [
      h('span', {
        key: 'g', className: 'gp-rail__graph',
        style: { width: `${Math.max(1, row.lane + 1) * 12}px` },
      }, [
        h('span', {
          key: 'n', className: 'gp-rail__node',
          style: { left: `${row.lane * 12 + 2}px`, background: color, borderColor: color },
        }),
      ]),
      h('span', { key: 's', className: 'gp-rail__subject' }, row.commit.subject),
      h('span', { key: 'h', className: 'gp-rail__hash' }, row.commit.shortHash),
    ])
  }))
}
