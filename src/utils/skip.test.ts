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

  it('実データの中央値（40字）で 0.25〜0.35 秒に収まる', () => {
    // 全569ノードの実測：最短12字・中央値40字・最長196字（2026-09-13）
    const d = skipDelayMs('あ'.repeat(40))
    expect(d).toBeGreaterThanOrEqual(250)
    expect(d).toBeLessThanOrEqual(350)
  })

  it('旧実装の一律90msよりは遅い（内容を追えるように）', () => {
    expect(skipDelayMs('あ'.repeat(12))).toBeGreaterThan(90)
  })

  it('人が連打する速さ（約200〜330ms）より速い＝早送りとして意味がある', () => {
    // 2回目の調整（260ms＋8ms/字）は中央値で580msとなり、連打より遅く「実感がない」とPO判定された
    expect(skipDelayMs('あ'.repeat(40))).toBeLessThan(330)
    expect(skipDelayMs('あ'.repeat(196))).toBeLessThanOrEqual(500)
  })

  it('計算式は 下限＋文字数×単価（上限でクランプ）', () => {
    expect(skipDelayMs('あ'.repeat(10))).toBe(SKIP_MIN_MS + 10 * SKIP_PER_CHAR_MS)
  })

  it('未定義でも例外を出さない', () => {
    expect(skipDelayMs(undefined as unknown as string)).toBe(SKIP_MIN_MS)
  })
})
