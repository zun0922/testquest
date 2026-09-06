// FR-P2-003 編成パターン。
// 企画書§6.1「パターンで顔ぶれが変わっても担当トピックとシナリオ内容は共通」に従い、
// **シナリオJSON 71本は一切変更しない**。差し替えるキャラと本文の差分だけを
// public/data/casting.json に持ち、表示のたびにここで解決する。
//
// 差し替え対象は技術メンター役（匠 ⇄ 澪）の1役のみ（PO決定 2026-09-06）。
// 音声は差し替えたキャラのぶんだけ別途生成する（voice.ts の variants）。
import type { CharacterDisplay, CharacterId } from '../types'

export const DEFAULT_CASTING_ID = 'default'

export interface Casting {
  id: string
  label: string
  description: string
  /** 元のキャラID → 差し替え後のキャラID */
  swap: Record<string, string>
  /** scenarioId → nodeId → 差し替える本文（一人称・名乗りだけを直したもの） */
  textOverrides: Record<string, Record<string, string>>
}

export interface CastingData {
  version: 1
  castings: Casting[]
}

export const DEFAULT_CASTING: Casting = {
  id: DEFAULT_CASTING_ID,
  label: '高橋 匠',
  description: '',
  swap: {},
  textOverrides: {},
}

function isCastingData(v: unknown): v is CastingData {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (o.version !== 1 || !Array.isArray(o.castings)) return false
  return o.castings.every((c) => {
    const x = c as Record<string, unknown>
    return typeof x?.id === 'string' && typeof x?.label === 'string'
  })
}

let cache: CastingData | null = null
let inflight: Promise<CastingData | null> | null = null

/** 編成定義を読む。読めなければ null（呼び出し側は既定の編成で動く）。 */
export async function loadCastings(fetchFn: typeof fetch = fetch): Promise<CastingData | null> {
  try {
    const res = await fetchFn(`${import.meta.env.BASE_URL}data/casting.json`)
    if (!res.ok) return null
    const json: unknown = await res.json()
    return isCastingData(json) ? json : null
  } catch {
    return null // 配信されていなくても、既定の編成で従来どおり遊べる
  }
}

export function ensureCastings(fetchFn: typeof fetch = fetch): Promise<CastingData | null> {
  if (cache) return Promise.resolve(cache)
  inflight ??= loadCastings(fetchFn).then((d) => {
    cache = d
    inflight = null
    return d
  })
  return inflight
}

export function resetCastingCache(): void {
  cache = null
  inflight = null
}

/** IDから編成を引く。見つからなければ既定（差し替えなし）。 */
export function findCasting(data: CastingData | null, id: string | undefined): Casting {
  if (!data || !id) return DEFAULT_CASTING
  return data.castings.find((c) => c.id === id) ?? DEFAULT_CASTING
}

/**
 * 話者・立ち絵のキャラIDを差し替える。
 * ナレーションは差し替え対象ではないので、そのまま通す（型もそのまま保つ）。
 */
export function resolveCharacterId<T extends CharacterId | 'narration'>(casting: Casting, characterId: T): T {
  return (casting.swap[characterId] as T | undefined) ?? characterId
}

/** 立ち絵の配列をまとめて差し替える（位置・表情はそのまま）。 */
export function resolveCharacters(casting: Casting, characters: CharacterDisplay[]): CharacterDisplay[] {
  if (Object.keys(casting.swap).length === 0) return characters
  return characters.map((c) =>
    casting.swap[c.characterId]
      ? { ...c, characterId: casting.swap[c.characterId] as CharacterId }
      : c,
  )
}

/**
 * 本文を差し替える。差分が無ければ元の本文をそのまま返す。
 * 差分は「一人称・二人称・名乗り」だけを直したもので、学習内容は変えない。
 */
export function resolveText(
  casting: Casting,
  scenarioId: string,
  nodeId: string,
  text: string,
): string {
  return casting.textOverrides[scenarioId]?.[nodeId] ?? text
}

/** その編成で差し替えが起きるか（音声の解決や表示の分岐で使う）。 */
export function hasSwap(casting: Casting): boolean {
  return Object.keys(casting.swap).length > 0
}
