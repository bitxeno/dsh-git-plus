/**
 * dsh-git-plus client half — Cordis apply.
 */
import { createElement as h } from 'react'
import { ensureStyles } from './styles'
import { en, zh } from './locales'
import { bindContext, disposeAll, resyncAll } from './registry'
import { Panel } from './Panel'
import { GitPill } from './GitPill'
import { PillConfig } from './PillConfig'
import type { ClientCtx } from './rpc'

const NS = 'gitPlus'
const BUNDLE_KEYS = ['dsh-git-plus', '@xbzbing/dsh-git-plus'] as const

const inject = ['slots', 'locale', 'connection']
const name = 'dsh-git-plus'

function apply(ctx: ClientCtx): void {
  ensureStyles()
  bindContext(ctx)

  ctx.effect(() => ctx.locale.register(NS, { zh, en }) ?? undefined, 'dsh-git-plus: dictionaries')
  const t = ctx.locale.bind(NS) as (key: string, params?: Record<string, string | number>) => string

  const disposers: Array<() => void> = []
  const track = (handle: unknown): void => { if (typeof handle === 'function') disposers.push(handle as () => void) }

  track(ctx.slots.inject('conversation.view', () => ctx.slots.register(
    { name: 'conversation.view', id: 'git-plus', order: 30, locale: NS, label: () => t('panel.tab') },
    (props: { sessionId?: string }) => h(Panel, { ctx, sessionId: props.sessionId, t }),
  )))

  track(ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
    { name: 'conversation.input.left', id: 'git-plus-pill', order: 100, locale: NS },
    (props: { sessionId?: string }) => h(GitPill, { sessionId: props.sessionId, t }),
  )))

  for (const key of BUNDLE_KEYS) {
    track(ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register(
      { name: 'plugins.bundle.config', key, locale: NS },
      (props: { view?: string }) => (props.view === 'summary' ? t('cfg.title') : h(PillConfig, { ctx, t })),
    )))
  }

  ctx.effect(() => {
    const off = ctx.on('connection/reset', () => resyncAll())
    return () => {
      if (typeof off === 'function') off()
      for (const d of disposers.splice(0)) { try { d() } catch { /* ignore */ } }
      disposeAll()
    }
  }, 'dsh-git-plus: lifecycle')
}

module.exports = { name, inject, apply }
