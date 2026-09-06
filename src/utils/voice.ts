// Phase 2（FR-P2-006）キャラクターボイスのパス解決とマニフェスト管理。
// 画像（assets.ts）と同じく「規約でパスが決まる」方式にし、シナリオJSON には手を入れない。
//   public/audio/{scenarioId}/{nodeId}.m4a     配信用の音声（AAC＝Safari 互換）
//   public/audio/manifest.json                 存在判定・尺・差分再生成用のハッシュ
// マニフェストで事前に存在判定するのは、音声が無いノードで毎回 404 を出さないため。
// 音声が用意されていない／取得に失敗した場合は「無音で従来どおり進む」ことを保証する。
import { type CharacterId } from '../types'

// テスト容易性フック（scenarioLoader の VITE_SCENARIOS_PATH と同じ考え方）
const AUDIO_BASE: string = (import.meta.env?.VITE_AUDIO_PATH as string | undefined) ?? '/audio'

/**
 * マニフェストが読めないときに使う既定の拡張子。
 * AAC(m4a) を採用：Ogg Opus は iOS 16 以前の Safari が再生できず、要件7.2 の対応ブラウザに
 * Safari が含まれるため。容量は Opus より少し大きいが全対応ブラウザで確実に鳴る方を取る。
 */
export const DEFAULT_FORMAT = 'm4a'

/** 1ノード分の音声メタ。hash はテキストの SHA-256（差分再生成の判定に使う）。 */
export interface VoiceEntry {
  hash: string
  dur: number
  cast: CharacterId | 'narration'
}

export interface VoiceManifest {
  version: 1
  format: string
  /**
   * 表示が必要なクレジット（例 'VOICEVOX:玄野武宏'）。
   * 音声ライブラリの規約でクレジット表記が必須なため、**実際に音声を配信している音源だけ**を
   * 生成時に `scripts/voice-cast.json` から書き出す（フロント側に配役表を二重に持たない）。
   */
  credits?: string[]
  scenarios: Record<string, Record<string, VoiceEntry>>
}

function base(): string {
  return AUDIO_BASE.replace(/\/$/, '')
}

/** 音声ファイルのURL。形式の差し替えは manifest.format の変更だけで完結する。 */
export function voiceUrl(scenarioId: string, nodeId: string, format: string = DEFAULT_FORMAT): string {
  return `${base()}/${scenarioId}/${nodeId}.${format}`
}

function isVoiceEntry(v: unknown): v is VoiceEntry {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.hash === 'string' && typeof o.dur === 'number' && typeof o.cast === 'string'
}

function isVoiceManifest(v: unknown): v is VoiceManifest {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (o.version !== 1 || typeof o.format !== 'string') return false
  if (o.credits !== undefined && !(Array.isArray(o.credits) && o.credits.every((c) => typeof c === 'string'))) {
    return false
  }
  if (typeof o.scenarios !== 'object' || o.scenarios === null || Array.isArray(o.scenarios)) return false
  return Object.values(o.scenarios as Record<string, unknown>).every(
    (byNode) =>
      typeof byNode === 'object' &&
      byNode !== null &&
      !Array.isArray(byNode) &&
      Object.values(byNode as Record<string, unknown>).every(isVoiceEntry),
  )
}

/**
 * マニフェストを読み込む。未配置（404）・形式不正・通信失敗はすべて null を返す
 * ＝「音声機能なし」として扱い、例外は投げない（プレイを止めないため）。
 */
export async function loadManifest(fetchFn: typeof fetch = fetch): Promise<VoiceManifest | null> {
  try {
    const res = await fetchFn(`${base()}/manifest.json`)
    if (!res.ok) return null
    const data: unknown = await res.json()
    return isVoiceManifest(data) ? data : null
  } catch {
    return null
  }
}

// アプリ内で1回だけ読む（ノードごとに fetch しない）
let manifestPromise: Promise<VoiceManifest | null> | null = null

