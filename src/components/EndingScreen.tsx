// FR-P2-002 エンディング再生。要件仕様 v0.2 §4.1。
// 演出はシナリオ再生と同じ構成部品（背景＋立ち絵＋テキスト送り）を使い、見た目を揃える。
// 数値は一切出さない（UI-RULE-006）。
import { useState } from 'react'
import type { EndingDef } from '../types'
import { useTypewriter } from '../hooks/useTypewriter'
import { backgroundUrl, characterUrl } from '../utils/assets'
import Button from './common/Button'

interface Props {
  ending: EndingDef
  onClose: () => void
}

export default function EndingScreen({ ending, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const line = ending.lines[index]
  const tw = useTypewriter(line?.text ?? '')
  const isLast = index >= ending.lines.length - 1

  if (!line) return null

  const advance = () => {
    if (!tw.done) {
      tw.skip() // 送り中 → 全文即時表示（シナリオ再生と同じ操作感）
      return
    }
    if (!isLast) setIndex((i) => i + 1)
  }

  return (
    <div
      data-testid="screen-ending"
      className="min-h-screen bg-bg-base bg-cover bg-center text-text-main relative select-none"
      style={{ backgroundImage: `url(${backgroundUrl(ending.background)})` }}
    >
      {/* 立ち絵（シナリオ再生と同じ配置・発話者以外はグレーアウト） */}
      <div className="absolute inset-0 flex items-end justify-around pb-36" aria-hidden>
        {line.characters.map((c) => (
          <img
            key={c.position}
            src={characterUrl(c.characterId, c.expression)}
            alt=""
            className={`h-[68vh] w-auto max-w-[46vw] object-contain object-bottom drop-shadow-xl transition ${
              c.characterId !== line.speaker ? 'grayscale brightness-[.45]' : ''
            }`}
            style={{ order: c.position === 'left' ? 0 : 1 }}
          />
        ))}
      </div>

      {/* エンディング名（上部に固定表示。到達した達成感を最初に見せる） */}
      <div className="absolute top-0 left-0 right-0 px-6 py-4 bg-gradient-to-b from-black/80 to-transparent text-center">
        <p data-testid="ending-name" className="text-2xl font-bold text-accent [text-shadow:_0_2px_6px_rgb(0_0_0_/_0.9)]">
          {ending.name}
        </p>
        <p className="text-sm text-text-muted mt-1 [text-shadow:_0_1px_4px_rgb(0_0_0_/_0.9)]">{ending.subtitle}</p>
      </div>

      {/* 本文（クリックで送り／進行） */}
      <button
        data-testid="ending-window"
        onClick={advance}
        className="absolute bottom-0 left-0 right-0 text-left bg-surface/90 border-t-2 border-accent/40 p-5 min-h-[140px]"
      >
        {line.speaker !== 'narration' && (
          <span className="inline-block bg-accent text-bg-base text-xs font-bold rounded px-2 py-0.5 mb-2">
            {speakerName(line.speaker)}
          </span>
        )}
        <p className="leading-[1.9] text-[15px]">
          {tw.shown}
          {tw.done && !isLast && <span className="animate-pulse ml-1">▼</span>}
        </p>
      </button>

      {/* 最終行まで読んだら閉じられる */}
      {tw.done && isLast && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
          <Button variant="primary" onClick={onClose} data-testid="btn-ending-close">
            エンディング一覧へ
          </Button>
        </div>
      )}
    </div>
  )
}

function speakerName(id: string): string {
  const names: Record<string, string> = { rin: 'リン', tanaka: '田中', ken: 'ケン', takumi: '匠', mio: '澪' }
  return names[id] ?? id
}
