// ステータスメーター4本。UI-RULE-006：数値・% のテキストを一切描画しない。
// バー幅は内部値に比例（style の width で表現＝textContent には数字を出さない）。
// data-testid="status-bar-{key}"・aria-valuenow は付与しない（数値非表示の徹底・設計書§10.2）。
import { type StatusValues, type StatusKey, STATUS_KEYS } from '../../types'

const META: Record<StatusKey, { label: string; icon: string; color: string }> = {
  knowledge: { label: '知識', icon: '📚', color: 'bg-status-knowledge' },
  skill: { label: 'スキル', icon: '🔧', color: 'bg-status-skill' },
  confidence: { label: '自信', icon: '⭐', color: 'bg-status-confidence' },
  teamwork: { label: 'チームワーク', icon: '🤝', color: 'bg-status-teamwork' },
}

interface Props {
  status: StatusValues
  variant?: 'hud' | 'compare'
  before?: StatusValues // compare 時のプレイ前値
}

export default function StatusHud({ status, variant = 'hud', before }: Props) {
  const isHud = variant === 'hud'
  return (
    <div
      className={
        isHud
          ? 'bg-black/75 ring-1 ring-white/15 rounded-lg p-1.5 flex flex-col gap-0.5'
          : 'flex flex-col gap-3'
      }
    >
      {STATUS_KEYS.map((key) => {
        const m = META[key]
        const after = status[key]
        const prev = before?.[key] ?? after
        return (
          // status-bar-{key}：この要素内のテキストに数字・% を出さないこと（背理法検証対象）
          <div key={key} data-testid={`status-bar-${key}`} className={`flex items-center ${isHud ? 'gap-1.5' : 'gap-2'}`}>
            <span aria-hidden className={isHud ? 'text-[11px] leading-none' : 'text-sm'}>
              {m.icon}
            </span>
            <span className="sr-only">{m.label}</span>
            {/* トラック（未達部分）に濃い背景色を敷き、明るい背景でもメーターが視認できるようにする（PO指摘・PC/スマホ共通）。
                HUD時は幅を縮小してスマホでの立ち絵との重なりを軽減する（レスポンシブ） */}
            <div
              className={`relative rounded overflow-hidden ${
                isHud ? 'h-1.5 w-[92px] sm:w-[120px] bg-black/55 ring-1 ring-white/10' : 'h-1.5 w-[150px] bg-line/60'
              }`}
            >
              {/* compare：プレイ前の値を薄く下地表示 */}
              {variant === 'compare' && (
                <div className="absolute inset-y-0 left-0 rounded bg-text-muted/50" style={{ width: `${prev}%` }} />
              )}
              {/* 現在値（compare では増加分を gain 色で表現） */}
              <div className={`absolute inset-y-0 left-0 rounded ${m.color}`} style={{ width: `${after}%` }} />
              {variant === 'compare' && after > prev && (
                <div
                  className="absolute inset-y-0 rounded bg-status-gain animate-pulse"
                  style={{ left: `${prev}%`, width: `${after - prev}%` }}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
