/**
 * dsh-styled hover tooltip: the platform `Tooltip` bubble (external seed, not
 * bundled). Falls back to a native `title` when the host seed predates the
 * Tooltip export, so an older shell never breaks rendering.
 */
import { cloneElement, createElement as h } from 'react'
import type { JSX, ReactElement } from 'react'
import { Tooltip as PlatformTooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TooltipSide } from '@deepseek-ai/dsh-client-ui-primitives'

interface TipProps {
  readonly label: string
  readonly side?: TooltipSide
  readonly children: ReactElement
}

type RemoteTooltip = ((props: {
  label: string
  side?: TooltipSide
  portal?: boolean
  children: ReactElement
}) => JSX.Element) | undefined

const Remote = PlatformTooltip as unknown as RemoteTooltip

export function Tip({ label, side = 'bottom', children }: TipProps): JSX.Element {
  // No extra wrapper in either path: the official bubble clones the anchor,
  // and the fallback stamps a native title onto it.
  if (typeof Remote !== 'function' || label === '') return cloneElement(children, { title: label || undefined })
  return h(Remote, { label, side, portal: true, children })
}

/** Clone an anchor element with a native title (fallback path helper). */
export function withTitle(el: ReactElement, title: string | undefined): ReactElement {
  if (title === undefined || title === '') return el
  return cloneElement(el, { title })
}
