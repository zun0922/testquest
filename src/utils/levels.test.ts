// AL解放判定（企画書§5.5：FL全章クリアで一斉解放）の単体テスト
import { describe, it, expect } from 'vitest'
import { isAlUnlocked, LEVELS } from './levels'
import type { ScenarioIndex, SaveDataV1 } from '../types'

function makeIndex(ids: string[]): ScenarioIndex {
  return {
    version: 1,
    scenarios: ids.map((id, i) => ({
      id,
      title: id,
      level: id.startsWith('al-tm') ? ('AL-TM' as const) : ('FL' as const),
      chapter: 1,
      order: i + 1,
      estimatedMinutes: 10,
      file: `x/${id}.json`,
    })),
  }
}

function makeSave(clearedIds: string[]): SaveDataV1 {
  const cleared: SaveDataV1['cleared'] = {}
  for (const id of clearedIds) {
    cleared[id] = { clearedAt: '2026-07-03T00:00:00Z', ratings: { best: 1, good: 0, poor: 0 }, statusGain: {} }
  }
  return { version: 1, status: { knowledge: 10, skill: 10, confidence: 10, teamwork: 10 }, cleared }
}

describe('isAlUnlocked（AC: FL全章クリアでAL解放）', () => {
  it('FLシナリオが全てクリア済みなら true', () => {
    const index = makeIndex(['fl-1-01', 'fl-1-02'])
    expect(isAlUnlocked(index, makeSave(['fl-1-01', 'fl-1-02']))).toBe(true)
  })

  it('FLに未クリアが1本でもあれば false', () => {
    const index = makeIndex(['fl-1-01', 'fl-1-02'])
    expect(isAlUnlocked(index, makeSave(['fl-1-01']))).toBe(false)
  })

  it('セーブが空なら false', () => {
    const index = makeIndex(['fl-1-01'])
    expect(isAlUnlocked(index, makeSave([]))).toBe(false)
  })

  it('ALシナリオのクリア状況は判定に影響しない（FLのみを見る）', () => {
    const index = makeIndex(['fl-1-01', 'al-tm-1-01'])
    expect(isAlUnlocked(index, makeSave(['al-tm-1-01']))).toBe(false)
    expect(isAlUnlocked(index, makeSave(['fl-1-01']))).toBe(true)
  })

  it('FLシナリオが index に無い場合は false（誤解放の防止）', () => {
    const index = makeIndex([])
    expect(isAlUnlocked(index, makeSave([]))).toBe(false)
  })
})

describe('LEVELS 定義', () => {
  it('FL=6章・AL-TM=3章・AL-TTA=6章（企画書§5.2.1/5.3.1）', () => {
    expect(LEVELS.find((l) => l.key === 'FL')?.chapters).toHaveLength(6)
    expect(LEVELS.find((l) => l.key === 'AL-TM')?.chapters).toHaveLength(3)
    expect(LEVELS.find((l) => l.key === 'AL-TTA')?.chapters).toHaveLength(6)
  })
})
