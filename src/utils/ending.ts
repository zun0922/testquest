// FR-P2-002 エンディング判定。要件仕様 v0.2。
//
// 判定の要点：**poor で得た成長は算入しない**（ClearRecord.cleanGain）。
// poor 選択肢の加算の89%が知識に集中しているため、これを分けないと
// どんなプレイでも知識が突出し、エンディングが分岐しない（要件仕様 §1.3）。
import { type SaveDataV1, type StatusKey, type ScenarioIndex, type EndingDef, type EndingsData } from '../types'

export type EndingId =
  | 'fl-knowledge'
  | 'fl-skill'
  | 'fl-teamwork'
  | 'fl-balanced'
  | 'al-tm'
  | 'al-tta'
  | 'grand'

/** エンディング判定に使うステータス（自信は対応するエンディングが無いため除く）。 */
export const JUDGE_KEYS: StatusKey[] = ['knowledge', 'skill', 'teamwork']

/**
 * FL編で best/good から得られる理論最大値。
 * シナリオデータから機械的に導ける値で、門番テスト（ending.data.test.ts）が
 * 実データと一致することを検証する＝データを改訂したら CI で落ちる。
 */
export const FL_THEORETICAL_MAX: Record<StatusKey, number> = {
  knowledge: 202,
  skill: 134,
  confidence: 108,
  teamwork: 56,
}

/** バランス型（隠しEND）と判定する達成率の幅。要件仕様 §2.3 の実測で決めた値。 */
export const BALANCE_GAP = 8

/** 各ステータスの達成率（0〜100）。cleanGain が無い章は判定から除外される。 */
export function achievementRates(save: SaveDataV1, level: 'FL'): Record<StatusKey, number> {
  const sum: Record<string, number> = {}
  for (const rec of Object.values(save.cleared)) {
    if (!rec.cleanGain) continue // 記録が無い章は除外（PO決定 2026-08-30）
    for (const [k, v] of Object.entries(rec.cleanGain)) {
      sum[k] = (sum[k] ?? 0) + (v ?? 0)
    }
  }
  const max = level === 'FL' ? FL_THEORETICAL_MAX : FL_THEORETICAL_MAX
  const out = {} as Record<StatusKey, number>
  for (const k of Object.keys(max) as StatusKey[]) {
    out[k] = max[k] > 0 ? ((sum[k] ?? 0) / max[k]) * 100 : 0
  }
  return out
}

/** FL編のエンディングを判定する（達成率の分布で分岐）。 */
export function judgeFlEnding(save: SaveDataV1): EndingId {
  const r = achievementRates(save, 'FL')
  const vals = JUDGE_KEYS.map((k) => r[k])
  if (Math.max(...vals) - Math.min(...vals) < BALANCE_GAP) return 'fl-balanced'
  // 同点は JUDGE_KEYS の順で決定的に選ぶ（再現性のため）
  let top: StatusKey = JUDGE_KEYS[0]
  for (const k of JUDGE_KEYS) {
    if (r[k] > r[top]) top = k
  }
  return top === 'skill' ? 'fl-skill' : top === 'teamwork' ? 'fl-teamwork' : 'fl-knowledge'
}

/** そのレベルのシナリオをすべてクリアしているか。 */
export function isLevelCleared(index: ScenarioIndex, save: SaveDataV1, level: string): boolean {
  const list = index.scenarios.filter((s) => s.level === level)
  return list.length > 0 && list.every((s) => Boolean(save.cleared[s.id]))
}

/**
 * 現在の進捗で到達しているエンディングをすべて返す（定義順）。
 * 結果画面でクリアを保存した直後に呼び、まだ記録されていないものを新規到達として扱う。
 */
export function reachedEndings(index: ScenarioIndex, save: SaveDataV1): EndingId[] {
  const out: EndingId[] = []
  if (isLevelCleared(index, save, 'FL')) out.push(judgeFlEnding(save))
  const tm = isLevelCleared(index, save, 'AL-TM')
  const tta = isLevelCleared(index, save, 'AL-TTA')
  if (tm) out.push('al-tm')
  if (tta) out.push('al-tta')
  if (tm && tta) out.push('grand') // 両ルート制覇で解放（企画書 §7.2）
  return out
}

/** まだ記録されていない到達エンディング（今回新たに到達したもの）。 */
export function newlyReached(index: ScenarioIndex, save: SaveDataV1): EndingId[] {
  const known = save.endings ?? {}
  return reachedEndings(index, save).filter((id) => !known[id])
}

// ===== データの読み込み =====
// 判定（上）とデータ（ここ）を同じファイルに置く。エンディングは7種と少なく、
// シナリオのように大量ではないため 1 ファイルにまとめて 1 回だけ読む。

const ENDINGS_PATH = '/data/endings.json'

function isEndingsData(v: unknown): v is EndingsData {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (o.version !== 1 || !Array.isArray(o.endings)) return false
  return o.endings.every((e) => {
    if (typeof e !== 'object' || e === null) return false
    const d = e as Record<string, unknown>
    return (
      typeof d.id === 'string' &&
      typeof d.name === 'string' &&
      typeof d.subtitle === 'string' &&
      typeof d.background === 'string' &&
      Array.isArray(d.lines) &&
      d.lines.length > 0
    )
  })
}

let endingsPromise: Promise<EndingDef[]> | null = null

/** エンディング定義を読み込む（アプリで1回だけ）。失敗時は空配列＝機能を出さない。 */
export function ensureEndings(fetchFn: typeof fetch = fetch): Promise<EndingDef[]> {
  endingsPromise ??= (async () => {
    try {
      const res = await fetchFn(ENDINGS_PATH)
      if (!res.ok) return []
      const data: unknown = await res.json()
      return isEndingsData(data) ? data.endings : []
    } catch {
      return []
    }
  })()
  return endingsPromise
}

/** テスト用：キャッシュを破棄する。 */
export function resetEndingsCache(): void {
  endingsPromise = null
}
