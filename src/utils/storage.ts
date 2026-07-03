// FR-008 進捗保存（localStorage）。設計書 v1.1 §5.8。
// キー名は AC-006 の内部値検証で参照されるため固定。
import { type SaveDataV1, type StatusValues, STATUS_KEYS } from '../types'

export const SAVE_KEY = 'testquest:save'

/** localStorage が利用可能か（プライベートブラウズ等で不可のことがある）。 */
export function isAvailable(): boolean {
  try {
    const probe = '__testquest_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function isStatusValues(v: unknown): v is StatusValues {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return STATUS_KEYS.every((k) => typeof obj[k] === 'number')
}

/** 保存データが SaveDataV1 形式か（version・status・cleared）を検証する型ガード。 */
export function isSaveDataV1(v: unknown): v is SaveDataV1 {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (obj.version !== 1) return false
  if (!isStatusValues(obj.status)) return false
  if (typeof obj.cleared !== 'object' || obj.cleared === null || Array.isArray(obj.cleared)) return false
  return true
}

/**
 * 保存データを読み込む。存在しない・不正（version不一致・型不正）なら null を返す。
 * 不正時は console.error を出すがセーブは消さない（設計書§5.1）。
 */
export function load(): SaveDataV1 | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(SAVE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isSaveDataV1(parsed)) {
      console.error('[storage] 保存データが不正な形式です（読み込めません）')
      return null
    }
    return parsed
  } catch {
    console.error('[storage] 保存データの JSON 解析に失敗しました')
    return null
  }
}

/** 保存する。例外（QuotaExceeded 等）は呼び出し側に throw する（設計書§5.7）。 */
export function save(data: SaveDataV1): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data))
}

/** 保存データを削除する。 */
export function clear(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // 利用不可環境では何もしない
  }
}
