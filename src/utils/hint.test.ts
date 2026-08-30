// FR-P2-007 ヒント：レベル別閾値・強調対象の決定・強調分割の単体テスト。
// 閾値は要件仕様 v0.2 §3.3 の実測に基づく値（FL 60/150・AL 170/300）。
import { describe, it, expect } from 'vitest'
import type { Choice, StatusValues } from '../types'
import {
  HINT_THRESHOLDS,
  emphasizedIndices,
  hasEmphasisData,
  hasHintData,
  hintLevel,
  splitByEmphasis,
  thresholdsFor,
  totalPoints,
} from './hint'

/** 合計が total になるステータスを作る（4等分＋端数を knowledge へ）。 */
function statusOf(total: number): StatusValues {
  const base = Math.floor(total / 4)
  return { knowledge: base + (total - base * 4), skill: base, confidence: base, teamwork: base }
}

function choice(rating: Choice['rating'], text: string, emphasis?: string[]): Choice {
  return { text, rating, emphasis, statusEffects: { knowledge: 1 }, feedback: { explanation: 'x', syllabusRefs: ['1.1'] }, next: 'n' }
}

describe('totalPoints', () => {
  it('4種の合計を返す（初期状態は 40）', () => {
    expect(totalPoints({ knowledge: 10, skill: 10, confidence: 10, teamwork: 10 })).toBe(40)
    expect(totalPoints({ knowledge: 100, skill: 100, confidence: 100, teamwork: 100 })).toBe(400)
  })
})

describe('thresholdsFor', () => {
  it('AL-TM と AL-TTA は同じ閾値（FL 全クリアで同時解放されプレイ順が自由なため）', () => {
    expect(thresholdsFor('AL-TM')).toEqual(HINT_THRESHOLDS.AL)
    expect(thresholdsFor('AL-TTA')).toEqual(HINT_THRESHOLDS.AL)
  })

  it('FL は AL より低い閾値（上級ほど自力で考えさせる）', () => {
    expect(thresholdsFor('FL').lv1).toBeLessThan(thresholdsFor('AL-TM').lv1)
    expect(thresholdsFor('FL').lv2).toBeLessThan(thresholdsFor('AL-TM').lv2)
  })
})

describe('hintLevel', () => {
  it('FL：60未満は Lv0・60以上で Lv1・150以上で Lv2', () => {
    expect(hintLevel(statusOf(59), 'FL')).toBe(0)
    expect(hintLevel(statusOf(60), 'FL')).toBe(1)
    expect(hintLevel(statusOf(149), 'FL')).toBe(1)
    expect(hintLevel(statusOf(150), 'FL')).toBe(2)
  })

  it('AL：170未満は Lv0・170以上で Lv1・300以上で Lv2', () => {
    expect(hintLevel(statusOf(169), 'AL-TM')).toBe(0)
    expect(hintLevel(statusOf(170), 'AL-TM')).toBe(1)
    expect(hintLevel(statusOf(299), 'AL-TTA')).toBe(1)
    expect(hintLevel(statusOf(300), 'AL-TTA')).toBe(2)
  })

  it('同じポイントでも AL では Lv が下がる（レベル別閾値の要点）', () => {
    const st = statusOf(160)
    expect(hintLevel(st, 'FL')).toBe(2)
    expect(hintLevel(st, 'AL-TM')).toBe(0)
  })

  it('実測値との整合：FL編終了時の中位プレイ(232)は AL で Lv1、全問best(366)は Lv2', () => {
    expect(hintLevel(statusOf(232), 'AL-TM')).toBe(1)
    expect(hintLevel(statusOf(366), 'AL-TM')).toBe(2)
    // 全問 poor は FL編終了時130 → AL では使えない
    expect(hintLevel(statusOf(130), 'AL-TM')).toBe(0)
  })
})

describe('hasHintData', () => {
  it('ヒント文か強調データのどちらかがあれば出せる（段階導入で片方だけでも動く）', () => {
    expect(hasHintData(undefined, [choice('best', 'あ')])).toBe(false)
    expect(hasHintData('考えてみましょう', [choice('best', 'あ')])).toBe(true)
    expect(hasHintData(undefined, [choice('best', 'いろは', ['ろ'])])).toBe(true)
  })
})

describe('hasEmphasisData', () => {
  it('強調データが1つも無ければ false（ヒントを出せない）', () => {
    expect(hasEmphasisData([choice('best', 'あ'), choice('poor', 'い')])).toBe(false)
    expect(hasEmphasisData([choice('best', 'あ'), choice('poor', 'いろは', ['ろ'])])).toBe(true)
  })

  it('空配列はデータ無しとして扱う', () => {
    expect(hasEmphasisData([choice('best', 'あ', [])])).toBe(false)
  })
})

describe('emphasizedIndices', () => {
  const choices = [
    choice('good', '動的に実行して欠陥を探すこと', ['動的に実行']),
    choice('best', '欠陥を見つけ品質を評価する一連の活動', ['一連の活動']),
    choice('poor', '仕様どおりにプログラムを作ること', ['プログラムを作る']),
  ]

  it('Lv0 では何も強調しない', () => {
    expect(emphasizedIndices(choices, 0).size).toBe(0)
  })

  it('Lv1 では強調しない（ヒント文だけを出す段階）', () => {
    expect(emphasizedIndices(choices, 1).size).toBe(0)
  })

  it('Lv2 では強調データを持つ全選択肢', () => {
    expect([...emphasizedIndices(choices, 2)].sort()).toEqual([0, 1, 2])
  })

  it('データが無い選択肢は対象外（段階導入で混在しても壊れない）', () => {
    const mixed = [choice('best', 'あ'), choice('poor', 'いろは', ['ろ'])]
    expect([...emphasizedIndices(mixed, 2)]).toEqual([1])
  })
})

describe('splitByEmphasis', () => {
  it('指定語で分割し、該当断片に hit を立てる', () => {
    expect(splitByEmphasis('動的に実行して欠陥を探すこと', ['動的に実行'])).toEqual([
      { text: '動的に実行', hit: true },
      { text: 'して欠陥を探すこと', hit: false },
    ])
  })

  it('語が複数でも出現順に分割する', () => {
    expect(splitByEmphasis('検証に加え、ニーズを満たすかも確認する', ['検証', 'ニーズを満たす'])).toEqual([
      { text: '検証', hit: true },
      { text: 'に加え、', hit: false },
      { text: 'ニーズを満たす', hit: true },
      { text: 'かも確認する', hit: false },
    ])
  })

  it('末尾で終わる語でも余計な空断片を作らない', () => {
    expect(splitByEmphasis('要件を1つ残らず検証', ['検証'])).toEqual([
      { text: '要件を1つ残らず', hit: false },
      { text: '検証', hit: true },
    ])
  })

  it('未指定・空配列・本文に無い語なら分割せずそのまま返す（表示を壊さない）', () => {
    expect(splitByEmphasis('あいう', undefined)).toEqual([{ text: 'あいう', hit: false }])
    expect(splitByEmphasis('あいう', [])).toEqual([{ text: 'あいう', hit: false }])
    expect(splitByEmphasis('あいう', ['えお'])).toEqual([{ text: 'あいう', hit: false }])
  })
})
