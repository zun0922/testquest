// Phase 2（FR-P2-006）キャラクターボイスの再生制御。
// 方針：音声は「あれば鳴る」おまけとして扱い、無い・失敗する場合でもプレイを止めない。
// 再生要素は voice.ts の単一インスタンスを使い回す（多重再生の防止と iOS の解錠維持）。
import { useEffect, useState } from 'react'
import type { VoiceSettings } from '../utils/uiState'
import { ensureManifest, getSharedAudio, stopAudio, voiceUrlFor, type VoiceManifest } from '../utils/voice'

/** 再生状態。E2E から data 属性で観測するため文字列で持つ。 */
export type VoiceState =
  | 'off' // 設定でOFF
  | 'none' // このノードの音声が存在しない（未制作の章など）
  | 'playing' // 再生中（再生開始に成功）
  | 'blocked' // ブラウザに再生を拒否された（自動再生ポリシー等）

export function useVoice(
  scenarioId: string,
  nodeId: string,
  settings: VoiceSettings,
  castingId?: string,
): VoiceState {
  const [manifest, setManifest] = useState<VoiceManifest | null>(null)
  const [state, setState] = useState<VoiceState>('none')

  // マニフェストはアプリで1回だけ読む（voice.ts 側でキャッシュ）
  useEffect(() => {
    let alive = true
    void ensureManifest().then((m) => {
      if (alive) setManifest(m)
    })
    return () => {
      alive = false
    }
  }, [])

  // 音量だけの変更で頭から鳴り直さないよう、再生とは別の副作用にする
  useEffect(() => {
    const audio = getSharedAudio()
    if (audio) audio.volume = settings.volume
  }, [settings.volume])

  // ノードが変わったら前のセリフを止めて新しいセリフを鳴らす
  useEffect(() => {
    const audio = getSharedAudio()
    if (!audio) {
      setState('none')
      return
    }
    if (!settings.enabled) {
      stopAudio(audio)
      setState('off')
      return
    }
    const url = voiceUrlFor(manifest, scenarioId, nodeId, castingId)
    if (!url) {
      stopAudio(audio)
      setState('none')
      return
    }

    let alive = true
    stopAudio(audio)
    audio.src = url
    audio.volume = settings.volume
    try {
      audio.currentTime = 0
    } catch {
      // src 差し替え直後は設定できないことがある（再生位置は 0 から始まるので実害なし）
    }
    try {
      const p = audio.play()
      if (p && typeof p.then === 'function') {
        void p
          .then(() => alive && setState('playing'))
          .catch(() => alive && setState('blocked'))
      } else {
        setState('playing')
      }
    } catch {
      setState('blocked')
    }

    // 画面遷移・中断でセリフが鳴り続けないよう必ず止める
    return () => {
      alive = false
      stopAudio(audio)
    }
  }, [scenarioId, nodeId, settings.enabled, manifest, castingId])
  // settings.volume は上の副作用で反映する（依存に入れると音量操作で鳴り直すため）

  return state
}
