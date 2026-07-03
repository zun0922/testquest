// FR-001 タイトル画面。設計書§5.1・§8.3。
import { useState } from 'react'
import Button from './common/Button'
import ConfirmDialog from './common/ConfirmDialog'

interface Props {
  hasSave: boolean
  storageAvailable: boolean
  onStartNew: () => void
  onContinue: () => void
}

export default function TitleScreen({ hasSave, storageAvailable, onStartNew, onContinue }: Props) {
  const [confirming, setConfirming] = useState(false)

  const handleStart = () => {
    if (hasSave) setConfirming(true) // 既存進捗あり → 上書き確認（AC-002）
    else onStartNew()
  }

  return (
    <div data-testid="screen-title" className="min-h-screen bg-bg-base text-text-main flex flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-accent">TestQuest</h1>
        <p className="text-text-muted mt-2 text-sm">〜あなたの選択が、テストキャリアをつくる〜</p>
      </div>

      <div className="flex flex-col gap-3 w-56">
        <Button variant="primary" onClick={handleStart} data-testid="btn-start">
          はじめから
        </Button>
        <Button onClick={onContinue} disabled={!hasSave} data-testid="btn-continue">
          つづきから
        </Button>
      </div>

      <div className="text-center text-xs text-text-muted max-w-sm leading-relaxed">
        <p>※本作は非公式の学習教材であり、JSTQB/ISTQB とは関係ありません。</p>
        {!storageAvailable && <p className="mt-1">※この環境では進捗が保存されません。</p>}
      </div>

      {confirming && (
        <ConfirmDialog
          message="進捗が削除されます。よろしいですか？"
          confirmTestId="btn-overwrite-ok"
          onConfirm={() => {
            setConfirming(false)
            onStartNew()
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
