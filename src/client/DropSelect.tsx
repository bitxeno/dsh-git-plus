/**
 * Select dropdown on the official Menu: a select-metric trigger button plus a
 * portaled option list with check-marked selection. Replaces native <select>
 * (whose OS popup ignores the dsh theme and clips inside dialogs).
 */
import { createElement as h, useState } from 'react'
import type { JSX } from 'react'
import { IconChevronDownOutlineRegular, Menu, type PlatformMenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'

export interface DropOption {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
  /** Leading row icon (official Menu icon slot). */
  readonly icon?: JSX.Element
}

export function DropSelect(props: {
  readonly value: string
  readonly options: readonly DropOption[]
  readonly onChange: (value: string) => void
  readonly disabled?: boolean
  readonly placeholder?: string
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const disabled = props.disabled === true
  const current = props.options.find((o) => o.value === props.value)
  const items: readonly PlatformMenuEntry[] = props.options.map((o) => ({
    id: o.value, label: o.label,
    ...(o.disabled === true ? { disabled: true } : {}),
    ...(o.icon !== undefined ? { icon: o.icon } : {}),
  }))
  return h(Menu, {
    open: open && !disabled,
    anchor: h('button', {
      type: 'button',
      className: 'gp-dropselect',
      disabled,
      onClick: () => setOpen(true),
    }, [
      h('span', { key: 'l', className: 'gp-dropselect__label' }, current?.label ?? props.placeholder ?? props.value),
      h(IconChevronDownOutlineRegular, { key: 'c', size: 12 }),
    ]),
    items,
    ...(current !== undefined ? { selectedId: current.value } : {}),
    onSelect: (id: string) => { setOpen(false); props.onChange(id) },
    onClose: () => setOpen(false),
    portal: true,
    // The only style hook reaching the portaled card (see styles.ts): caps
    // the list height, otherwise it grows to ~100vh on long option lists.
    listClassName: 'gp-dropselect__list',
  })
}
