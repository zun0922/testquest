// 選択画面（FR-002）の折り畳み状態。進捗データ（SaveDataV1・storage.ts）とは別キーで保持する。
// ＝セーブ仕様・マイグレーションに影響を与えない UI 設定として扱う。
// 保持するのは「ユーザーが明示的に開閉した節」だけ（override）。触っていない節は
// 自動判定（続きの章を開く・levels.findContinueChapter）に従う。

export const UI_KEY = 'testquest:ui'

/** キー→開いているか。true=開く／false=閉じる（未収録＝自動判定に任せる）。 */
export type OpenOverrides = Record<string, boolean>

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

/** 読み込む。未保存・不正・利用不可環境ではすべて空（＝自動判定のみ）を返す。 */
export function loadOverrides(): OpenOverrides {
  let raw: string | null
  try {
    raw = localStorage.getItem(UI_KEY)
  } catch {
    return {}
  }
  if (raw === null) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const open = (parsed as { open?: unknown }).open
    return isOpenOverrides(open) ? open : {}
  } catch {
    return {}
  }
}

/** 保存する。UI設定のため失敗（QuotaExceeded・利用不可環境）は無視する（学習進捗ではない）。 */
export function saveOverrides(open: OpenOverrides): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify({ version: 1, open }))
  } catch {
    // 保存できなくても表示は成立する（次回は自動判定に戻るだけ）
  }
}
