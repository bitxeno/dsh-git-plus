/** Changes-page statistics bar: file count / line changes / last-change time. */
import { createElement as h } from 'react'
import type { JSX } from 'react'
import type { WorktreeStats } from './types'
import type { GitKey } from './locales'

interface StatsProps {
  /** Stats ride the snapshot (single git source); no separate query. */
  readonly stats: WorktreeStats
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
}

export function ChangeStats({ stats, t }: StatsProps): JSX.Element {
  const items: JSX.Element[] = [
    h('span', { key: 'files', className: 'gp-stats__item' }, t('stats.files', { n: stats.fileCount })),
    h('span', { key: 'lines', className: 'gp-stats__item' }, [
      h('span', { key: 'a', className: 'gp-stats__add' }, `+${stats.insertions}`),
      ' ',
      h('span', { key: 'd', className: 'gp-stats__del' }, `−${stats.deletions}`),
    ]),
  ]

  return h('div', { className: 'gp-stats' }, items)
}
