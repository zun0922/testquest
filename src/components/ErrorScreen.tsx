// FR-009 ロードエラー画面。設計書§5.9。
// 技術詳細（スタックトレース・検証違反一覧）はユーザー画面に出さない（console.error 側のみ）。
import Button from './common/Button'

interface Props {
  onRetry: () => void
}

export default function ErrorScreen({ onRetry }: Props) {
  return (
    <div data-testid="screen-error" className="min-h-screen bg-bg-base text-text-main flex flex-col items-center justify-center gap-5 px-6">
      <p className="text-center">シナリオデータの読み込みに失敗しました。</p>
      <Button variant="primary" onClick={onRetry} data-testid="btn-reload">
        再読み込み
      </Button>
    </div>
  )
}
