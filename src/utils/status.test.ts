import { describe, it, expect } from 'vitest'
import { applyStatusEffects, clamp, createInitialStatus } from './status'
import { INITIAL_STATUS } from '../types'

describe('status.ts（FR-006 加算・クランプ）', () => {
  it('FT-006-001-TC-001 相当：単一キー加算（knowledge 10+3=13・他は不変）', () => {
    const next = applyStatusEffects(INITIAL_STATUS, { knowledge: 3 })
    expect(next.knowledge).toBe(13)
    expect(next.skill).toBe(10)
    expect(next.confidence).toBe(10)
    expect(next.teamwork).toBe(10)
  })

  it('FT-006-001-TC-002 相当：複数キー同時加算（knowledge+3・skill+2）', () => {
    const next = applyStatusEffects(INITIAL_STATUS, { knowledge: 3, skill: 2 })
    expect(next.knowledge).toBe(13)
    expect(next.skill).toBe(12)
    expect(next.confidence).toBe(10)
    expect(next.teamwork).toBe(10)
  })

  it('FT-006-001-TC-003：複数選択の累積（10→13→16）', () => {
    let s = createInitialStatus()
    s = applyStatusEffects(s, { knowledge: 3 })
    s = applyStatusEffects(s, { knowledge: 3 })
    expect(s.knowledge).toBe(16)
  })

  it('FT-006-001-TC-004：初期値は全キー10', () => {
    const s = createInitialStatus()
    expect(s).toEqual({ knowledge: 10, skill: 10, confidence: 10, teamwork: 10 })
  })

  it('加算は非破壊（元のオブジェクトを変更しない）', () => {
    const original = createInitialStatus()
    applyStatusEffects(original, { knowledge: 5 })
    expect(original.knowledge).toBe(10)
  })

  it('FT-006-002-TC-001：上限クランプ（98+5=100・103にならない）', () => {
    const next = applyStatusEffects({ knowledge: 98, skill: 10, confidence: 10, teamwork: 10 }, { knowledge: 5 })
    expect(next.knowledge).toBe(100)
  })

  it('FT-006-002-TC-002：境界ちょうど（97+3=100）', () => {
    const next = applyStatusEffects({ knowledge: 97, skill: 10, confidence: 10, teamwork: 10 }, { knowledge: 3 })
    expect(next.knowledge).toBe(100)
  })

  it('FT-006-002-TC-003：上限到達後の加算（100+3=100・冪等）', () => {
    const next = applyStatusEffects({ knowledge: 100, skill: 10, confidence: 10, teamwork: 10 }, { knowledge: 3 })
    expect(next.knowledge).toBe(100)
  })

  it('clamp：0〜100 の範囲に収める', () => {
    expect(clamp(-5)).toBe(0)
    expect(clamp(0)).toBe(0)
    expect(clamp(50)).toBe(50)
    expect(clamp(100)).toBe(100)
    expect(clamp(150)).toBe(100)
  })
})