/** マニフェストをキャッシュ付きで取得する。 */
export function ensureManifest(fetchFn: typeof fetch = fetch): Promise<VoiceManifest | null> {
  manifestPromise ??= loadManifest(fetchFn)
  return manifestPromise
}

/** テスト用：キャッシュを破棄する。 */
export function resetManifestCache(): void {
  manifestPromise = null
}

/** 指定ノードの音声が存在するか。 */
export function hasVoice(manifest: VoiceManifest | null, scenarioId: string, nodeId: string): boolean {
  return Boolean(manifest?.scenarios[scenarioId]?.[nodeId])
}

/** 指定ノードの音声URL（無ければ null）。 */
export function voiceUrlFor(
  manifest: VoiceManifest | null,
  scenarioId: string,
  nodeId: string,
): string | null {
  if (!hasVoice(manifest, scenarioId, nodeId)) return null
  return voiceUrl(scenarioId, nodeId, manifest?.format ?? DEFAULT_FORMAT)
}

// ===== 再生要素（単一インスタンス） =====
// 音声要素をアプリ全体で1つに固定する理由：
//  ①同時に2つのセリフが鳴るのを構造的に防ぐ
//  ②iOS Safari は「ユーザー操作起因で一度 play() した要素」しか後から再生できないため、
//    解錠済みの要素を使い回す必要がある（要素を都度作ると毎回ブロックされる）
let sharedAudio: HTMLAudioElement | null = null
let unlocked = false

/** 無音WAV（44バイトのヘッダのみ）。解錠専用で、音は鳴らない。 */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='

/** 再生を止める。jsdom など HTMLMediaElement 未実装の環境でも例外を出さない。 */
export function stopAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return
  try {
    audio.pause()
  } catch {
    // 未実装環境では停止できないが、進行を止める理由にはしない
  }
}

/** 共有音声要素。Audio が無い環境（SSR・一部のテスト環境）では null。 */
export function getSharedAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  sharedAudio ??= new Audio()
  return sharedAudio
}

/**
 * 自動再生ポリシーの解錠。最初のユーザー操作（pointerdown 等）から呼ぶ。
 * 無音を一瞬再生して要素を「操作起因で再生された」状態にする。失敗しても無害。
 */
export function unlockAudio(): void {
  if (unlocked) return
  const audio = getSharedAudio()
  if (!audio) return
  unlocked = true
  try {
    audio.src = SILENT_WAV
    const p = audio.play()
    if (p && typeof p.then === 'function') {
      void p.then(() => stopAudio(audio)).catch(() => undefined)
    } else {
      stopAudio(audio)
    }
  } catch {
    // 解錠できなくても、後続の play() が通る環境なら再生される
  }
}

/**
 * 指定ノードのセリフを1回だけ鳴らす（FR-P2-005 バックログの再生ボタン用）。
 * 共有要素を使うので、鳴らし直すと前の再生は自動的に止まる。
 * 音声が無い・再生できない場合は false を返すだけで、呼び出し側は何もしなくてよい。
 */
export function playVoiceOnce(
  manifest: VoiceManifest | null,
  scenarioId: string,
  nodeId: string,
  volume: number,
): boolean {
  const url = voiceUrlFor(manifest, scenarioId, nodeId)
  const audio = getSharedAudio()
  if (!url || !audio) return false
  stopAudio(audio)
  audio.src = url
  audio.volume = volume
  try {
    audio.currentTime = 0
  } catch {
    // src 差し替え直後は設定できないことがある（0から始まるので実害なし）
  }
  try {
    const p = audio.play()
    if (p && typeof p.then === 'function') void p.catch(() => undefined)
    return true
  } catch {
    return false
  }
}

/** テスト用：解錠状態と共有要素をリセットする。 */
export function resetAudioForTest(): void {
  sharedAudio = null
  unlocked = false
}
