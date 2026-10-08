/**
 * Minimal ambient surface for the platform's UI primitives.
 * @deepseek-ai/dsh-client-ui-primitives is a web-shell platform seed listed
 * in package.json `dsh.client.inject`, external to the plugin bundle. These
 * declarations mirror its public MarkdownText, code-highlighting, Tooltip
 * and Menu types.
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { JSX, ReactElement, ReactNode } from 'react'

  export interface MarkdownCodeLabels {
    copyLabel: string
    copiedLabel: string
  }
  export interface MarkdownLabels {
    code: MarkdownCodeLabels
    footnotes: string
  }
  export interface HighlightSpan {
    text: string
    style: import('react').CSSProperties
  }
  export type CodeHighlighter = (code: string) => HighlightSpan[][] | undefined
  export function languageForPath(path: string): string | undefined
  export function useCodeHighlighter(language: string | undefined): CodeHighlighter
  export const FileTypeIcon: (props: ({ readonly path: string } | { readonly kind: 'folder' }) & { readonly size?: number; readonly className?: string }) => JSX.Element | null
  export const MarkdownText: (props: {
    text: string
    labels: MarkdownLabels
    variant?: 'body' | 'compact'
    streaming?: boolean
  }) => JSX.Element
  export type TooltipSide = 'right' | 'bottom' | 'top'
  export function Tooltip(props: {
    label: string | (() => string)
    side?: TooltipSide
    align?: 'center' | 'end'
    delayMs?: number
    gap?: number
    disabled?: boolean
    portal?: boolean
    maxWidth?: number
    children: ReactElement
  }): JSX.Element

  /** Shared props for every product icon component. */
  export interface PlatformIconProps {
    /** Square edge in px; defaults to the glyph's own drawn size. */
    size?: number | undefined
    /** Extra class for layout placement; color rides currentColor. */
    className?: string | undefined
  }
  export const IconChevronDownOutlineRegular: (props: PlatformIconProps) => JSX.Element
  export const IconUsersOutlineRegular: (props: PlatformIconProps) => JSX.Element

  /** Selectable menu row. */
  export interface PlatformMenuItem {
    id: string
    label: ReactNode
    disabled?: boolean
    icon?: ReactNode
    danger?: boolean
  }
  /** Hairline between item groups (not selectable). */
  export interface PlatformMenuSeparator {
    type: 'separator'
    id: string
  }
  /** Non-interactive heading row above a group of items. */
  export interface PlatformMenuLabel {
    type: 'label'
    id: string
    text: string
  }
  export type PlatformMenuEntry = PlatformMenuItem | PlatformMenuSeparator | PlatformMenuLabel
  /** Anchored dropdown menu (owner-controlled open state). */
  export function Menu(props: {
    open: boolean
    anchor: ReactNode
    items?: readonly PlatformMenuEntry[]
    selectedId?: string | undefined
    onSelect?: (id: string) => void
    onClose: () => void
    align?: 'start' | 'end'
    side?: 'bottom' | 'top' | 'right'
    portal?: boolean
    dense?: boolean
    selection?: 'check' | 'fill'
    className?: string | undefined
    listClassName?: string | undefined
  }): JSX.Element
}
