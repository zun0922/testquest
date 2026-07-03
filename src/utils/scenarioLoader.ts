// FR-009 シナリオロード：fetch ＋ 検証。設計書 v1.1 §5.0・§10.4。
// VITE_SCENARIOS_PATH 未設定時は本番 /data/scenarios を指す（テスト容易性フック）。
import { type Scenario, type ScenarioIndex } from '../types'
import { validateScenario, ValidationError } from './validator'

// 設計書§10.4：環境変数でベースパスを上書き可能（テスト時に scenarios_test/ を指す）
const SCENARIOS_BASE: string =
  (import.meta.env?.VITE_SCENARIOS_PATH as string | undefined) ?? '/data/scenarios'

/** 末尾スラッシュを除いたベースパス。 */
function base(): string {
  return SCENARIOS_BASE.replace(/\/$/, '')
}

function isScenarioIndex(v: unknown): v is ScenarioIndex {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return obj.version === 1 && Array.isArray(obj.scenarios)
}

/** index.json を読み込む。fetch 失敗・形式不正は Error を throw。 */
export async function loadIndex(
  fetchFn: typeof fetch = fetch,
): Promise<ScenarioIndex> {
  const url = `${base()}/index.json`
  const res = await fetchFn(url)
  if (!res.ok) {
    throw new Error(`index.json の取得に失敗しました（HTTP ${res.status}）`)
  }
  const data: unknown = await res.json()
  if (!isScenarioIndex(data)) {
    throw new Error('index.json の形式が不正です')
  }
  return data
}

/**
 * シナリオファイルを読み込み検証する。
 * fetch 失敗は Error、検証エラーは ValidationError を throw。
 */
export async function loadScenario(
  file: string,
  fetchFn: typeof fetch = fetch,
): Promise<Scenario> {
  const url = `${base()}/${file}`
  const res = await fetchFn(url)
  if (!res.ok) {
    throw new Error(`シナリオ '${file}' の取得に失敗しました（HTTP ${res.status}）`)
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new Error(`シナリオ '${file}' の JSON 解析に失敗しました`)
  }
  // 検証（エラー級違反は ValidationError を throw・到達不能は警告）
  validateScenario(data)
  return data as Scenario
}

export { ValidationError }
