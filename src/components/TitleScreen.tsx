// FR-001 タイトル画面。設計書§5.1・§8.3。
import { useEffect, useState } from 'react'
import Button from './common/Button'
import ConfirmDialog from './common/ConfirmDialog'
import { ensureManifest } from '../utils/voice'

interface Props {
  hasSave: boolean
  storageAvailable: boolean
  onStartNew: () => void
  onContinue: () => void
}

export default function TitleScreen({ hasSave, storageAvailable, onStartNew, onContinue }: Props) {
  const [confirming, setConfirming] = useState(false)

  // 音声ライブラリの規約でクレジット表記が必須（zunko.jp は「アプリの場合は紹介画面などに記載」と明記）。
  // 表示するのは manifest に載っている＝実際に配信している音源だけなので、音声未導入なら何も出ない。
  const [credits, setCredits] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    void ensureManifest().then((m) => {
      if (alive) setCredits(m?.credits ?? [])
    })
    return () => {
      alive = false
    }
  }, [])

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

      {/* 文や名前の途中で改行しない（社内FB 2026-09-06）。
          区切りのある位置だけで折り返すため、意味のまとまりを nowrap で囲む。 */}
      <div data-testid="title-notes" className="text-center text-xs text-text-muted max-w-sm leading-relaxed [text-wrap:balance]">
        <p>
          <span className="whitespace-nowrap">※本作は非公式の学習教材であり、</span>
          <span className="whitespace-nowrap">JSTQB/ISTQB とは関係ありません。</span>
        </p>
        {!storageAvailable && (
          <p className="mt-1">
            <span className="whitespace-nowrap">※この環境では進捗が保存されません。</span>
          </p>
        )}
        {credits.length > 0 && (
          <p data-testid="voice-credits" className="mt-1">
            音声：
            {credits.map((c, i) => (
              // 区切りは前の名前にくっつける（「／」が行頭に落ちないようにする）
              <span key={c} data-testid="voice-credit" className="whitespace-nowrap">
                {c}
                {i < credits.length - 1 && '／'}
              </span>
            ))}
          </p>
        )}
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
