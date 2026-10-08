/**
 * Author avatar for menu rows: photo URL when resolvable, otherwise a stable
 * initial-circle (deterministic hue per name, no network needed). A broken
 * photo falls back to the circle via onError.
 */
import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import { avatarHueFor } from './avatar'

export function AuthorAvatar(props: { readonly name: string; readonly url: string | null }): JSX.Element {
  const [failed, setFailed] = useState(false)
  if (props.url !== null && !failed) {
    return h('img', {
      className: 'ggp-avatar', src: props.url, alt: '',
      onError: () => setFailed(true),
    })
  }
  const initial = [...props.name.trim()][0] ?? '?'
  return h('span', {
    className: 'gp-avatar-fallback', title: props.name,
    style: { background: `hsl(${avatarHueFor(props.name)} 45% 45%)` },
  }, initial.toUpperCase())
}
