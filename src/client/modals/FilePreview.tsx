/**
 * Read-only file preview modal, opened from a change row's "view" menu item.
 * Content comes from the `file-content` query (working-tree file), rendered
 * like the Files tab preview: rendered Markdown with a source toggle, inline
 * images, syntax-highlighted code with the same size guards, and placeholders
 * for binary / over-cap / failed loads.
 */
import { createElement as h, useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import type { GitPanelRemote } from '../rpc'
import { queryAs } from '../rpc'
import type { GitAction } from '../types'
import type { GitKey } from '../locales'
import { ModalFooter, ModalShell } from './shell'
import { CodeEditor } from '../CodeEditor'
import {
  languageForPath, MarkdownText, useCodeHighlighter, type HighlightSpan,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { isMarkdownPath, MAX_HIGHLIGHT_BYTES, MAX_HIGHLIGHT_LINES, MAX_LINE_CHARS } from '../FilesTab'

type PreviewFile =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'tooLarge' }
  | { readonly kind: 'binary' }
  | { readonly kind: 'image'; readonly dataUrl: string }
  | { readonly kind: 'text'; readonly content: string }

export function FilePreviewModal(props: {
  readonly remote: GitPanelRemote
  readonly sessionId: string
  readonly path: string
  readonly t: (key: GitKey, params?: Record<string, string | number>) => string
  readonly onClose: () => void
  readonly onSubmit: (action: GitAction) => Promise<{ ok: boolean; error?: string }>
}): JSX.Element {
  const [file, setFile] = useState<PreviewFile>({ kind: 'loading' })
  const [renderMarkdown, setRenderMarkdown] = useState(true)
  // Inline source editing (text files only): a textarea over the loaded
  // content, saved through the write-file action.
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const markdownLabels = useMemo(() => ({
    code: { copyLabel: props.t('files.copy'), copiedLabel: props.t('files.copied') },
    footnotes: props.t('files.footnotes'),
  }), [props])
  const lines = useMemo(() => {
    if (file.kind !== 'text') return null
    const arr = file.content.split('\n')
    if (arr.length > 0 && arr[arr.length - 1] === '') arr.pop()
    return arr
  }, [file])
  // Files-tab guards: skip the grammar load entirely for big files.
  const plain = lines !== null && (file.kind === 'text' && file.content.length > MAX_HIGHLIGHT_BYTES || lines.length > MAX_HIGHLIGHT_LINES)
  const highlight = useCodeHighlighter(lines !== null && !plain ? languageForPath(props.path) : undefined)

  useEffect(() => {
    let alive = true
    setFile({ kind: 'loading' })
    setEditing(false)
    setError(null)
    void props.remote.query({ sessionId: props.sessionId, query: { kind: 'file-content', path: props.path } }).then((res) => {
      if (!alive) return
      const fc = queryAs(res, 'file-content')
      if (fc === null) { setFile({ kind: 'error' }); return }
      if (fc.tooLarge === true) { setFile({ kind: 'tooLarge' }); return }
      if (fc.variant === 'image' && fc.dataUrl !== undefined) { setFile({ kind: 'image', dataUrl: fc.dataUrl }); return }
      if (fc.variant === 'text') { setFile({ kind: 'text', content: fc.content ?? '' }); return }
      setFile({ kind: 'binary' })
    }).catch(() => { if (alive) setFile({ kind: 'error' }) })
    return () => { alive = false }
  }, [props.remote, props.sessionId, props.path])

  const startEdit = (): void => {
    if (file.kind !== 'text') return
    setDraft(file.content)
    setError(null)
    setEditing(true)
  }

  const save = async (): Promise<void> => {
    if (file.kind !== 'text' || draft === file.content) return
    setBusy(true)
    setError(null)
    const res = await props.onSubmit({ kind: 'write-file', path: props.path, content: draft })
    setBusy(false)
    if (res.ok) {
      setFile({ kind: 'text', content: draft })
      setEditing(false)
    } else {
      setError(res.error ?? '')
    }
  }

  const editable = file.kind === 'text' && !editing
  const dirty = file.kind === 'text' && draft !== file.content

  return h(ModalShell, {
    title: props.path, onClose: props.onClose, wide: true, children: [
      file.kind === 'text' && isMarkdownPath(props.path) && !editing
        ? h('div', { key: 'mode', className: 'gp-files__mode', role: 'group', 'aria-label': props.t('files.previewMode') }, [
          h('button', { key: 'source', type: 'button', className: `gp-files__mode-btn${!renderMarkdown ? ' gp-files__mode-btn--active' : ''}`, 'aria-pressed': !renderMarkdown, onClick: () => setRenderMarkdown(false) }, props.t('files.source')),
          h('button', { key: 'render', type: 'button', className: `gp-files__mode-btn${renderMarkdown ? ' gp-files__mode-btn--active' : ''}`, 'aria-pressed': renderMarkdown, onClick: () => setRenderMarkdown(true) }, props.t('files.render')),
        ])
        : null,
      h('div', { key: 'body', className: 'gp-preview-body' }, editing
        ? h(CodeEditor, {
          key: 'ed', initialCode: draft,
          highlight: plain ? undefined : highlight,
          onChange: setDraft, disabled: busy,
        })
        : renderBody(file, lines, plain, props.path, renderMarkdown, highlight, markdownLabels, props.t)),
      error !== null ? h('div', { key: 'e', className: 'gp-modal__err' }, error) : null,
      editing
        ? h(ModalFooter, { key: 'f', t: props.t, onClose: () => setEditing(false), onConfirm: () => void save(), busy, disabled: !dirty, confirmLabel: props.t('modal.save') })
        : h(ModalFooter, {
          key: 'f', t: props.t, onClose: props.onClose,
          onConfirm: editable ? startEdit : props.onClose, busy: false,
          confirmLabel: props.t(editable ? 'modal.edit' : 'common.close'),
        }),
    ],
  })
}

function renderBody(
  file: PreviewFile,
  lines: readonly string[] | null,
  plain: boolean,
  path: string,
  renderMarkdown: boolean,
  highlight: (code: string) => HighlightSpan[][] | undefined,
  markdownLabels: { code: { copyLabel: string; copiedLabel: string }; footnotes: string },
  t: (key: GitKey, params?: Record<string, string | number>) => string,
): JSX.Element {
  switch (file.kind) {
    case 'loading': return h('div', { className: 'gp-empty' }, t('common.loading'))
    case 'error': return h('div', { className: 'gp-empty' }, t('files.loadFailed'))
    case 'tooLarge': return h('div', { className: 'gp-empty' }, t('files.tooLarge'))
    case 'binary': return h('div', { className: 'gp-empty' }, t('files.binary'))
    case 'image':
      return h('div', { className: 'gp-preview-image' }, h('img', { src: file.dataUrl, alt: path }))
    case 'text': {
      if (renderMarkdown && isMarkdownPath(path)) {
        return h('div', { className: 'gp-files__markdown' }, h(MarkdownText, { text: file.content, labels: markdownLabels, variant: 'body' }))
      }
      return renderCode(lines ?? [], plain, highlight, t)
    }
  }
}

/**
 * Numbered code view with lazy highlighting under the Files-tab guards; no
 * find bar and no virtualization (a preview modal), over-long lines truncate
 * like the tab does.
 */
function renderCode(
  lines: readonly string[],
  plain: boolean,
  highlight: (code: string) => HighlightSpan[][] | undefined,
  t: (key: GitKey, params?: Record<string, string | number>) => string,
): JSX.Element {
  const highlighted = plain ? undefined : highlight(lines.join('\n'))
  const rows: JSX.Element[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const spans = highlighted?.[i]
    const cell = line === ''
      ? ' '
      : line.length > MAX_LINE_CHARS
        ? [line.slice(0, MAX_LINE_CHARS), h('span', { key: 'trunc', className: 'gp-files__trunc' }, t('files.lineTruncated'))]
        : spans !== undefined
          ? spans.map((span, j) => h('span', { key: j, style: span.style }, span.text))
          : line
    rows.push(h('div', { key: i, className: 'gp-preview-row' }, [
      h('div', { key: 'n', className: 'gp-diff-no' }, i + 1),
      h('div', { key: 'c', className: 'gp-diff-cell' }, cell),
    ]))
  }
  return h('div', { className: 'gp-preview-code' }, [
    plain ? h('div', { key: 'note', className: 'gp-files__note' }, t('files.highlightOff')) : null,
    ...rows,
  ])
}
