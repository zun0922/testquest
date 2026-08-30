// FR-003〜006 シナリオ再生。設計書§5.3〜5.6・§8.1（モックA案がレイアウトの正）。
import { useMemo, useState } from 'react'
import type { PlaySession } from '../../hooks/useGame'
import type { StatusValues, ChoiceNode, Choice, Rating, CharacterDisplay } from '../../types'
import { useTypewriter } from '../../hooks/useTypewriter'
import { useVoice } from '../../hooks/useVoice'
import { loadVoiceSettings, saveVoiceSettings, type VoiceSettings } from '../../utils/uiState'
import StatusHud from '../common/StatusHud'
import ConfirmDialog from '../common/ConfirmDialog'
import { backgroundUrl, characterUrl } from '../../utils/assets'

interface Props {
  session: PlaySession
  status: StatusValues
  onChoose: (index: number) => void
  onAdvance: () => void
  onCloseFeedback: () => void
  onFinish: () => void
  onQuit: () => void
}

// 評価は色＋ラベル＋アイコンの3表現（設計§7.1・色覚多様性配慮）。色トークンは tailwind.config.ts。
const RATING_META: Record<Rating, { label: string; icon: string; border: string; text: string }> = {
  best: { label: '最適', icon: '✓', border: 'border-rating-best', text: 'text-rating-best' },
  good: { label: '可', icon: '○', border: 'border-rating-good', text: 'text-rating-good' },
  poor: { label: '要改善', icon: '△', border: 'border-rating-poor', text: 'text-rating-poor' },
}

export default function ScenarioPlayer({ session, status, onChoose, onAdvance, onCloseFeedback, onFinish, onQuit }: Props) {
  const [paused, setPaused] = useState(false)
  const [voice, setVoice] = useState<VoiceSettings>(() => loadVoiceSettings())
  const node = session.scenario.nodes.find((n) => n.id === session.nodeId)
  const tw = useTypewriter(node?.text ?? '')
  // ノード表示と同時にセリフを鳴らす。テキスト送り（30ms/文字）とは同期させず並行再生する
  //（PO決定 2026-08-25）。音声が無い章・OFF・再生拒否のいずれでも従来どおり進行する。
  const voiceState = useVoice(session.scenario.id, node?.id ?? '', voice)

  const toggleVoice = () => {
    const next = { ...voice, enabled: !voice.enabled }
    setVoice(next)
    saveVoiceSettings(next)
  }

  if (!node) return null

  const feedback = session.feedbackChoice
  const showChoices = node.type === 'choice' && tw.done && !feedback

  const handleAreaClick = () => {
    if (feedback) return // フィードバック表示中は背景クリック無効
    if (!tw.done) {
      tw.skip() // 送り中 → 全文即時表示
      return
    }
    if (node.type === 'text') {
      if (node.next === null) onFinish()
      else onAdvance()
    }
    // choice ノードは選択待ち（クリックで進まない）
  }

  return (
    <div
      data-testid="screen-play"
      data-voice-state={voiceState}
      className="min-h-screen bg-bg-base bg-cover bg-center text-text-main relative select-none"
      style={{ backgroundImage: `url(${backgroundUrl(node.background)})` }}
    >
      {/* Stage：背景（上記）＋立ち絵 */}
      <Stage characters={node.characters} speaker={node.speaker} />

      {/* 右上：メニュー＋StatusHud */}
      <div className="absolute top-3 right-3 flex items-start gap-2 z-10">
        <button
          data-testid="btn-voice"
          aria-label={voice.enabled ? 'ボイスをオフにする' : 'ボイスをオンにする'}
          aria-pressed={voice.enabled}
          onClick={toggleVoice}
          className="min-w-[44px] min-h-[44px] bg-black/62 rounded-lg text-text-main focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
        >
          {voice.enabled ? '🔊' : '🔇'}
        </button>
        <button
          data-testid="btn-pause"
          aria-label="メニュー"
          onClick={() => setPaused(true)}
          className="min-w-[44px] min-h-[44px] bg-black/62 rounded-lg text-text-main focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
        >
          ≡
        </button>
        <StatusHud status={status} />
      </div>

      {/* メッセージウィンドウ（クリックで送り/進行） */}
      <button
        data-testid="message-window"
        onClick={handleAreaClick}
        className="absolute bottom-0 left-0 right-0 text-left bg-surface/90 border-t-2 border-accent/40 p-5 min-h-[140px]"
      >
        {node.speaker !== 'narration' && (
          <span data-testid="speaker-name" className="inline-block bg-accent text-bg-base text-xs font-bold rounded px-2 py-0.5 mb-2">
            {speakerName(node.speaker)}
          </span>
        )}
        <p className="leading-[1.9] text-[15px]">
          {tw.shown}
          {tw.done && node.type === 'text' && <span className="animate-pulse ml-1">▼</span>}
        </p>
      </button>

      {/* 選択肢オーバーレイ */}
      {showChoices && (
        <ChoiceOverlay choices={(node as ChoiceNode).choices} onChoose={onChoose} />
      )}

      {/* フィードバックモーダル */}
      {feedback && (
        <FeedbackModal choice={feedback} isReplay={session.isReplay} onClose={onCloseFeedback} />
      )}

      {/* 中断メニュー */}
      {paused && (
        <ConfirmDialog
          message="シナリオを中断しますか？（進捗は開始前に戻ります）"
          confirmLabel="中断する"
          cancelLabel="つづける"
          confirmTestId="btn-quit-confirm"
          onConfirm={() => {
            setPaused(false)
            onQuit()
          }}
          onCancel={() => setPaused(false)}
        />
      )}
    </div>
  )
}

