// UI設定（進捗データ・SaveDataV1／storage.ts とは別キー）。
// ＝セーブ仕様・マイグレーションに影響を与えない設定として扱う。
//  - open  : 選択画面（FR-002）の折り畳み状態。ユーザーが明示的に開閉した節だけを保持し、
//            触っていない節は自動判定（levels.findContinueChapter）に従う。
//  - voice : キャラクターボイス（Phase 2・FR-P2-006）の ON/OFF と音量。
// どちらも同じ JSON に同居するため、片方の保存でもう片方が消えないよう読み書きを統合する。

export const UI_KEY = 'testquest:ui'

/** キー→開いているか。true=開く／false=閉じる（未収録＝自動判定に任せる）。 */
export type OpenOverrides = Record<string, boolean>

/** 音声設定（Phase 2）。volume は 0.0〜1.0。 */
export interface VoiceSettings {
  enabled: boolean
  volume: number
}

/** 既定値：音声はONで少し絞った音量（学習中の環境音として大きすぎないため）。 */
export const DEFAULT_VOICE: VoiceSettings = { enabled: true, volume: 0.8 }

/** レベル節のキー（例：'lv:fl'）。 */
export function levelOpenKey(slug: string): string {
  return `lv:${slug}`
}

/** 章節のキー（例：'ch:fl-2'）。 */
export function chapterOpenKey(slug: string, chapter: number): string {
  return `ch:${slug}-${chapter}`
}

function isOpenOverrides(v: unknown): v is OpenOverrides {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  return Object.values(v as Record<string, unknown>).every((x) => typeof x === 'boolean')
}

function isVoiceSettings(v: unknown): v is VoiceSettings {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const o = v as Record<string, unknown>
  if (typeof o.enabled !== 'boolean') return false
  if (typeof o.volume !== 'number' || !Number.isFinite(o.volume)) return false
  return o.volume >= 0 && o.volume <= 1
}

/** 保存されている生データ（不正・利用不可環境では空オブジェクト）。 */
function readRaw(): Record<string, unknown> {
  let raw: string | null
  try {
    raw = localStorage.getItem(UI_KEY)
  } catch {
    return {}
  }
  if (raw === null) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * 指定キーだけを差し替えて保存する（他キーは保全）。
 * UI設定のため失敗（QuotaExceeded・利用不可環境）は無視する（学習進捗ではない）。
 */
function writePatch(patch: Record<string, unknown>): void {
  const next = { ...readRaw(), version: 1, ...patch }
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(next))
  } catch {
    // 保存できなくても表示・再生は成立する（次回は既定値に戻るだけ）
  }
}

/** 折り畳み状態を読み込む。未保存・不正・利用不可環境ではすべて空（＝自動判定のみ）を返す。 */
export function loadOverrides(): OpenOverrides {
  const open = readRaw().open
  return isOpenOverrides(open) ? open : {}
}

/** 折り畳み状態を保存する（音声設定は保全される）。 */
export function saveOverrides(open: OpenOverrides): void {
  writePatch({ open })
}

/** 音声設定を読み込む。未保存・不正・利用不可環境では既定値を返す。 */
export function loadVoiceSettings(): VoiceSettings {
  const voice = readRaw().voice
  return isVoiceSettings(voice) ? voice : { ...DEFAULT_VOICE }
}

/** 音声設定を保存する（折り畳み状態は保全される）。 */
export function saveVoiceSettings(voice: VoiceSettings): void {
  writePatch({ voice })
}

/**
 * 編成パターン（FR-P2-003）の選択。UI設定なので進捗とは別キーに置く。
 * 未保存・不正なら undefined を返し、呼び出し側は既定の編成で動く。
 */
export function loadCastingId(): string | undefined {
  const casting = readRaw().casting
  return typeof casting === 'string' ? casting : undefined
}

export function saveCastingId(casting: string): void {
  writePatch({ casting })
}
