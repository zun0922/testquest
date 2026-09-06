// FR-P2-002 エンディング判定の単体テスト。
// 判定の肝は「poor で得た分を算入しない」こと（要件仕様 §2.1）。
import { describe, it, expect } from 'vitest'
import type { ClearRecord, SaveDataV1, ScenarioIndex, StatusKey } from '../types'
import {
  BALANCE_GAP,
  FL_THEORETICAL_MAX,
  achievementRates,
  isLevelCleared,
  judgeFlEnding,
  newlyReached,
  reachedEndings,
} from './ending'

function rec(cleanGain?: Partial<Record<StatusKey, number>>): ClearRecord {
  return {
    clearedAt: '2026-08-30T00:00:00.000Z',
    ratings: { best: 1, good: 0, poor: 0 },
    statusGain: { knowledge: 1 },
    ...(cleanGain ? { cleanGain } : {}),
  }
}

function saveOf(cleared: Record<string, ClearRecord>, endings?: Record<string, string>): SaveDataV1 {
  return {
    version: 1,
    status: { knowledge: 10, skill: 10, confidence: 10, teamwork: 10 },
    cleared,
    ...(endings ? { endings } : {}),
  }
}

/** 指定した達成率になる cleanGain を1件だけ持つセーブを作る。 */
function saveWithRates(rates: Partial<Record<StatusKey, number>>): SaveDataV1 {
  const gain: Partial<Record<StatusKey, number>> = {}
  for (const [k, pct] of Object.entries(rates)) {
    gain[k as StatusKey] = Math.round((FL_THEORETICAL_MAX[k as StatusKey] * (pct ?? 0)) / 100)
  }
  return saveOf({ 'fl-1-01': rec(gain) })
}

const INDEX: ScenarioIndex = {
  version: 1,
  scenarios: [
    { id: 'fl-a', title: 'a', level: 'FL', chapter: 1, order: 1, estimatedMinutes: 5, file: 'fl-1/a.json' },
    { id: 'fl-b', title: 'b', level: 'FL', chapter: 1, order: 2, estimatedMinutes: 5, file: 'fl-1/b.json' },
    { id: 'tm-a', title: 'c', level: 'AL-TM', chapter: 1, order: 1, estimatedMinutes: 5, file: 'al-tm-1/a.json' },
    { id: 'tta-a', title: 'd', level: 'AL-TTA', chapter: 1, order: 1, estimatedMinutes: 5, file: 'al-tta-1/a.json' },
  ],
}

describe('achievementRates', () => {
  it('cleanGain の合計を理論最大で割った達成率を返す', () => {
    const save = saveOf({ x: rec({ knowledge: 101, skill: 67 }) }) // 202の半分・134の半分
    const r = achievementRates(save, 'FL')
    expect(Math.round(r.knowledge)).toBe(50)
    expect(Math.round(r.skill)).toBe(50)
    expect(r.teamwork).toBe(0)
  })

  it('cleanGain が無い章は判定から除外する（PO決定 2026-08-30）', () => {
    const withOut = saveOf({ old: rec(), new1: rec({ knowledge: 101 }) })
    const onlyNew = saveOf({ new1: rec({ knowledge: 101 }) })
    expect(achievementRates(withOut, 'FL')).toEqual(achievementRates(onlyNew, 'FL'))
  })

  it('記録が1件も無ければすべて0', () => {
    const r = achievementRates(saveOf({}), 'FL')
    expect(Object.values(r).every((v) => v === 0)).toBe(true)
  })
})

describe('judgeFlEnding', () => {
  it('3ステータスが近ければ隠しEND（差が閾値未満）', () => {
    expect(judgeFlEnding(saveWithRates({ knowledge: 90, skill: 90, teamwork: 90 }))).toBe('fl-balanced')
    expect(judgeFlEnding(saveWithRates({ knowledge: 50, skill: 50, teamwork: 50 }))).toBe('fl-balanced')
  })

  it('突出したステータスがあればそのエンディング', () => {
    expect(judgeFlEnding(saveWithRates({ knowledge: 80, skill: 40, teamwork: 30 }))).toBe('fl-knowledge')
    expect(judgeFlEnding(saveWithRates({ knowledge: 40, skill: 80, teamwork: 30 }))).toBe('fl-skill')
    expect(judgeFlEnding(saveWithRates({ knowledge: 30, skill: 40, teamwork: 80 }))).toBe('fl-teamwork')
  })

  it('自信は判定に使わない（対応するエンディングが無いため）', () => {
    const a = judgeFlEnding(saveWithRates({ knowledge: 80, skill: 40, teamwork: 30 }))
    const b = judgeFlEnding(saveWithRates({ knowledge: 80, skill: 40, teamwork: 30, confidence: 100 }))
    expect(a).toBe(b)
  })

  it('閾値ちょうどの差は隠しENDにしない（境界）', () => {
    // 差が BALANCE_GAP 未満のときだけバランス型
    const under = saveWithRates({ knowledge: 50 + BALANCE_GAP - 1, skill: 50, teamwork: 50 })
    const over = saveWithRates({ knowledge: 50 + BALANCE_GAP + 1, skill: 50, teamwork: 50 })
    expect(judgeFlEnding(under)).toBe('fl-balanced')
    expect(judgeFlEnding(over)).toBe('fl-knowledge')
  })

  it('同点は決定的に解決する（同じ入力なら常に同じ結果）', () => {
    const save = saveWithRates({ knowledge: 80, skill: 80, teamwork: 20 })
    expect(judgeFlEnding(save)).toBe(judgeFlEnding(save))
  })
})

describe('isLevelCleared', () => {
  it('そのレベルを全部クリアしていれば true', () => {
    expect(isLevelCleared(INDEX, saveOf({ 'fl-a': rec() }), 'FL')).toBe(false)
    expect(isLevelCleared(INDEX, saveOf({ 'fl-a': rec(), 'fl-b': rec() }), 'FL')).toBe(true)
  })
})

describe('reachedEndings / newlyReached', () => {
  const flDone = { 'fl-a': rec({ knowledge: 200 }), 'fl-b': rec() }

  it('FL全クリアでFL編のエンディングに到達する', () => {
    expect(reachedEndings(INDEX, saveOf(flDone))).toEqual(['fl-knowledge'])
  })

  it('AL-TM / AL-TTA はそれぞれ全クリアで到達する', () => {
    expect(reachedEndings(INDEX, saveOf({ 'tm-a': rec() }))).toEqual(['al-tm'])
    expect(reachedEndings(INDEX, saveOf({ 'tta-a': rec() }))).toEqual(['al-tta'])
  })

  it('両ルート制覇で最終エンディングが解放される', () => {
    const all = reachedEndings(INDEX, saveOf({ 'tm-a': rec(), 'tta-a': rec() }))
    expect(all).toContain('grand')
    expect(all).toEqual(['al-tm', 'al-tta', 'grand'])
  })

  it('記録済みのエンディングは newlyReached に含まれない', () => {
    const save = saveOf(flDone, { 'fl-knowledge': '2026-08-30T00:00:00.000Z' })
    expect(newlyReached(INDEX, save)).toEqual([])
  })

  it('未クリアなら何も到達しない', () => {
    expect(reachedEndings(INDEX, saveOf({}))).toEqual([])
  })
})
