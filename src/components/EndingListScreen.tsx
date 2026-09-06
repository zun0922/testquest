// FR-P2-002 エンディング一覧。要件仕様 v0.2 §4.2。
// 未到達は伏せる（リプレイ動機になる）。到達済みは選ぶと再生できる。
import type { EndingDef, SaveDataV1 } from '../types'
import Button from './common/Button'

interface Props {
  endings: EndingDef[]
  save: SaveDataV1
  onPlay: (id: string) => void
  onBack: () => void
}

export default function EndingListScreen({ endings, save, onPlay, onBack }: Props) {
  const reached = save.endings ?? {}
  const count = endings.filter((e) => reached[e.id]).length

  return (
    <div data-testid="screen-ending-list" className="min-h-screen bg-bg-base text-text-main px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-2xl font-bold text-accent">エンディング</h1>
          {/* 到達数はステータスではないため UI-RULE-006 の対象外 */}
          <span data-testid="ending-count" className="text-sm text-text-muted">
            {count} / {endings.length} 到達
          </span>
        </div>

        <ul className="flex flex-col gap-3">
          {endings.map((e) => {
            const at = reached[e.id]
            if (!at) {
              return (
                <li
                  key={e.id}
                  data-testid={`ending-item-${e.id}`}
                  className="border border-line rounded-xl p-4 opacity-50"
                  aria-disabled
                >
                  <p className="font-bold text-text-muted">？？？</p>
                  <p className="text-xs text-text-muted mt-1">まだ到達していません</p>
                </li>
              )
            }
            return (
              <li key={e.id}>
                <button
                  data-testid={`ending-item-${e.id}`}
                  onClick={() => onPlay(e.id)}
                  className="w-full text-left border border-cleared/60 bg-cleared/10 rounded-xl p-4 hover:border-cleared hover:-translate-y-0.5 transition focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
                >
                  <p className="font-bold text-cleared">{e.name}</p>
                  <p className="text-sm text-text-main mt-1">{e.subtitle}</p>
                  <p className="text-xs text-text-muted mt-2">到達：{at.slice(0, 10)}　▶ もう一度見る</p>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-8 flex justify-center">
          <Button onClick={onBack} data-testid="btn-ending-list-back">
            戻る
          </Button>
        </div>
      </div>
    </div>
  )
}
