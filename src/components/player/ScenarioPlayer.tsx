// FR-003〜006 シナリオ再生。設計書§5.3〜5.6・§8.1（モックA案がレイアウトの正）。
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlaySession } from '../../hooks/useGame'
import type { StatusValues, ChoiceNode, Choice, Rating, CharacterDisplay } from '../../types'
import { useTypewriter } from '../../hooks/useTypewriter'
import { useVoice } from '../../hooks/useVoice'
import { loadCastingId, loadVoiceSettings, saveVoiceSettings, type VoiceSettings } from '../../utils/uiState'
import { emphasizedIndices, hasHintData, hintLevel, splitByEmphasis } from '../../utils/hint'
import StatusHud from '../common/StatusHud'
import ConfirmDialog from '../common/ConfirmDialog'
import { backgroundUrl, characterUrl } from '../../utils/assets'
import { isRead, loadReadLog, markRead, type ReadLog } from '../../utils/readLog'
import { ensureManifest, hasVoice, playVoiceOnce, type VoiceManifest } from '../../utils/voice'
import {
  DEFAULT_CASTING,
  ensureCastings,
  findCasting,
  resolveCharacterId,
  resolveCharacters,
  resolveText,
  type Casting,
} from '../../utils/casting'

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

  // FR-P2-003 編成パターン。読み込み前は既定の編成で描く（表示が遅れないように）
  const [casting, setCasting] = useState<Casting>(DEFAULT_CASTING)
  useEffect(() => {
    let alive = true
    const id = loadCastingId()
    if (!id || id === DEFAULT_CASTING.id) return
    void ensureCastings().then((d) => {
      if (alive) setCasting(findCasting(d, id))
    })
    return () => {
      alive = false
    }
  }, [])

  // 差し替えは「表示のときだけ」行う。シナリオJSONは元のまま扱う
  const shownText = node ? resolveText(casting, session.scenario.id, node.id, node.text) : ''
  const shownSpeaker = node ? resolveCharacterId(casting, node.speaker) : 'narration'
  const shownCharacters = useMemo(
    () => (node ? resolveCharacters(casting, node.characters) : []),
    [casting, node],
  )
  const tw = useTypewriter(shownText)

  // FR-P2-005 既読スキップ／バックログ
  // 既読の記録は ref で持つ：ノードを表示するたびに書き換わるが、再描画は不要なため
  const readLogRef = useRef<ReadLog>(loadReadLog())
  // 「このノードを表示する前から既読だったか」。表示と同時に既読へ記録するので、
  // 記録より前の状態を残しておかないと初見のノードまで自動で送ってしまう
  const [visit, setVisit] = useState<{ nodeId: string; wasRead: boolean } | null>(null)
  const [skipping, setSkipping] = useState(false)
  const [backlog, setBacklog] = useState<BacklogLine[]>([])
  const [showBacklog, setShowBacklog] = useState(false)
  // ノード表示と同時にセリフを鳴らす。テキスト送り（30ms/文字）とは同期させず並行再生する
  //（PO決定 2026-08-25）。音声が無い章・OFF・再生拒否のいずれでも従来どおり進行する。
  const voiceState = useVoice(session.scenario.id, node?.id ?? '', voice, casting.id)

  const sid = session.scenario.id
  const nodeId = node?.id
  const speaker = shownSpeaker
  const text = shownText

  // ノードを表示したら既読にし、バックログへ積む
  useEffect(() => {
    if (!nodeId) return
    const wasRead = isRead(readLogRef.current, sid, nodeId)
    readLogRef.current = markRead(readLogRef.current, sid, nodeId)
    setVisit({ nodeId, wasRead })
    setBacklog((prev) =>
      // 分岐で同じノードへ戻ることがあるため、重複しては積まない
      prev.some((l) => l.nodeId === nodeId)
        ? prev
        : [...prev, { nodeId, speaker: speaker ?? 'narration', text: text ?? '' }],
    )
  }, [sid, nodeId, speaker, text])

  const toggleVoice = () => {
    const next = { ...voice, enabled: !voice.enabled }
    setVoice(next)
    saveVoiceSettings(next)
  }

  const feedbackChoice = session.feedbackChoice
  const nodeType = node?.type
  const nodeNext = node?.type === 'text' ? node.next : undefined
  const twDone = tw.done
  const twSkip = tw.skip
  // 既読の自動送り。止まる条件をこの1か所に集約する
  useEffect(() => {
    if (!skipping || !nodeId) return
    if (paused || feedbackChoice) return // 表示を消さずに待つ（スキップは解除しない）
    if (visit?.nodeId !== nodeId) return // 既読判定が確定するまで待つ
    if (!visit.wasRead || nodeType === 'choice') {
      setSkipping(false) // 未読と選択肢では必ず止まる＝読み飛ばしと出題スキップを防ぐ
      return
    }
    if (!twDone) {
      twSkip() // 送り途中なら全文を出してから進む
      return
    }
    const t = setTimeout(() => {
      if (nodeNext === null) onFinish()
      else onAdvance()
    }, 90) // 一瞬だけ残す＝何が流れたか目で追える速さ
    return () => clearTimeout(t)
  }, [skipping, nodeId, nodeType, nodeNext, visit, twDone, twSkip, paused, feedbackChoice, onAdvance, onFinish])

  if (!node) return null

  const feedback = session.feedbackChoice
  const showChoices = node.type === 'choice' && tw.done && !feedback

  const handleAreaClick = () => {
    if (feedback) return // フィードバック表示中は背景クリック無効
    if (skipping) {
      setSkipping(false) // 画面に触れたら止まる＝明示操作を自動送りより優先する
      return
    }
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
      <Stage characters={shownCharacters} speaker={shownSpeaker} />

      {/* 右上：メニュー＋StatusHud */}
      <div className="absolute top-3 right-3 flex items-start gap-2 z-30">
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
          data-testid="btn-skip"
          aria-label={skipping ? '既読スキップを止める' : '既読スキップ'}
          aria-pressed={skipping}
          onClick={() => setSkipping((v) => !v)}
          className={`min-w-[44px] min-h-[44px] rounded-lg focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent ${
            skipping ? 'bg-accent text-bg-base font-bold' : 'bg-black/62 text-text-main'
          }`}
        >
          &#9193;
        </button>
        <button
          data-testid="btn-backlog"
          aria-label="これまでのセリフ"
          onClick={() => {
            setSkipping(false)
            setShowBacklog(true)
          }}
          className="min-w-[44px] min-h-[44px] bg-black/62 rounded-lg text-text-main focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
        >
          &#9776;
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
        {shownSpeaker !== 'narration' && (
          <span data-testid="speaker-name" className="inline-block bg-accent text-bg-base text-xs font-bold rounded px-2 py-0.5 mb-2">
            {speakerName(shownSpeaker)}
          </span>
        )}
        <p className="leading-[1.9] text-[15px]">
          {tw.shown}
          {tw.done && node.type === 'text' && <span className="animate-pulse ml-1">▼</span>}
        </p>
      </button>

      {/* 選択肢オーバーレイ */}
      {showChoices && (
        // key に node.id を与えて問題ごとに作り直す＝前の問題のヒント表示を持ち越さない
        <ChoiceOverlay
          key={node.id}
          choices={(node as ChoiceNode).choices}
          hint={(node as ChoiceNode).hint}
          onChoose={onChoose}
          status={status}
          level={session.level}
        />
      )}

      {/* フィードバックモーダル */}
      {feedback && (
        <FeedbackModal choice={feedback} isReplay={session.isReplay} onClose={onCloseFeedback} />
      )}

      {/* バックログ（FR-P2-005） */}
      {showBacklog && (
        <BacklogOverlay
          scenarioId={sid}
          lines={backlog}
          volume={voice.volume}
          castingId={casting.id}
          onClose={() => setShowBacklog(false)}
        />
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

function ChoiceOverlay({
  choices,
  hint,
  onChoose,
  status,
  level,
}: {
  choices: Choice[]
  hint?: string
  onChoose: (i: number) => void
  status: StatusValues
  level: PlaySession['level']
}) {
  // FR-P2-007 ヒント：合計ポイントとレベル別閾値で強さが決まる（要件仕様 §3）。
  // Lv1＝ヒント文のみ／Lv2＝ヒント文＋選択肢の強調。任意表示にしているのは、
  // 自分で考えてから見られるようにするため。
  const [showHint, setShowHint] = useState(false)
  const hLv = hintLevel(status, level)
  const canHint = hLv > 0 && hasHintData(hint, choices)
  const targets = showHint ? emphasizedIndices(choices, hLv) : new Set<number>()

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
    // 暗幕はクリックを受け取らない（pointer-events-none）。受け取ると上部のボタンが
    // 覆われて押せなくなるため。中身（ヒント・選択肢・ヒントボタン）だけが受け取る。
    // 選択肢ノードは元々クリックで進まないので、暗幕が操作を遮る必要はない。
    <div className="pointer-events-none absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3 px-6 z-20">
      {/* ヒント文（Lv1 以上）。答えではなく「何を考えるか」を示す */}
      {showHint && hint && (
        <div
          data-testid="hint-text"
          className="pointer-events-auto w-full max-w-md rounded-lg border border-hint/60 bg-hint/10 backdrop-blur-sm px-4 py-3 text-sm leading-relaxed text-text-main [text-shadow:_0_1px_3px_rgb(0_0_0_/_0.85)]"
        >
          <span className="mr-1" aria-hidden>💡</span>
          {hint}
        </div>
      )}
      {order.map((origIdx, pos) => (
        <button
          key={origIdx}
          data-testid={`choice-btn-${origIdx}`}
          onClick={() => onChoose(origIdx)}
          // ハイブリッド：透過ゴールド＋backdrop-blur＋テキストにスクリム（影）。背景の明暗に依らず読める
          className="pointer-events-auto w-full max-w-md text-left bg-accent/25 backdrop-blur-sm border border-accent/70 rounded-lg px-4 py-3 text-text-main [text-shadow:_0_1px_3px_rgb(0_0_0_/_0.85)] hover:bg-accent/40 hover:border-accent hover:-translate-y-0.5 transition focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
        >
          <span className="inline-flex items-center justify-center mr-2 min-w-[1.4rem] rounded bg-black/40 text-accent font-bold [text-shadow:none]">
            {String.fromCharCode(65 + pos)}
          </span>
          {targets.has(origIdx)
            ? splitByEmphasis(choices[origIdx].text, choices[origIdx].emphasis).map((seg, i) =>
              seg.hit ? (
                <strong key={i} data-testid="hint-mark" className="font-bold text-hint underline decoration-hint/60 underline-offset-2">
                  {seg.text}
                </strong>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )
            : choices[origIdx].text}
        </button>
      ))}

      {/* ヒントボタン。数値は出さない（UI-RULE-006）。活性/非活性でポイントの育ち具合が間接的に伝わる */}
      <button
        data-testid="btn-hint"
        disabled={!canHint || showHint}
        onClick={() => setShowHint(true)}
        className="pointer-events-auto mt-1 text-sm px-4 py-2 rounded-lg border border-line/80 bg-black/50 text-text-muted enabled:hover:text-text-main enabled:hover:border-accent/70 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
      >
        {showHint ? '💡 ヒント表示中' : canHint ? '💡 ヒントを見る' : '💡 ヒントはまだ使えません'}
      </button>
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

/** バックログ1行。表示に必要な最小限だけ持つ。 */
interface BacklogLine {
  nodeId: string
  speaker: string
  text: string
}

/**
 * これまでのセリフを読み返す（FR-P2-005）。
 * 音声がある行には再生ボタンを出す＝聞き逃しのリカバリ。無い行には出さない。
 */
function BacklogOverlay({
  scenarioId,
  lines,
  volume,
  castingId,
  onClose,
}: {
  scenarioId: string
  lines: BacklogLine[]
  volume: number
  castingId: string
  onClose: () => void
}) {
  const [manifest, setManifest] = useState<VoiceManifest | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let alive = true
    void ensureManifest().then((m) => {
      if (alive) setManifest(m)
    })
    return () => {
      alive = false
    }
  }, [])

  // 開いたら最新（＝いま読んでいるところ）が見える位置にする
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [])

  return (
    <div className="absolute inset-0 z-30 bg-black/80 flex flex-col p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-accent font-bold">これまでのセリフ</h2>
        <button
          data-testid="btn-backlog-close"
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] bg-surface rounded-lg text-text-main focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
        >
          &#10005;
        </button>
      </div>

      <div data-testid="backlog" className="flex-1 overflow-y-auto pr-1">
        {lines.length === 0 && <p className="text-text-muted text-sm">まだセリフがありません。</p>}
        <ul className="flex flex-col gap-2">
          {lines.map((l) => (
            <li key={l.nodeId} data-testid="backlog-line" className="bg-surface/90 rounded-lg p-3 flex gap-3">
              <div className="flex-1">
                {l.speaker !== 'narration' && (
                  <span className="inline-block bg-accent text-bg-base text-xs font-bold rounded px-2 py-0.5 mb-1">
                    {speakerName(l.speaker)}
                  </span>
                )}
                <p className="text-sm leading-[1.8]">{l.text}</p>
              </div>
              {hasVoice(manifest, scenarioId, l.nodeId) && (
                <button
                  data-testid={`btn-backlog-play-${l.nodeId}`}
                  aria-label="このセリフを再生"
                  onClick={() => playVoiceOnce(manifest, scenarioId, l.nodeId, volume, castingId)}
                  className="self-start min-w-[44px] min-h-[44px] bg-black/50 rounded-lg text-text-main focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
                >
                  &#9654;
                </button>
              )}
            </li>
          ))}
        </ul>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
