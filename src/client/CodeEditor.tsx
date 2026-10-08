/**
 * Embeddable source editor on CodeJar (2.45 kB, no dependencies): Tab key,
 * auto-indent/closing and undo history come from the library; syntax colors
 * come from the platform highlighter via innerHTML painting (cursor save and
 * restore across repaints is CodeJar's own job). Mounts fresh per edit
 * session, so the initial code is set once and never rewritten under the
 * cursor afterwards.
 */
import { createElement as h, useEffect, useRef } from 'react'
import type { JSX } from 'react'
import { CodeJar } from 'codejar'
import type { HighlightSpan } from '@deepseek-ai/dsh-client-ui-primitives'

/** Properties that must not gain a px suffix when stringified. */
const UNITLESS = new Set(['fontWeight', 'opacity', 'zIndex', 'lineHeight', 'flex', 'flexGrow', 'flexShrink', 'order'])

/** React CSSProperties → inline css text (our spans carry color/font strings). */
function styleToCss(style: HighlightSpan['style']): string {
  const out: string[] = []
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null) continue
    const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    out.push(`${kebab}:${typeof value === 'number' && !UNITLESS.has(key) ? `${value}px` : String(value)}`)
  }
  return out.join(';')
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function CodeEditor(props: {
  readonly initialCode: string
  /** Whole-text highlighter; undefined paints plain text (big files). */
  readonly highlight: ((code: string) => HighlightSpan[][] | undefined) | undefined
  readonly onChange: (code: string) => void
  readonly disabled?: boolean
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const paint = useRef(props.highlight)
  paint.current = props.highlight
  const onChange = useRef(props.onChange)
  onChange.current = props.onChange
  const initial = useRef(props.initialCode)

  useEffect(() => {
    const el = ref.current
    if (el === null) return
    const jar = CodeJar(el, (editor) => {
      const code = editor.textContent ?? ''
      const fn = paint.current
      if (fn === undefined) return
      const lines = code.split('\n')
      const spans = fn(lines.join('\n'))
      if (spans === undefined) return
      editor.innerHTML = lines.map((line, i) => {
        const row = spans[i]
        if (row === undefined) return esc(line)
        return row.map((s) => `<span style="${styleToCss(s.style)}">${esc(s.text)}</span>`).join('')
      }).join('\n')
    }, { tab: '  ' })
    jar.updateCode(initial.current)
    jar.onUpdate((code) => onChange.current(code))
    return () => jar.destroy()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (el === null) return
    if (props.disabled === true) el.setAttribute('contenteditable', 'false')
    else el.setAttribute('contenteditable', 'true')
  }, [props.disabled])

  return h('div', { ref, className: 'gp-codejar' })
}
