/**
 * Dirty dot on the conversation shell's Git view-tab button (VSCode-style:
 * a plain dot shows iff the worktree has uncommitted changes, hidden when
 * clean).
 *
 * The shell renders the view-tab label as plain text resolved globally (no
 * per-session context, not reactive to git status), so the dot is injected
 * imperatively next to the label from the always-mounted, session-aware pill.
 * The dot carries no text, so the tab's textContent stays the plain label and
 * the pill's `activateGitTab` matcher keeps working. A narrowly-scoped
 * MutationObserver on the tab list re-applies the dot if the shell re-renders
 * the button.
 */
import { SHELL_TABLIST_SELECTOR, SHELL_TAB_SELECTOR } from './jump'

const DOT_ATTR = 'data-gp-tab-dot'

let observer: MutationObserver | undefined
let observed: HTMLElement | null = null
let currentLabel = ''
let currentDirty = false
// Owner token: with multiple shell panes two GitPill instances drive this
// module. The last one to set an active dot owns it; a clear from a stale owner
// (its unmount) must not erase the current owner's dot (last-writer-wins).
let owner: symbol | undefined

/** The shell view-tab button carrying the given label (dot excluded). */
function findTab(label: string): HTMLButtonElement | null {
  if (typeof document === 'undefined') return null
  const tabs = document.querySelectorAll<HTMLButtonElement>(SHELL_TAB_SELECTOR)
  for (const tab of tabs) {
    if (tabLabel(tab) === label) return tab
  }
  return null
}

/** Button label with our injected dot stripped (accessible name stays plain). */
function tabLabel(btn: HTMLButtonElement): string {
  const clone = btn.cloneNode(true) as HTMLButtonElement
  clone.querySelectorAll(`[${DOT_ATTR}]`).forEach((el) => el.remove())
  return (clone.textContent ?? '').trim()
}

/** Reconcile the dot on the current tab to the current dirty flag. */
function apply(): void {
  const btn = findTab(currentLabel)
  if (btn === null) return
  const existing = btn.querySelector<HTMLSpanElement>(`[${DOT_ATTR}]`)
  if (!currentDirty) {
    existing?.remove()
    return
  }
  const cls = 'gp-tab-dot gp-tab-dot--dirty'
  if (existing !== null) {
    if (existing.className !== cls) existing.className = cls
    return
  }
  const dot = document.createElement('span')
  dot.className = cls
  dot.setAttribute(DOT_ATTR, '')
  dot.setAttribute('aria-hidden', 'true')
  btn.appendChild(dot)
}

/** (Re)attach the observer to the live tab-list container. */
function ensureObserver(): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
  const container = document.querySelector<HTMLElement>(SHELL_TABLIST_SELECTOR)
  if (container === observed) return
  observer?.disconnect()
  observed = container
  if (container === null) { observer = undefined; return }
  observer = new MutationObserver(() => apply())
  observer.observe(container, { childList: true, subtree: true })
}

function teardownObserver(): void {
  observer?.disconnect()
  observer = undefined
  observed = null
}

/**
 * Set the Git tab's dirty dot (false hides it). `who` identifies the caller so
 * a later owner's clear can't be undone by an earlier instance. A clean flag
 * releases ownership and detaches the observer instead of tracking the tab.
 */
export function setGitTabDot(who: symbol, label: string, dirty: boolean): void {
  if (typeof document === 'undefined') return
  // A clean flag is a release: same owner check + teardown as clearGitTabDot.
  if (!dirty) { clearGitTabDot(who); return }
  owner = who
  currentLabel = label
  currentDirty = true
  ensureObserver()
  apply()
}

/** Remove the dot on behalf of `who` (pill unmount). A stale owner is ignored. */
export function clearGitTabDot(who: symbol): void {
  if (owner !== undefined && owner !== who) return
  owner = undefined
  currentDirty = false
  apply()
  teardownObserver()
}
