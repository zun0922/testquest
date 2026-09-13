// FR-P2-005 スキップの送り速度。
// 実機で「速すぎる」とPO判定された（ST-M2-005-TC-001）ため、本文の長さで変える方式にした。
import { describe, it, expect } from 'vitest'
import { SKIP_MAX_MS, SKIP_MIN_MS, SKIP_PER_CHAR_MS, skipDelayMs } from './skip'

describe('skipDelayMs', () => {
  it('本文が長いほど長く留まる', () => {
    expect(skipDelayMs('あ'.repeat(20))).toBeLessThan(skipDelayMs('あ'.repeat(60)))
  })

  it('短い行でも下限を下回らない（一瞬は見える）', () => {
    expect(skipDelayMs('')).toBe(SKIP_MIN_MS)
    expect(skipDelayMs('はい')).toBeGreaterThanOrEqual(SKIP_MIN_MS)
  })

  it('長い行でも上限を超えない（待たされすぎない）', () => {
    expect(skipDelayMs('あ'.repeat(196))).toBe(SKIP_MAX_MS)
    expect(skipDelayMs('あ'.repeat(1000))).toBe(SKIP_MAX_MS)
  })

  it('実データの中央値（40字）で 0.5〜0.7 秒に収まる', () => {
    // 全569ノードの実測：最短12字・中央値40字・最長196字（2026-09-13）
    const d = skipDelayMs('あ'.repeat(40))
    expect(d).toBeGreaterThanOrEqual(500)
    expect(d).toBeLessThanOrEqual(700)
  })

  it('修正前の一律90msより明確に遅い（今回の是正が効いている）', () => {
    expect(skipDelayMs('あ'.repeat(12))).toBeGreaterThan(90 * 3)
  })

  it('計算式は 下限＋文字数×単価（上限でクランプ）', () => {
    expect(skipDelayMs('あ'.repeat(10))).toBe(SKIP_MIN_MS + 10 * SKIP_PER_CHAR_MS)
  })

  it('未定義でも例外を出さない', () => {
    expect(skipDelayMs(undefined as unknown as string)).toBe(SKIP_MIN_MS)
  })
})
