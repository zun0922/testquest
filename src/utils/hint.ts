// FR-P2-007 ポイントに応じたヒント。
// 蓄積したステータス4種の「合計」でヒントの強さが決まる（要件仕様 v0.2 §3）。
// 閾値はプレイ中のシナリオのレベル別。FL は低く、AL は高い＝上級ほど自力で考えさせる。
import { type Choice, type StatusValues, STATUS_KEYS } from '../types'
import { type LevelKey } from './levels'

/**
 * 0=使用不可／1=ヒント文のみ／2=ヒント文＋選択肢の強調。
 * テキストが主役で、強調は「ヒント文で示した論点が選択肢のどこにあるか」を可視化する補助。
 * （PO確認 2026-08-30「強調表示だけではヒントとして微妙。テキストの方が親切」を受けた構成）
 */
export type HintLevel = 0 | 1 | 2

/**
 * レベル別の閾値（要件仕様 v0.2 §3.3）。
 * 実測（開始40・全問bestで50本目に上限400・全問poorで71本終了時183）に基づく。
 * AL-TM と AL-TTA は FL 全クリアで同時に解放されプレイ順が自由なため、同じ値にする。
 */
export const HINT_THRESHOLDS: Record<'FL' | 'AL', { lv1: number; lv2: number }> = {
  FL: { lv1: 60, lv2: 150 },
  AL: { lv1: 170, lv2: 300 },
}

/** ステータス4種の合計（40〜400）。 */
export function totalPoints(status: StatusValues): number {
  return STATUS_KEYS.reduce((sum, k) => sum + status[k], 0)
}

/** プレイ中のシナリオのレベルに対応する閾値を返す。 */
export function thresholdsFor(level: LevelKey): { lv1: number; lv2: number } {
  return level === 'FL' ? HINT_THRESHOLDS.FL : HINT_THRESHOLDS.AL
}

/** 現在のヒントレベル。 */
export function hintLevel(status: StatusValues, level: LevelKey): HintLevel {
  const total = totalPoints(status)
  const t = thresholdsFor(level)
  if (total >= t.lv2) return 2
  if (total >= t.lv1) return 1
  return 0
}

/** 強調データを持つ選択肢が1つ以上あるか。 */
export function hasEmphasisData(choices: Choice[]): boolean {
  return choices.some((c) => (c.emphasis?.length ?? 0) > 0)
}

/**
 * その問題でヒントを出せるか。
 * ヒント文（node.hint）か強調データのどちらかがあれば出せる（段階導入で片方だけでも動く）。
 */
export function hasHintData(hint: string | undefined, choices: Choice[]): boolean {
  return Boolean(hint) || hasEmphasisData(choices)
}

/**
 * 強調する選択肢のインデックス集合。**強調は Lv2 のみ**（Lv1 はヒント文だけを出す）。
 * 特定の選択肢だけを光らせて正解が割れることのないよう、Lv2 では対象を絞らず全件を強調する。
 */
export function emphasizedIndices(choices: Choice[], level: HintLevel): Set<number> {
  if (level < 2) return new Set()
  const withData = choices
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => (c.emphasis?.length ?? 0) > 0)
  return new Set(withData.map(({ i }) => i))
}

/** 強調表示のための分割結果。`hit` が true の断片を強調する。 */
export interface Segment {
  text: string
  hit: boolean
}

/**
 * `text` を `emphasis` の語で分割する。指定語が見つからない場合はそのまま1断片で返す
 * （データ不整合でも表示は壊さない。整合は validator と門番テストで担保する）。
 */
export function splitByEmphasis(text: string, words: string[] | undefined): Segment[] {
  const targets = (words ?? []).filter((w) => w.length > 0 && text.includes(w))
  if (targets.length === 0) return [{ text, hit: false }]

  const segments: Segment[] = []
  let rest = text
  // 出現位置の早い語から順に切り出す（語同士は重ならない前提＝validator で検証）
  while (rest.length > 0) {
    let bestAt = -1
    let bestWord = ''
    for (const w of targets) {
      const at = rest.indexOf(w)
      if (at >= 0 && (bestAt === -1 || at < bestAt)) {
        bestAt = at
        bestWord = w
      }
    }
    if (bestAt === -1) {
      segments.push({ text: rest, hit: false })
      break
    }
    if (bestAt > 0) segments.push({ text: rest.slice(0, bestAt), hit: false })
    segments.push({ text: bestWord, hit: true })
    rest = rest.slice(bestAt + bestWord.length)
  }
  return segments
}
