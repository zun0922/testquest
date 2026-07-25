// AL解放判定（企画書§5.5：FL全章クリアで一斉解放）と選択画面の進捗・続きの章判定の単体テスト
import { describe, it, expect } from 'vitest'
import {
  chapterProgress,
  findContinueChapter,
  isAlUnlocked,
  levelProgress,
  LEVELS,
} from './levels'
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

// level/chapter を明示して組む（進捗・続きの章判定用）
function makeIndexAt(
  entries: Array<{ id: string; level: 'FL' | 'AL-TM' | 'AL-TTA'; chapter: number }>,
): ScenarioIndex {
  return {
    version: 1,
    scenarios: entries.map((e, i) => ({
      id: e.id,
      title: e.id,
      level: e.level,
      chapter: e.chapter,
      order: i + 1,
      estimatedMinutes: 10,
      file: `x/${e.id}.json`,
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

describe('進捗集計（折り畳んだ見出しの表示用）', () => {
  const index = makeIndexAt([
    { id: 'fl-1-01', level: 'FL', chapter: 1 },
    { id: 'fl-1-02', level: 'FL', chapter: 1 },
    { id: 'fl-2-01', level: 'FL', chapter: 2 },
    { id: 'al-tm-1-01', level: 'AL-TM', chapter: 1 },
  ])

  it('chapterProgress は当該レベル・章のみを数える', () => {
    expect(chapterProgress(index, makeSave(['fl-1-01']), 'FL', 1)).toEqual({ total: 2, cleared: 1 })
    expect(chapterProgress(index, makeSave(['fl-1-01']), 'FL', 2)).toEqual({ total: 1, cleared: 0 })
  })

  it('levelProgress はレベル全体を数える（他レベルは混ざらない）', () => {
    expect(levelProgress(index, makeSave(['fl-1-01', 'al-tm-1-01']), 'FL')).toEqual({
      total: 3,
      cleared: 1,
    })
    expect(levelProgress(index, makeSave(['al-tm-1-01']), 'AL-TM')).toEqual({
      total: 1,
      cleared: 1,
    })
  })

  it('シナリオが無い章は total=0（制作中の章）', () => {
    expect(chapterProgress(index, makeSave([]), 'FL', 6)).toEqual({ total: 0, cleared: 0 })
  })
})

describe('findContinueChapter（選択画面の初期展開先）', () => {
  const index = makeIndexAt([
    { id: 'fl-1-01', level: 'FL', chapter: 1 },
    { id: 'fl-2-01', level: 'FL', chapter: 2 },
    { id: 'al-tm-1-01', level: 'AL-TM', chapter: 1 },
  ])

  it('未プレイなら FL 第1章', () => {
    expect(findContinueChapter(index, makeSave([]), false)).toEqual({ level: 'FL', chapter: 1 })
  })

  it('第1章クリア済みなら次の未クリア章（FL 第2章）', () => {
    expect(findContinueChapter(index, makeSave(['fl-1-01']), false)).toEqual({
      level: 'FL',
      chapter: 2,
    })
  })

  it('FL 全クリア＋AL解放済みなら AL-TM 第1章（＝解放直後に AL が開く）', () => {
    expect(findContinueChapter(index, makeSave(['fl-1-01', 'fl-2-01']), true)).toEqual({
      level: 'AL-TM',
      chapter: 1,
    })
  })

  it('AL 未解放なら AL は対象外＝null（FL 全クリア時）', () => {
    expect(findContinueChapter(index, makeSave(['fl-1-01', 'fl-2-01']), false)).toBeNull()
  })

  it('解放済みレベルを含め全てクリアなら null', () => {
    expect(findContinueChapter(index, makeSave(['fl-1-01', 'fl-2-01', 'al-tm-1-01']), true)).toBeNull()
  })

  it('シナリオが無い章は飛ばす（制作中の章で止まらない）', () => {
    const sparse = makeIndexAt([{ id: 'fl-3-01', level: 'FL', chapter: 3 }])
    expect(findContinueChapter(sparse, makeSave([]), false)).toEqual({ level: 'FL', chapter: 3 })
  })
})
