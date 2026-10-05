import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { diffLineCount, isLargeDiff, LARGE_DIFF_BYTES, LARGE_DIFF_LINES } from '../../lib/testkit.mjs'

/** A unified diff with exactly `n` lines (trailing newline included). */
function diffOfLines(n) {
  const head = ['diff --git a/f.txt b/f.txt', '--- a/f.txt', '+++ b/f.txt', '@@ -1,1 +1,1 @@']
  const body = Array.from({ length: Math.max(0, n - head.length) }, (_, i) => `+line ${i}`)
  return [...head, ...body].join('\n') + '\n'
}

describe('isLargeDiff', () => {
  it('keeps ordinary diffs renderable', () => {
    assert.equal(isLargeDiff(''), false)
    assert.equal(isLargeDiff('diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+b\n'), false)
    assert.equal(isLargeDiff(diffOfLines(500)), false)
  })

  it('defers once the line budget is exceeded', () => {
    assert.equal(diffLineCount(diffOfLines(LARGE_DIFF_LINES)), LARGE_DIFF_LINES)
    assert.equal(isLargeDiff(diffOfLines(LARGE_DIFF_LINES)), false, 'exactly at the budget still renders')
    assert.equal(isLargeDiff(diffOfLines(LARGE_DIFF_LINES + 1)), true)
    assert.equal(isLargeDiff(diffOfLines(20000)), true)
  })

  it('defers a low-line-count but huge diff (minified bundle)', () => {
    const oneLine = 'diff --git a/b.js b/b.js\n@@ -1 +1 @@\n+' + 'x'.repeat(LARGE_DIFF_BYTES + 1) + '\n'
    assert.equal(diffLineCount(oneLine), 3, 'only a handful of lines')
    assert.equal(isLargeDiff(oneLine), true, 'byte budget still trips')
  })

  it('never defers binary or image markers', () => {
    assert.equal(isLargeDiff('diff --git a/i.png b/i.png\nBinary files a/i.png and b/i.png differ\n'), false)
    assert.equal(isLargeDiff('GIT binary patch\n' + 'z'.repeat(LARGE_DIFF_BYTES + 1)), false)
  })

  it('does not need a trailing newline to count the last line', () => {
    assert.equal(diffLineCount(''), 0)
    assert.equal(diffLineCount('a'), 1)
    assert.equal(diffLineCount('a\n'), 1)
    assert.equal(diffLineCount('a\nb'), 2)
    assert.equal(diffLineCount('a\nb\n'), 2)
  })
})
