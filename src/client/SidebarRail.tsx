/**
 * Narrow-mode icon rail: the sidebar's collapsed form on phones. A permanent
 * 46px strip — not a hidden drawer — so the panel keeps a sense of place and the
 * two views stay one tap away. Group icons open the drawer at their group;
 * view icons switch views directly without opening anything (the highest-
 * frequency action on a phone must not cost a second tap).
 */
import { createElement as h } from 'react'
import type { JSX } from 'react'
import type { GitKey } from './locales'
import { BranchIcon, CommitIcon, DiffIcon, PanelLeftIcon, RemoteIcon, StashIcon, TagIcon } from './icons'
import { Tip } from './Tip'

/** Which sidebar group a group icon opens in the drawer. */
export type RailGroup = 'branches' | 'tags' | 'stashes' | 'remotes'

export interface SidebarRailProps {
  /** Current view; its icon renders active. */
  readonly view: 'local' | 'commits'
  /** Uncommitted-change count for the Local Changes badge; 0 hides it. */
  readonly changeCount: number
  /** The group the drawer is currently showing, or null when collapsed. */
  readonly openGroup: RailGroup | null
  readonly onSelectView: (view: 'local' | 'commits') => void
  readonly onOpenGroup: (group: RailGroup) => void
  readonly onToggleDrawer: () => void
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
}

export function SidebarRail(props: SidebarRailProps): JSX.Element {
  const { view, changeCount, openGroup, onSelectView, onOpenGroup, onToggleDrawer, t } = props
  const drawerOpen = openGroup !== null
  const cell = (
    key: string,
    label: string,
    icon: JSX.Element,
    active: boolean,
    badge: number | null,
    onClick: () => void,
  ): JSX.Element => h(Tip, {
    key,
    label,
    side: 'right',
    children: h('button', {
      type: 'button',
      className: `gp-srail-btn${active ? ' gp-srail-btn--active' : ''}`,
      'aria-label': label,
      'aria-pressed': active,
      onClick,
    }, [
      h('span', { key: 'i', className: 'gp-srail-btn__icon' }, icon),
      badge !== null && badge > 0 ? h('span', { key: 'b', className: 'gp-srail-btn__badge' }, String(badge)) : null,
    ]),
  })

  return h('div', { className: 'gp-srail' }, [
    h('div', { key: 'top', className: 'gp-srail__top' }, [
      cell('tg', drawerOpen ? t('side.collapse') : t('side.expand'), h(PanelLeftIcon, { size: 20 }), drawerOpen, null, onToggleDrawer),
    ]),
    cell('local', t('side.local'), h(DiffIcon, { size: 20 }), view === 'local', changeCount, () => onSelectView('local')),
    cell('commits', t('side.commits'), h(CommitIcon, { size: 20 }), view === 'commits', null, () => onSelectView('commits')),
    h('div', { key: 'sep', className: 'gp-srail__sep' }),
    cell('branches', t('side.branches'), h(BranchIcon, { size: 20 }), openGroup === 'branches', null, () => onOpenGroup('branches')),
    cell('tags', t('side.tags'), h(TagIcon, { size: 20 }), openGroup === 'tags', null, () => onOpenGroup('tags')),
    cell('stashes', t('side.stashes'), h(StashIcon, { size: 20 }), openGroup === 'stashes', null, () => onOpenGroup('stashes')),
    cell('remotes', t('side.remotes'), h(RemoteIcon, { size: 20 }), openGroup === 'remotes', null, () => onOpenGroup('remotes')),
  ])
}
