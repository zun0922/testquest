// 設問を読む時間の間合い（PO実機フィードバック 2026-09-13）
import { describe, it, expect } from 'vitest'
import {
  CHOICE_REVEAL_MAX_MS,
  CHOICE_REVEAL_MIN_MS,
  CHOICE_REVEAL_PER_CHAR_MS,
  choiceRevealMs,
} from './pacing'

describe('choiceRevealMs', () => {
  it('設問が長いほど長く待つ', () => {
    expect(choiceRevealMs('あ'.repeat(20))).toBeLessThan(choiceRevealMs('あ'.repeat(60)))
  })

  it('短い設問でも下限を下回らない（本文→選択肢の順に目が動く間を置く）', () => {
    expect(choiceRevealMs('')).toBe(CHOICE_REVEAL_MIN_MS)
    expect(choiceRevealMs('どれ？')).toBeGreaterThanOrEqual(CHOICE_REVEAL_MIN_MS)
  })

  it('長い設問でも上限で頭打ち（待たされすぎない）', () => {
    expect(choiceRevealMs('あ'.repeat(196))).toBe(CHOICE_REVEAL_MAX_MS)
    expect(choiceRevealMs('あ'.repeat(1000))).toBe(CHOICE_REVEAL_MAX_MS)
  })

  it('実データの中央値（40字）で 1〜1.5 秒に収まる', () => {
    const d = choiceRevealMs('あ'.repeat(40))
    expect(d).toBeGreaterThanOrEqual(1000)
    expect(d).toBeLessThanOrEqual(1500)
  })

  it('計算式は 下限＋文字数×単価（上限でクランプ）', () => {
    expect(choiceRevealMs('あ'.repeat(10))).toBe(CHOICE_REVEAL_MIN_MS + 10 * CHOICE_REVEAL_PER_CHAR_MS)
  })

  it('未定義でも例外を出さない', () => {
    expect(choiceRevealMs(undefined as unknown as string)).toBe(CHOICE_REVEAL_MIN_MS)
  })
})
