// FR-006 ステータスシステム：加算・100クランプ・複数キー同時加算
// 減算は存在しない（設計上の決定）。値は常に 0〜100 にクランプされる。
import {
  type StatusKey,
  type StatusValues,
  STATUS_MIN,
  STATUS_MAX,
  INITIAL_STATUS,
} from '../types'

/** 値を 0〜100 にクランプする（整数前提）。 */
export function clamp(value: number): number {
  if (value < STATUS_MIN) return STATUS_MIN
  if (value > STATUS_MAX) return STATUS_MAX
  return value
}

/**
 * statusEffects を現在のステータスに加算し、クランプした新しい StatusValues を返す（非破壊）。
 * 複数キー同時加算に対応。上限到達後の加算は 100 のまま（クランプの冪等性）。
 */
export function applyStatusEffects(
  current: StatusValues,
  effects: Partial<Record<StatusKey, number>>,
): StatusValues {
  const next: StatusValues = { ...current }
  for (const key of Object.keys(effects) as StatusKey[]) {
    const delta = effects[key]
    if (delta === undefined) continue
    next[key] = clamp(next[key] + delta)
  }
  return next
}

/** 新規開始時の初期ステータス（全キー 10）を返す。 */
export function createInitialStatus(): StatusValues {
  return { ...INITIAL_STATUS }
}