function speakerName(id: string): string {
  const names: Record<string, string> = { rin: 'リン', tanaka: '田中', ken: 'ケン', takumi: '匠', mio: '澪' }
  return names[id] ?? id
}

function Stage({ characters, speaker }: { characters: CharacterDisplay[]; speaker: string }) {
  return (
    <div className="absolute inset-0 flex items-end justify-around pb-36" aria-hidden>
      {characters.map((c) => {
        // 発話者以外はグレーアウト（UI-RULE-004・モックA案準拠）
        const dim = c.characterId !== speaker
        return (
          <img
            key={c.position}
            src={characterUrl(c.characterId, c.expression)}
            alt=""
            className={`h-[68vh] w-auto max-w-[46vw] object-contain object-bottom drop-shadow-xl transition ${dim ? 'grayscale brightness-[.45]' : ''}`}
            style={{ order: c.position === 'left' ? 0 : 1 }}
          />
        )
      })}
    </div>
  )
}

function ChoiceOverlay({ choices, onChoose }: { choices: Choice[]; onChoose: (i: number) => void }) {
  // 表示順をシャッフルする（起案時は best を先頭に置いているため、そのままだと正答が常に A になり
  // 「1番を選べば正解」が学習されて演習が形骸化する）。reducer は元インデックスで選択を解決するので、
  // data-testid と onChoose には元インデックスを渡し、A/B/C ラベルは表示位置で振る。
  // 順序は設問ごとに固定（choices 参照で useMemo）＝再描画で入れ替わらない。
  const order = useMemo(() => {
    const idx = choices.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return idx
  }, [choices])
  return (
    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3 px-6 z-20">
      {order.map((origIdx, pos) => (
        <button
          key={origIdx}
          data-testid={`choice-btn-${origIdx}`}
          onClick={() => onChoose(origIdx)}
          // ハイブリッド：透過ゴールド＋backdrop-blur＋テキストにスクリム（影）。背景の明暗に依らず読める
          className="w-full max-w-md text-left bg-accent/25 backdrop-blur-sm border border-accent/70 rounded-lg px-4 py-3 text-text-main [text-shadow:_0_1px_3px_rgb(0_0_0_/_0.85)] hover:bg-accent/40 hover:border-accent hover:-translate-y-0.5 transition focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
        >
          <span className="inline-flex items-center justify-center mr-2 min-w-[1.4rem] rounded bg-black/40 text-accent font-bold [text-shadow:none]">
            {String.fromCharCode(65 + pos)}
          </span>
          {choices[origIdx].text}
        </button>
      ))}
    </div>
  )
}

function FeedbackModal({ choice, isReplay, onClose }: { choice: Choice; isReplay: boolean; onClose: () => void }) {
  const meta = RATING_META[choice.rating]
  return (
    <div className="fixed inset-0 bg-black/66 flex items-center justify-center z-30 px-4">
      <div data-testid="feedback-modal" className={`bg-surface border-2 ${meta.border} rounded-xl p-5 w-full max-w-md max-h-[86vh] overflow-y-auto`}>
        <div data-testid="feedback-rating" className={`font-bold mb-3 ${meta.text}`}>
          <span className="mr-2">{meta.icon}</span>
          {meta.label}
        </div>
        <p className="text-[15px] leading-[1.9] mb-3">{choice.feedback.explanation}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {choice.feedback.syllabusRefs.map((r) => (
            <span key={r} className="text-xs border border-line rounded px-2 py-1 text-text-muted">
              FL {r}
            </span>
          ))}
        </div>

        {/* 成長表示（数値なし）。再プレイ時は注記のみ（設計書§5.6） */}
        {isReplay ? (
          <p className="text-xs text-text-muted mb-4">※クリア済みシナリオのため成長は加算されません。</p>
        ) : (
          <div className="flex flex-col gap-1 mb-4">
            {(Object.keys(choice.statusEffects) as (keyof typeof choice.statusEffects)[]).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="text-xs text-text-muted">{statusLabel(k)}</span>
                <span className="h-1.5 flex-1 max-w-[120px] rounded bg-status-gain animate-pulse" />
              </div>
            ))}
          </div>
        )}

        <div className="text-right">
          <button
            data-testid="btn-feedback-close"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] bg-accent text-bg-base font-bold rounded-lg px-5 focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
          >
            閉じて次へ
          </button>
        </div>
      </div>
    </div>
  )
}

function statusLabel(k: string): string {
  const labels: Record<string, string> = { knowledge: '知識', skill: 'スキル', confidence: '自信', teamwork: 'チームワーク' }
  return labels[k] ?? k
}
