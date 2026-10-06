/**
 * Global stylesheet, injected once into a plugin-owned <style data-plugin> tag.
 * All colors use dsh theme CSS variables so light/dark themes stay consistent.
 */

const CSS = `
.gp-panel{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-size:13px;position:relative;
  /* One selection language across the three list panes (Overview commits,
   * Changes rows, Files tree): primary-tinted fill + a 3px inset left bar. */
  --gp-select-bg:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent);
  --gp-select-bar:inset 3px 0 0 var(--dsw-alias-state-business-primary)}
.gp-panel[data-font-delta="1"]{zoom:1.08;font-size:14px}
.gp-panel[data-font-delta="-1"]{zoom:.92;font-size:12px}
.gp-tabbar{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;flex-wrap:nowrap;min-width:0;container-type:inline-size}
/* The shell floats the input composer over the view's bottom (composer-overlay
 * mode). Reserve that height as bottom padding so the panel's own bottom rows
 * (commit box / commit comment) stay above it instead of being covered. */
.gp-body{flex:1;min-height:0;display:flex;overflow:hidden;padding-bottom:calc(var(--dsh-composer-height,140px) + 12px)}
/* version + update-check cluster, pushed to the tab bar's trailing edge */
.gp-verbar{margin-left:auto;display:inline-flex;align-items:center;gap:8px}
.gp-verbar__tag{font-size:11px;color:var(--dsw-alias-label-tertiary);font-family:var(--dsw-font-mono,ui-monospace,monospace)}
.gp-verbar__btn{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap}
.gp-verbar__btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.gp-verbar__btn:disabled{opacity:.6;cursor:default}
.gp-verbar__status{font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gp-verbar__status--ok{color:var(--dsw-alias-state-success-primary)}
.gp-verbar__status--new{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-state-business-primary))}
.gp-verbar__status--err{color:var(--dsw-alias-state-error-primary)}
.gp-verbar__link{color:var(--dsw-alias-state-business-primary);font-size:11px;text-decoration:none;white-space:nowrap}
.gp-verbar__link:hover{text-decoration:underline}
.gp-verbar__gh{color:var(--dsw-alias-label-secondary);text-decoration:none}
.gp-verbar__gh:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.gp-tab{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer;flex:none;transition:background .12s ease,color .12s ease}
.gp-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
/* Active tab: primary-tinted fill + primary text + medium weight + a soft ring.
 * Clear enough to spot at a glance, restrained enough not to shout. */
.gp-tab--active{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);color:var(--dsw-alias-state-business-primary);font-weight:600;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 32%,transparent)}
.gp-tab__icon{display:inline-flex;width:15px;height:15px;flex:none}
.gp-tab__label{white-space:nowrap}
/* Responsive tab bar (the bar is an inline-size container): as the panel
 * narrows — e.g. when the right sidebar opens — shed the trailing controls
 * first, then drop the tab labels to icon-only. Two stages, so labels never
 * wrap or overflow into the garbled multi-line state. */
@container (max-width:460px){.gp-tabbar .gp-font,.gp-tabbar .gp-verbar{display:none}}
@container (max-width:300px){.gp-tab__label{display:none}.gp-tab{gap:0;padding:0 10px}}
.gp-font{margin-left:4px;display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;overflow:hidden}
.gp-font button{border:0;border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:22px;width:24px;height:24px;padding:0;cursor:pointer}
.gp-font button:first-child{border-left:0}
.gp-font button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.gp-font button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.gp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:100%;color:var(--dsw-alias-label-tertiary);font-size:12px;padding:24px;text-align:center}
.gp-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.gp-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;padding:0 10px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}
.gp-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.gp-btn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover))}
.gp-btn:disabled{opacity:.4;cursor:not-allowed}
.gp-btn--primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.gp-btn--primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
/* Busy spinner inside confirm buttons while a long action (push/pull/fetch) runs. */
.gp-spin{width:12px;height:12px;flex:none;border:1.5px solid color-mix(in srgb,currentColor 35%,transparent);border-top-color:currentColor;border-radius:50%;animation:gp-spin .7s linear infinite}
@keyframes gp-spin{to{transform:rotate(360deg)}}
.gp-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}
.gp-icon-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.gp-icon-btn:disabled{opacity:.4;cursor:not-allowed}

/* three-column overview — side columns shrink (with a min floor) instead of
 * staying fixed, and the middle keeps a guaranteed min so it never collapses to
 * blank when a right sidebar narrows the panel. */
.gp-overview{display:flex;width:100%;min-height:0}
.gp-col{display:flex;flex-direction:column;min-height:0;min-width:0}
.gp-col--left{flex:0 1 200px;min-width:130px;overflow-y:auto}
.gp-col--mid{flex:1 1 0;min-width:150px}
.gp-col--right{flex:0 1 340px;min-width:190px;display:flex;flex-direction:column;min-height:0}
/* drag handle between two columns: a thin hit area with a hairline center that
 * thickens to the accent colour on hover / drag. */
.gp-resizer{flex:0 0 5px;align-self:stretch;cursor:col-resize;position:relative;background:transparent;touch-action:none;user-select:none}
.gp-resizer::before{content:"";position:absolute;top:0;bottom:0;left:2px;width:1px;background:var(--dsw-alias-border-l2)}
.gp-resizer:hover::before,.gp-resizer:active::before{left:1px;width:3px;background:var(--dsw-alias-state-business-primary)}

/* branch list */
.gp-branch-group{padding:2px 0}
.gp-branch-group__head{display:flex;align-items:center;gap:6px;height:24px;padding:0 10px;font-size:13px;color:var(--dsw-alias-label-tertiary);cursor:pointer;user-select:none}
.gp-branch-group__head:hover{color:var(--dsw-alias-label-secondary)}
.gp-branch-row{display:flex;align-items:center;gap:6px;min-height:30px;padding:5px 10px 5px 22px;cursor:pointer;border-radius:var(--dsw-radius-md);font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gp-branch-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.gp-branch-row--active{background:var(--dsw-alias-interactive-bg-hover)}
.gp-branch-row--current{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-state-business-primary))}
.gp-branch-row__track{margin-left:auto;font-size:10px;color:var(--dsw-alias-label-tertiary)}
/* Leading row icon slot (branch/tag/stash rows). */
.gp-row-icon{display:inline-flex;width:14px;flex:none}
/* Local-only ref (no remote-tracking counterpart): dim the icon only, the name
 * stays readable so the row remains easy to scan. Tertiary colour plus a slight
 * opacity — enough to read as "muted" beside a normal icon while staying
 * visible. Not --dsw-alias-label-dimmed: that token is only ~1.3:1 on white, so
 * any extra opacity erased the icon entirely. */
.gp-row-icon--local-only{color:var(--dsw-alias-label-tertiary);opacity:.55}

/* history */
.gp-history{display:flex;flex-direction:column;height:100%;min-height:0}
/* overscroll-behavior:contain keeps a wheel gesture that reaches the top/bottom
 * of the commit list from bubbling out and scrolling the whole conversation. */
.gp-history__list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.gp-commit-row{display:grid;align-items:center;gap:8px;height:30px;padding:0 10px;cursor:pointer;border-bottom:1px solid transparent}
.gp-commit-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.gp-commit-row--active,.gp-commit-row--active:hover{background:var(--gp-select-bg);box-shadow:var(--gp-select-bar)}
.gp-commit-subject{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gp-commit-hash{font-family:var(--dsw-font-mono,monospace);font-size:11px;color:var(--dsw-alias-label-tertiary)}
.gp-commit-author{font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gp-commit-date{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.gp-ref-chip{display:inline-block;padding:0 6px;margin-right:4px;border-radius:8px;font-size:10px;line-height:16px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2)}
.gp-ref-chip--head{background:var(--dsw-alias-state-business-primary);color:#fff;border-color:transparent}
.gp-ref-chip--remote{color:var(--dsw-alias-label-tertiary)}
.gp-ref-chip--tag{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-label-secondary))}
.gp-graph-cell{position:relative}
.gp-graph-svg{display:block}
.gp-search{flex:1;min-width:60px;height:32px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:0 10px;box-sizing:border-box}
.gp-search::placeholder{color:var(--dsw-alias-label-dimmed)}
.gp-search:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.gp-select{height:32px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:0 24px 0 10px;appearance:none;background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;cursor:pointer}
.gp-select:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.gp-select:disabled{opacity:.5;cursor:not-allowed}

/* commit detail (right pane): the changed-file tree and the commit message
 * split the column in half, each scrolling on its own. Equal halves keep the
 * comment visible instead of the file tree pushing it below the fold. */
.gp-detail{display:flex;flex-direction:column;min-height:0;height:100%}
.gp-detail__files{flex:1 1 50%;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.gp-detail__msg{flex:1 1 50%;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:10px}
.gp-detail__subject{font-weight:600;margin-bottom:6px}
.gp-detail__meta{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap}
.gp-detail__body{white-space:pre-wrap;font-size:12px;color:var(--dsw-alias-label-secondary);margin:0;font-family:inherit}

/* file tree — 13px to match the middle history list (was 12px, felt cramped) */
.gp-tree-row{display:flex;align-items:center;gap:6px;padding:3px 10px;cursor:pointer;font-size:13px;border-radius:4px}
.gp-tree-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.gp-tree-row--active{background:var(--dsw-alias-bg-layer-2)}
.gp-tree-row--muted{color:var(--dsw-alias-label-tertiary);cursor:default}
.gp-tree-row--muted:hover{background:transparent}
.gp-tree-chev{flex:none;width:11px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}
.gp-tree-ic{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-tertiary)}
.gp-tree-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.gp-files__entry{width:100%;border:0;background:transparent;color:inherit;text-align:left;font:inherit}
.gp-files__entry--dir .gp-tree-name{font-weight:600}
.gp-files__entry:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.gp-files__entry.gp-tree-row--active,.gp-files__entry.gp-tree-row--active:hover{background:var(--gp-select-bg);box-shadow:var(--gp-select-bar)}
.gp-files__entry.gp-tree-row--active .gp-tree-name{font-weight:600}
.gp-tree-row--ignored{opacity:.5}
.gp-tree-row--ignored:hover,.gp-tree-row--ignored:focus-visible{opacity:.85}
.gp-status-badge{flex:none;width:14px;text-align:center;font-size:11px;font-weight:600}
.gp-status--added{color:var(--dsw-alias-state-success-primary)}
.gp-status--modified{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-state-business-primary))}
.gp-status--deleted{color:var(--dsw-alias-state-error-primary)}
.gp-status--untracked{color:var(--dsw-alias-label-tertiary)}
.gp-status--renamed{color:var(--dsw-alias-state-business-primary)}

/* changes page — height:100% bounds the row to the panel so the right diff
 * scrolls inside its own pane instead of growing and pushing the left commit
 * box below the fold. */
.gp-changes{display:flex;width:100%;height:100%;min-height:0}
.gp-changes__left{flex:0 1 380px;min-width:220px;display:flex;flex-direction:column;min-height:0}
.gp-changes__right{flex:1 1 0;min-width:180px;display:flex;flex-direction:column;min-height:0}
/* files browser: resizable tree column + preview pane */
.gp-files{display:flex;width:100%;height:100%;min-height:0}
.gp-files__tree{flex:0 0 300px;min-width:180px;display:flex;flex-direction:column;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 0}
.gp-files__preview{flex:1 1 0;min-width:180px;display:flex;flex-direction:column;min-height:0}
.gp-files__preview-content{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.gp-files__bar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:6px 12px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.gp-files__path{flex:1 1 120px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font:inherit}
.gp-files__copy-path{flex:none;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px}
.gp-files__copy-path:hover{background:var(--dsw-alias-interactive-bg-hover)}
.gp-files__copy-path:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.gp-files__copy-path--error{color:var(--dsw-alias-state-error-primary)}
.gp-files__mode{display:flex;gap:4px}
.gp-files__mode-btn{border:0;border-radius:6px;padding:4px 10px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px}
.gp-files__mode-btn--active{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}
.gp-files__mode-btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.gp-files__markdown{overflow:auto;overscroll-behavior:contain;padding:16px 24px;color:var(--dsw-alias-label-primary)}
.gp-files__html{flex:1;min-height:0;width:100%;border:0;background:#fff}
.gp-files__code{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;font-family:var(--dsw-font-mono,monospace);font-size:12px;position:relative}
.gp-files__header{position:sticky;top:0;z-index:2}
.gp-files__note{padding:5px 12px;font-size:11px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l2)}
.gp-find{display:flex;align-items:center;gap:4px;padding:5px 8px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l2)}
.gp-find__input{flex:1;min-width:60px;height:26px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:0 8px;box-sizing:border-box}
.gp-find__input:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.gp-find__count{flex:none;min-width:44px;text-align:center;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.gp-find__btn{flex:none;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:14px;line-height:1}
.gp-find__btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.gp-find__btn:disabled{color:var(--dsw-alias-label-quaternary);cursor:default}
.gp-find__btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.gp-find__case{width:auto;padding:0 6px;font-size:11px;font-weight:600}
.gp-find__case--active{background:var(--dsw-alias-state-business-primary);color:#fff}
.gp-find__case--active:hover{background:var(--dsw-alias-state-business-primary);color:#fff}
.gp-find-hit{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent);color:inherit;border-radius:2px}
.gp-find-hit--active{background:var(--dsw-alias-state-warn-primary);color:var(--dsw-static-neutral-1000,#000)}
.gp-files__trunc{color:var(--dsw-alias-label-tertiary);font-style:italic}
.gp-files__single{display:grid;grid-template-columns:44px 1fr}
/* Virtualized source view: the outer box is a fixed-height spacer that owns the
 * scrollbar; each mounted row is absolutely positioned at its line offset and
 * lays its line-number gutter + code cell on one fixed-height row. */
.gp-files__single--virt{display:block;position:relative;width:100%}
.gp-files__row{position:absolute;left:0;right:0;display:grid;grid-template-columns:44px 1fr;height:20px}
/* Fixed row height needs non-wrapping cells; a long line scrolls horizontally
 * on the container instead of growing the row past ROW_HEIGHT. */
.gp-files__row .gp-diff-cell{white-space:pre;overflow:hidden;text-overflow:clip}
.gp-files__image{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;align-items:center;justify-content:center;padding:16px;background-color:var(--dsw-alias-bg-layer-1);background-image:linear-gradient(45deg,color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent) 25%,transparent 25%,transparent 50%,color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent) 50%,color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent) 75%,transparent 75%);background-size:16px 16px}
.gp-files__image img{max-width:100%;max-height:100%;object-fit:contain}
.gp-changes__list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 0}
.gp-check{width:14px;height:14px;flex:none;cursor:pointer}
.gp-group-head{display:flex;align-items:center;gap:6px;padding:5px 10px;font-size:11px;color:var(--dsw-alias-label-tertiary);cursor:pointer;user-select:none}
.gp-file-row{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 20px;cursor:pointer;font-size:12px;border-radius:4px}
.gp-file-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
/* Selected change row: identical accent to the Git overview commit list
 * (business-primary 16% tint + a 3px inset left bar), for one selection
 * language across panes. */
.gp-file-row--active,.gp-file-row--active:hover{background:var(--gp-select-bg);box-shadow:var(--gp-select-bar)}
/* Actions occupy a fixed lane at all times (visibility toggle, not display)
 * so hovering never changes the row's width — no wobble. */
.gp-file-row__actions{margin-left:auto;display:flex;gap:4px;flex:none;visibility:hidden}
.gp-file-row:hover .gp-file-row__actions{visibility:visible}
/* changes tree: Unstaged / Staged blocks with folder rows (folder action applies to all files under it) */
.gp-changes__grouphead{display:flex;align-items:center;gap:6px;padding:8px 10px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);cursor:pointer;user-select:none;background:#FBFBFB;border-top:1px solid var(--dsw-alias-border-l2)}
.gp-changes__grouphead .gp-btn{margin-left:auto}
/* first block shares the stats bar's bottom hairline instead of doubling it */
.gp-changes__group:first-child .gp-changes__grouphead{border-top:none}
.gp-tdir{display:flex;align-items:center;gap:6px;padding-top:4px;padding-bottom:4px;padding-right:10px;cursor:default;font-size:12px;border-radius:4px;color:var(--dsw-alias-label-primary)}
.gp-tdir:hover{background:var(--dsw-alias-interactive-bg-hover)}
.gp-tdir--active,.gp-tdir--active:hover{background:var(--gp-select-bg);box-shadow:var(--gp-select-bar)}
.gp-tdir__chev{display:inline-flex;cursor:pointer;border-radius:4px}
.gp-tdir__actions{margin-left:auto;display:flex;gap:4px;flex:none;visibility:hidden}
.gp-tdir:hover .gp-tdir__actions{visibility:visible}
.gp-folder{display:inline-flex;flex:none;color:var(--dsw-alias-state-business-primary)}

/* stats bar */
.gp-stats{display:flex;align-items:center;gap:14px;padding:8px 12px;min-height:33px;box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px;color:var(--dsw-alias-label-secondary);flex:none;flex-wrap:wrap}
.gp-stats__item{display:inline-flex;align-items:center;gap:5px}
/* The two timestamps wrap as one unit and never split across lines. */
.gp-stats__times{display:inline-flex;align-items:center;gap:14px;flex-wrap:nowrap}
.gp-stats__add{color:var(--dsw-alias-state-success-primary)}
.gp-stats__del{color:var(--dsw-alias-state-error-primary)}

/* commit box */
.gp-commitbox{flex:none;border-top:1px solid var(--dsw-alias-border-l2);padding:8px 10px;display:flex;flex-direction:column;gap:8px}
.gp-commitbox__msg{width:100%;min-height:72px;resize:vertical;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:8px 10px;box-sizing:border-box}
.gp-commitbox__msg::placeholder{color:var(--dsw-alias-label-dimmed)}
.gp-commitbox__msg:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.gp-commitbox__row{display:flex;align-items:center;gap:10px}
.gp-commitbox__amend{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.gp-commitbox__amend input{width:16px;height:16px;accent-color:var(--dsw-alias-state-business-primary);cursor:pointer}
.gp-commitbox__actions{margin-left:auto;display:flex;gap:6px}

/* diff view */
.gp-diff{flex:1;min-height:0;display:flex;flex-direction:column}
.gp-diff__toolbar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.gp-diff__path{font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gp-diff__expand{border:1px solid var(--dsw-alias-border-l2);border-radius:7px}
.gp-diff__expand:disabled{opacity:.45;cursor:not-allowed}
.gp-seg{display:inline-grid;grid-auto-flow:column;gap:2px;padding:4px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover)}
.gp-seg__btn{position:relative;height:28px;padding:0 12px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;font-weight:500;white-space:nowrap;cursor:pointer}
.gp-seg__btn:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.gp-seg__btn:disabled{opacity:.4;cursor:default}
.gp-seg__btn--active{background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-soft);color:var(--dsw-alias-label-primary)}
.gp-diff__expand{flex:none}
.gp-diff__scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;font-family:var(--dsw-font-mono,monospace);font-size:12px}
/* DiffView wraps its Find bar + body so the bar can stick to the scroll top. */
.gp-diff__wrap{display:flex;flex-direction:column;min-height:100%}
/* Large-diff opt-in: the pane shows this instead of the rows until the user
 * clicks Load, so a huge diff cannot freeze the panel on open. */
.gp-diff__large{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;min-height:160px;padding:24px;text-align:center;font-family:var(--dsw-font-family,inherit);font-size:13px;color:var(--dsw-alias-label-secondary)}
.gp-diff__large-msg{font-weight:500;color:var(--dsw-alias-label-primary)}
.gp-diff__large-hint{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.gp-diff__large-btn{margin-top:2px}
.gp-diff__wrap .gp-find{position:sticky;top:0;z-index:2}
.gp-diff__side{display:grid;grid-template-columns:38px 1fr 38px 1fr}
/* unified (inline) layout: old|new line-number gutters + a sign column + one
 * shared code column; add/del tint the whole code cell, not one side. */
.gp-diff__unified{display:grid;grid-template-columns:38px 38px 18px 1fr}
/* before/after single column: one line-number gutter + code */
.gp-diff__single{display:grid;grid-template-columns:38px 1fr}
.gp-diff-uni__sign{text-align:center;user-select:none;font-size:11px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.gp-diff-uni__sign.gp-diff-row--add{color:var(--dsw-alias-state-success-primary)}
.gp-diff-uni__sign.gp-diff-row--del{color:var(--dsw-alias-state-error-primary)}
.gp-diff-uni__code{box-shadow:none}
.gp-diff-cell{padding:0 4px;white-space:pre-wrap;word-break:break-all;line-height:20px}
.gp-diff-no{color:var(--dsw-alias-label-tertiary);text-align:right;padding:0 5px;user-select:none;font-size:11px;line-height:20px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent);border-right:1px solid var(--dsw-alias-border-l2)}
.gp-diff-row--add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 15%,transparent);box-shadow:inset 2px 0 0 color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,transparent)}
.gp-diff-row--del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 15%,transparent);box-shadow:inset 2px 0 0 color-mix(in srgb,var(--dsw-alias-state-error-primary) 55%,transparent)}
.gp-diff-row--hunk{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 6%,transparent);color:var(--dsw-alias-state-business-primary);padding:3px 8px;font-size:11px;font-weight:600;border-top:1px solid var(--dsw-alias-border-l2);border-bottom:1px solid var(--dsw-alias-border-l2)}
/* collapsed-context band with expand controls (spans both sides). A gap is
 * always immediately followed by a hunk header (or the file end), so it omits
 * its own bottom border and lets the hunk's top border be the single divider —
 * otherwise the two 1px borders stack into a fat 2px line. */
.gp-diff-row--gap{display:flex;align-items:center;justify-content:center;gap:6px;padding:2px 10px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 6%,transparent);border-top:1px solid var(--dsw-alias-border-l2)}
.gp-gap__btn{display:inline-flex;align-items:center;height:20px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-state-business-primary);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;transition:background .12s ease}
.gp-gap__btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.gp-gap__btn:disabled{opacity:.55;cursor:default}
/* word-level intra-line change emphasis: a deeper add/del tint over the row
 * background so the exact changed tokens stand out. */
.gp-diff-word{border-radius:3px;padding:0 1px}
.gp-diff-word--add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 38%,transparent)}
.gp-diff-word--del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 38%,transparent)}
.gp-diff__truncated{color:var(--dsw-alias-label-tertiary);font-style:italic}
/* image comparison: old/new panes (split) or one pane (before/after) */
.gp-imgcmp{display:grid;grid-template-columns:1fr 1fr;gap:1px;height:100%;background:var(--dsw-alias-border-l2)}
.gp-imgcmp--single{grid-template-columns:1fr}
.gp-imgcmp__pane{display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--dsw-alias-bg-layer-2)}
.gp-imgcmp__head{flex:none;padding:4px 10px;font-size:11px;color:var(--dsw-alias-label-tertiary);border-bottom:1px solid var(--dsw-alias-border-l2)}
.gp-imgcmp__img{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;align-items:center;justify-content:center;padding:10px;background-color:var(--dsw-alias-bg-layer-1);background-image:linear-gradient(45deg,color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent) 25%,transparent 25%,transparent 50%,color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent) 50%,color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent) 75%,transparent 75%);background-size:16px 16px}
.gp-imgcmp__img img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:auto}
.gp-imgcmp__missing{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:12px;background:var(--dsw-alias-bg-layer-1)}
/* SVG diff: render/source toggle bar above the rendered comparison or source diff */
.gp-svgdiff{display:flex;flex-direction:column;height:100%;min-height:0}
.gp-svgdiff__bar{flex:none;display:flex;justify-content:flex-end;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.gp-svgdiff__body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto;overscroll-behavior:contain}
.gp-feedback{padding:6px 10px;font-size:12px;color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);display:flex;align-items:center;gap:8px}

/* commit file-diff modal (overview → click a file): a centered dialog over a
 * dimmed backdrop, closed by Esc / backdrop click / the close button. */
.gp-modal-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:40px;background:color-mix(in srgb,var(--dsw-alias-bg-base,#000) 62%,transparent);backdrop-filter:blur(2px);animation:gp-fade-in .12s ease}
@keyframes gp-fade-in{from{opacity:0}to{opacity:1}}
.gp-modal{display:flex;flex-direction:column;width:min(920px,86vw);height:min(680px,82vh);border:1px solid var(--dsw-alias-border-l1,var(--dsw-alias-border-l2));border-radius:14px;background:var(--dsw-alias-bg-layer-2);box-shadow:0 24px 64px rgba(0,0,0,.32),0 4px 12px rgba(0,0,0,.18);overflow:hidden;animation:gp-modal-in .18s cubic-bezier(.16,1,.3,1)}
@keyframes gp-modal-in{from{transform:translateY(12px) scale(.97);opacity:0}to{transform:none;opacity:1}}
.gp-modal__bar{display:flex;align-items:center;gap:10px;padding:11px 12px 11px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);flex:none}
.gp-modal__fileicon{display:inline-flex;align-items:center;color:var(--dsw-alias-label-tertiary);flex:none}
.gp-modal__path{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.gp-modal__dir{color:var(--dsw-alias-label-tertiary)}
.gp-modal__name{color:var(--dsw-alias-label-primary);font-weight:600}
.gp-modal__hash{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;color:var(--dsw-alias-label-tertiary);padding:2px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-1));flex:none}
.gp-modal__sum{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-family:var(--dsw-font-mono,ui-monospace,monospace);flex:none}
.gp-modal__close{flex:none}
.gp-modal__scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;font-family:var(--dsw-font-mono,monospace);font-size:12px;background:var(--dsw-alias-bg-layer-2)}

/* commit hover card (middle column): pointer-anchored, lists changed files */
.gp-hovercard{position:fixed;z-index:70;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,var(--dsw-alias-border-l2));border-radius:10px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));box-shadow:0 8px 28px rgba(0,0,0,.2),0 1px 3px rgba(0,0,0,.12);font-size:12px;pointer-events:none;max-height:60vh;overflow:hidden;display:flex;flex-direction:column}
.gp-hovercard__subject{font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gp-hovercard__meta{display:flex;gap:8px;font-size:11px;color:var(--dsw-alias-label-tertiary);margin-bottom:8px}
.gp-hovercard__loading{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.gp-hovercard__body{margin:0;font-family:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;overflow-y:auto;min-height:0}

/* input-bar pill (zsh style) — repo cyan, (branch) green when synced /
 * orange when dirty. Fully-rounded (999px) to match the dsh-openviking-manager
 * input-bar toggle pill. */
.gp-pill-wrap{display:inline-flex}
.gp-pill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-1);font:inherit;font-size:12px;line-height:16px;cursor:pointer;white-space:nowrap;max-width:280px;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-weight:600}
.gp-pill:hover{background:var(--dsw-alias-interactive-bg-hover)}
.gp-pill__dot{display:none;flex:none;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-tertiary)}
.gp-pill__repo{color:var(--dsw-alias-state-business-primary,#5ac8fa);flex:none;overflow:hidden;text-overflow:ellipsis}
.gp-pill__git{margin-left:6px;display:inline-flex;align-items:center;min-width:0}
.gp-pill--synced .gp-pill__git{color:var(--dsw-alias-state-success-primary,#3fb950)}
.gp-pill--dirty .gp-pill__git{color:var(--dsw-alias-state-warn-primary,#e0982e)}
.gp-pill--synced .gp-pill__dot{background:var(--dsw-alias-state-success-primary,#3fb950)}
.gp-pill--dirty .gp-pill__dot{background:var(--dsw-alias-state-warn-primary,#e0982e)}
.gp-pill__branch{color:inherit;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gp-pill--plain{cursor:default;font-weight:500}
.gp-pill--plain .gp-pill__repo{color:var(--dsw-alias-label-secondary)}
.gp-pill--degraded{color:var(--dsw-alias-label-tertiary);cursor:default;font-weight:500}
/* When the workspace is narrow (a sidebar opens), collapse the pill to a single
 * status dot — width-driven, so it expands back as the workspace widens. The
 * git status color is preserved via .gp-pill__dot. */
.gp-pill--compact{gap:0;padding:0;width:28px;min-width:28px;height:28px;justify-content:center;border-radius:999px}
.gp-pill--compact .gp-pill__dot{display:block}
.gp-pill--compact .gp-pill__repo,.gp-pill--compact .gp-pill__git{display:none}

/* plugin detail config form (plugins.bundle.config slot body) */
.gp-cfg{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.gp-cfg__title{margin:0;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
.gp-cfg__row{display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none}
/* 开关清零 border/padding：::after 按 padding box 定位，UA 默认 1px 边框会把定位框上下各缩 1px，滑块上缘就多出 1px 空隙。 */
.gp-cfg__switch{appearance:none;-webkit-appearance:none;flex:none;width:32px;height:18px;margin:0;padding:0;border:0;border-radius:999px;background:var(--dsw-alias-border-l2);position:relative;transition:background .15s ease;cursor:pointer}
.gp-cfg__switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s ease}
.gp-cfg__switch:checked{background:var(--dsw-alias-state-business-primary)}
.gp-cfg__switch:checked::after{transform:translateX(14px)}
.gp-cfg__switch:disabled{opacity:.5;cursor:default}
.gp-cfg__switch:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.gp-cfg__text{font-size:13px;color:var(--dsw-alias-label-primary)}
.gp-cfg__seg{align-self:flex-start}
.gp-cfg__hint{margin:0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}
.gp-cfg__err{margin:0;font-size:12px;color:var(--dsw-alias-state-error-primary)}

/* status dot appended to the shell's Git view-tab button — shown only when the
 * input-bar marker is hidden; colour mirrors the pill branch (synced/dirty). */
.gp-tab-dot{display:inline-block;width:7px;height:7px;margin-left:6px;border-radius:999px;vertical-align:middle;flex:none}
.gp-tab-dot--synced{background:var(--dsw-alias-state-success-primary,#3fb950)}
.gp-tab-dot--dirty{background:var(--dsw-alias-state-warn-primary,#e0982e)}

/* pill wrapper + rounded hover tooltip panel (openviking-manager style):
 * soft radius, layered shadow, subtle border, portaled above the pill. */
.gp-tip{position:fixed;z-index:60;max-width:520px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l1,var(--dsw-alias-border-l2));border-radius:12px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));box-shadow:0 6px 24px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.12);font-size:12px;line-height:1.5;pointer-events:none}
.gp-tip__path{color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-mono,ui-monospace,monospace);word-break:break-all}
.gp-tip__note{margin-top:4px;color:var(--dsw-alias-label-tertiary)}

/* dsh-git-plus: sidebar + content layout */
.gp-plus__body{flex:1;display:flex;overflow:hidden;min-height:0}
.gp-plus__side{overflow-y:auto;overscroll-behavior:contain;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.gp-plus__content{flex:1 1 0;min-width:0;display:flex;overflow:hidden}
.gp-plus__main{display:flex;width:100%;min-height:0}
.gp-plus__view{display:flex;flex-direction:column;width:100%;min-height:0}
.gp-side{padding:8px;display:flex;flex-direction:column;gap:8px}
.gp-side__top{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;padding:4px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover)}
.gp-side__nav{display:flex;align-items:center;justify-content:center;gap:6px;height:28px;padding:0 8px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer;text-align:center;min-width:0}
.gp-side__nav:hover{color:var(--dsw-alias-label-primary)}
.gp-side__nav--active{background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-soft);color:var(--dsw-alias-label-primary)}
.gp-side__nav > span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.gp-side__badge{display:inline-flex;align-items:center;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);color:var(--dsw-alias-state-warn-primary)}
.gp-side__net{display:flex;align-items:center;justify-content:center;gap:8px;padding:5px 4px;border-top:.5px solid var(--dsw-alias-border-l2);border-bottom:.5px solid var(--dsw-alias-border-l2)}
.gp-side__net button{display:inline-flex;align-items:center;justify-content:center;width:36px;height:28px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.gp-side__net button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.gp-side__group{border-top:1px solid var(--dsw-alias-border-l1);padding-top:6px}
.gp-side__hact{display:flex;gap:2px;margin-left:auto;opacity:0}
.gp-branch-group__head:hover .gp-side__hact,.gp-side__hact:focus-within{opacity:1}
.gp-side__hact button{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 4px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font-size:14px;cursor:pointer}
.gp-side__hact button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.gp-side__gbody{display:flex;flex-direction:column;gap:2px;margin-top:4px}
.gp-side__row{display:flex;align-items:center;justify-content:space-between;border-radius:var(--dsw-radius-md)}
.gp-side__row--sel{background:var(--dsw-alias-interactive-bg-hover)}
.gp-side__item{flex:1;display:flex;align-items:center;gap:6px;padding:4px 6px;color:var(--dsw-alias-label-primary);text-align:left;overflow:hidden}
.gp-side__name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12px}
.gp-side__icon{flex:none;color:var(--dsw-alias-label-tertiary)}
.gp-side__cur{font-size:10px;color:var(--dsw-alias-state-success-primary,#3fb950)}
.gp-side__ahead{font-size:10px;color:var(--dsw-alias-state-success-primary)}
.gp-side__behind{font-size:10px;color:var(--dsw-alias-state-warn-primary)}
.gp-side__ops{display:flex;gap:2px}
.gp-side__ops button{padding:2px 5px;border-radius:6px;color:var(--dsw-alias-label-tertiary)}
.gp-side__ops button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.gp-side__danger{color:var(--dsw-alias-state-error-primary) !important}
.gp-side__error{color:var(--dsw-alias-state-error-primary);font-size:12px}
.gp-conflict{margin:8px;padding:10px 12px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent)}
.gp-conflict__head{font-weight:700;color:var(--dsw-alias-state-error-primary)}
.gp-conflict__desc{font-size:12px;color:var(--dsw-alias-label-secondary);margin:4px 0}
.gp-conflict__files{max-height:120px;overflow:auto;font-family:var(--dsw-font-mono,monospace);font-size:12px}
.gp-conflict__ops{display:flex;gap:8px;margin-top:8px}
.gp-modal-backdrop{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center}
/* form dialogs (official Modal metrics: 380px card, panel radius, 24px pads) */
.gp-dialog-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.4))}
.gp-dialog{box-sizing:border-box;display:flex;flex-direction:column;gap:0;width:min(380px,100%);max-height:100%;overflow:hidden auto;border:0;border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent)}
.gp-dialog__head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:22px 14px 12px 24px}
.gp-dialog__title{margin:0;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary)}
.gp-dialog__x{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.gp-dialog__x:hover{background:var(--dsw-alias-interactive-bg-hover)}
.gp-dialog__body{padding:0 24px;display:flex;flex-direction:column;gap:12px}
.gp-dialog__foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:20px 24px 24px}
.gp-modal__err{color:var(--dsw-alias-state-error-primary);font-size:12px}
.gp-field{display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.gp-field input[type=text]{box-sizing:border-box;height:32px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit}
.gp-modal__into{display:inline-flex;align-items:center;gap:6px;height:32px;font-size:13px;color:var(--dsw-alias-label-primary)}
.gp-field input[type=text]::placeholder{color:var(--dsw-alias-label-dimmed)}
.gp-field input[type=text]:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
/* Checkbox row inside a form dialog. Deliberately NOT the bare-input class:
 * that one sets width/height 14px, and sharing it made the label a 14px-wide
 * flex box that wrapped its text one character per line. */
.gp-check-row{display:flex;align-items:center;gap:8px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);cursor:pointer}
.gp-check-row input{flex:none;width:16px;height:16px;accent-color:var(--dsw-alias-state-business-primary);cursor:pointer}
.gp-check-row--danger{color:var(--dsw-alias-state-error-primary)}
.gp-radio{display:flex;flex-direction:column;gap:8px}
.gp-btn--primary{background:var(--dsw-alias-state-business-primary,#5ac8fa);color:#fff;border-radius:8px;padding:6px 14px}
.gp-rail{display:flex;flex-direction:column;overflow:auto}
.gp-rail__row{display:flex;align-items:center;gap:8px;padding:4px 8px;text-align:left;border-radius:6px}
.gp-rail__row--sel{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#5ac8fa) 16%,transparent)}
.gp-rail__graph{position:relative;height:18px;flex:none}
.gp-rail__node{position:absolute;top:4px;width:10px;height:10px;border-radius:999px;border:2px solid}
.gp-rail__subject{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gp-rail__hash{font-family:var(--dsw-font-mono,monospace);color:var(--dsw-alias-label-tertiary);font-size:11px}

/* Composer tool-row Git entry (conversation.input.left, mode selector旁) — 同 dsh-git-manager 的 gm-toolbtn */
.gp-toolbtn{display:inline-flex;align-items:center;gap:5px;height:28px;margin-left:-4px;padding:0 7px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;line-height:1}
.gp-toolbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.gp-toolbtn svg{flex:none}
.gp-toolbtn-label{max-width:140px;overflow:hidden;text-overflow:ellipsis}

/* All Commits top/bottom layout (git-graph-plus BottomPanel) */
.ggp{display:flex;flex-direction:column;height:100%;min-height:0;flex:1}
.ggp-graph{flex:1;min-height:0;display:flex}
.ggp-graph .gp-history__list{flex:1}
.ggp-resizer{flex:0 0 5px;cursor:row-resize;position:relative}
.ggp-resizer::before{content:'';position:absolute;left:0;right:0;top:2px;height:1px;background:var(--dsw-alias-border-l1)}
.ggp-bottom{flex:none;display:flex;flex-direction:column;min-height:0;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.ggp-bottom--full{flex:1;border-top:none}
.ggp-bottom__head{display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.ggp-segtrack{display:inline-grid;grid-auto-flow:column;gap:2px;padding:4px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover)}
.ggp-tab{height:28px;padding:0 12px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer}
.ggp-tab:hover{color:var(--dsw-alias-label-primary)}
.ggp-tab--active{background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-soft);color:var(--dsw-alias-label-primary)}
.ggp-bottom__spacer{flex:1}
.ggp-bottom__body{flex:1;overflow:auto;min-height:0;padding:10px 12px}
.ggp-commit{display:flex;flex-direction:column;gap:8px}
.ggp-commit__subject{font-weight:600;color:var(--dsw-alias-label-primary)}
.ggp-commit__meta{display:flex;gap:12px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.ggp-commit__refs{display:flex;flex-wrap:wrap;gap:4px}
.ggp-commit__parents{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px}
.ggp-commit__label{color:var(--dsw-alias-label-tertiary)}
.ggp-parentlink{cursor:pointer}
.ggp-parentlink:hover{text-decoration:underline}
.ggp-commit__body{margin:0;white-space:pre-wrap;font-size:12px;color:var(--dsw-alias-label-primary)}

/* git-graph-plus style rails: one overlay SVG above flat rows */
.ggp-list{position:relative}
.ggp-canvas{position:relative}
.ggp-lines{position:absolute;top:0;left:0;pointer-events:none;z-index:3}
.ggp-row{position:relative;z-index:1}
.ggp-row--head .ggp-subject{font-weight:600}
.ggp-row--dim .ggp-subject,.ggp-row--dim .gp-commit-author,.ggp-row--dim .gp-commit-hash,.ggp-row--dim .gp-commit-date{opacity:.55}
.ggp-msg{flex:1;min-width:0;display:flex;align-items:center;gap:5px;padding-right:10px;overflow:hidden}
.ggp-subject{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.ggp-localdot{width:5px;height:5px;border-radius:50%;flex:none;background:#4da6ff;opacity:.85}
.ggp-remotedot{width:5px;height:5px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary,#888);opacity:.85}
/* author cell: avatar + truncated name */
.gp-commit-author{display:flex;align-items:center;gap:6px;min-width:0}
.ggp-avatar{width:18px;height:18px;border-radius:50%;flex:none}
.ggp-commit__author{align-items:center}
.ggp-authorname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
/* ref badges with colored accent bar (git-graph-plus) */
.gp-ref-badge{position:relative;display:inline-flex;align-items:center;gap:3px;padding:1px 7px 1px calc(var(--badge-bar-width,4px) + 6px);border-radius:4px;font-size:11px;line-height:17px;white-space:nowrap;flex:none;overflow:hidden;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2)}
.gp-ref-badge::before{content:'';position:absolute;left:0;top:0;bottom:0;width:var(--badge-bar-width,4px);background:var(--badge-color)}
.gp-ref-badge--fixed{background:color-mix(in srgb,var(--badge-color) 20%,transparent)}
.gp-ref-badge--head{background:color-mix(in srgb,var(--badge-color) 55%,transparent);font-weight:600}

/* right-click context menu (official Menu metrics: 4px card, md radius, 34px rows) */
.gp-ctx-backdrop{position:fixed;inset:0;z-index:1099}
.gp-ctx{position:fixed;z-index:1100;min-width:220px;max-width:360px;box-sizing:border-box;padding:4px;border:0;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent)}
.gp-ctx__item{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;min-height:34px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;text-align:left;cursor:pointer}
.gp-ctx__item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.gp-ctx__item:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);outline:none}
.gp-ctx__item--danger{color:var(--dsw-alias-state-error-primary)}
.gp-ctx__item--danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.gp-modal__warn{font-size:13px;color:var(--dsw-alias-state-error-primary)}
.gp-modal__subject{font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`

let injected = false

/** Inject the plugin stylesheet once (idempotent, browser-only). */
export function ensureStyles(): void {
  if (injected || typeof document === 'undefined') return
  const id = 'dsh-git-plus/client.css'
  if (document.querySelector(`style[data-plugin-css="${id}"]`) !== null) { injected = true; return }
  const tag = document.createElement('style')
  // data-plugin 必须等于 loader row id（安装的包名），平台侧样式回收按它定位。
  tag.dataset.plugin = 'dsh-git-plus'
  tag.dataset.pluginCss = id
  tag.textContent = CSS
  document.head.appendChild(tag)
  injected = true
}
