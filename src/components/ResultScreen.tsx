// FR-007 シナリオ結果表示。設計書§5.7・§8.3。
import type { PlaySession } from '../hooks/useGame'
import type { StatusValues } from '../types'
import Button from './common/Button'
import StatusHud from './common/StatusHud'

interface Props {
  session: PlaySession
  statusAfter: StatusValues
  saveError: boolean
  onBack: () => void
}

export default function ResultScreen({ session, statusAfter, saveError, onBack }: Props) {
  const { ratings, statusBefore, syllabusRefs, scenario } = session
  const refs = Array.from(new Set(syllabusRefs)) // 重複排除

  return (
    <div data-testid="screen-result" className="min-h-screen bg-bg-base text-text-main flex flex-col items-center gap-5 p-6">
      <h1 className="text-2xl font-bold text-accent mt-4">シナリオクリア！</h1>
      <p className="text-text-muted">「{scenario.title}」</p>

      <div className="bg-surface border border-line rounded-xl p-4 w-full max-w-md">
        <p className="text-sm">
          あなたの判断： 最適 ✓{ratings.best} ／ 可 ○{ratings.good} ／ 要改善 △{ratings.poor}
        </p>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 w-full max-w-md">
        <p className="text-sm text-text-muted mb-3">成長（プレイ前 → 後）</p>
        {/* 数値非表示：メーター比較のみ（FT-006-004-TC-003） */}
        <StatusHud status={statusAfter} before={statusBefore} variant="compare" />
        {session.isReplay && (
          <p className="text-xs text-text-muted mt-3">※クリア済みシナリオのため成長は加算されません。</p>
        )}
      </div>

      {refs.length > 0 && (
        <div className="bg-surface border border-line rounded-xl p-4 w-full max-w-md">
          <p className="text-sm text-text-muted mb-2">学んだシラバス項番</p>
          <div className="flex flex-wrap gap-2">
            {refs.map((r) => (
              <span key={r} className="text-xs border border-line rounded px-2 py-1">
                FL {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {saveError && <p className="text-xs text-rating-poor">※進捗の保存に失敗しました。</p>}

      <Button variant="primary" onClick={onBack} data-testid="btn-back-select">
        章選択へ戻る
      </Button>
    </div>
  )
}
