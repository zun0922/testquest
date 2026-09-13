// FR-002 章・シナリオ選択。設計書§5.2・§8.3（v1.2：レベル別セクション／v1.3：折り畳み）。
// レベル→章の2階層をデータ駆動で表示。AL は FL 全章クリアで解放（企画書§5.5）。
// 全71本が一列に並ぶと縦スクロール量が過大になるため、レベル・章を折り畳み可能にする（PO要望 2026-07-25）。
import { useEffect, useMemo, useState } from 'react'
import { type ScenarioIndex, type ScenarioIndexEntry, type SaveDataV1 } from '../types'
import {
  LEVELS,
  chapterProgress,
  findContinueChapter,
  isAlUnlocked,
  levelProgress,
  type LevelDef,
} from '../utils/levels'
import {
  chapterOpenKey,
  levelOpenKey,
  loadOverrides,
  saveOverrides,
  type OpenOverrides,
} from '../utils/uiState'
import StatusHud from './common/StatusHud'
import CastingPicker from './common/CastingPicker'

interface Props {
  index: ScenarioIndex
  save: SaveDataV1
  onSelect: (entry: ScenarioIndexEntry) => void
  /** FR-P2-002：エンディング一覧へ。到達が1件以上あるときだけ入口を出す。 */
  onOpenEndings: () => void
}

// 開発・テスト用の解放フック（テストデータ原則：devモード限定・本番ビルドでは無効）
function devUnlockAll(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('unlockAll') === '1'
}

export default function SelectScreen({ index, save, onSelect, onOpenEndings }: Props) {
  const endingCount = Object.keys(save.endings ?? {}).length
  const alUnlocked = isAlUnlocked(index, save) || devUnlockAll()
  // ユーザーが明示的に開閉した節のみを保持（未操作の節は「続きの章」自動判定に従う）
  const [overrides, setOverrides] = useState<OpenOverrides>(loadOverrides)

  useEffect(() => {
    // 未操作（空）のうちは書き込まない＝初回訪問で無用なキーを作らない
    if (Object.keys(overrides).length > 0) saveOverrides(overrides)
  }, [overrides])

  const continueTarget = useMemo(
    () => findContinueChapter(index, save, alUnlocked),
    [index, save, alUnlocked],
  )

  // 自動判定：続きの章とその親レベルだけを開く（全クリア時は先頭レベルの見出しのみ）
  const autoLevelOpen = (lv: LevelDef): boolean =>
    continueTarget ? continueTarget.level === lv.key : lv.key === LEVELS[0].key
  const autoChapterOpen = (lv: LevelDef, chapter: number): boolean =>
    continueTarget?.level === lv.key && continueTarget.chapter === chapter

  const isOpen = (key: string, auto: boolean): boolean => overrides[key] ?? auto
  const toggle = (key: string, auto: boolean): void =>
    setOverrides((prev) => ({ ...prev, [key]: !(prev[key] ?? auto) }))

  return (
    <div data-testid="screen-select" className="min-h-screen bg-bg-base text-text-main p-5">
      <div className="flex items-start justify-between mb-5">
        <h1 className="text-xl font-bold text-accent">TestQuest</h1>
        <div className="flex items-center gap-2">
          {endingCount > 0 && (
            <button
              data-testid="btn-endings"
              onClick={onOpenEndings}
              className="text-xs px-3 py-2 rounded-lg border border-cleared/60 bg-cleared/10 text-cleared hover:border-cleared transition focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
            >
              エンディング
            </button>
          )}
          <StatusHud status={save.status} />
        </div>
      </div>

      {LEVELS.map((lv) => {
        const levelScenarios = index.scenarios.filter((s) => s.level === lv.key)
        const locked = lv.key !== 'FL' && !alUnlocked
        const lvKey = levelOpenKey(lv.slug)
        const lvAuto = autoLevelOpen(lv)
        const lvOpen = isOpen(lvKey, lvAuto)
        const lvProgress = levelProgress(index, save, lv.key)

        return (
          <section key={lv.key} data-testid={`level-${lv.slug}`} className="mb-6">
            <h2 className="border-b border-line mb-3">
              <button
                type="button"
                data-testid={`level-toggle-${lv.slug}`}
                onClick={() => toggle(lvKey, lvAuto)}
                aria-expanded={lvOpen}
                // 閉じている間は body 要素を描画しないため参照も付けない
                aria-controls={lvOpen ? `level-body-${lv.slug}` : undefined}
                className="w-full flex items-center gap-2 text-left pb-1 hover:text-accent transition focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
              >
                <span aria-hidden className="text-text-muted text-xs w-3">
                  {lvOpen ? '▼' : '▶'}
                </span>
                <span className="flex-1 text-base font-bold text-accent/90">{lv.heading}</span>
                <span className="text-xs text-text-muted">
                  {locked ? '🔒' : `${lvProgress.cleared}/${lvProgress.total} クリア`}
                </span>
              </button>
            </h2>

            {lvOpen && (
              <div id={`level-body-${lv.slug}`}>
                {/* FR-P2-003 編成パターン。差し替えるのは技術メンター役なので AL-TTA の節にだけ置く。
                    章の途中では変えられないよう、プレイ中ではなくこの選択画面に置いている（企画書§9.1）。 */}
                {!locked && lv.key === 'AL-TTA' && <CastingPicker />}
                {locked ? (
                  <div
                    data-testid={`lock-${lv.slug}`}
                    className="opacity-50 border border-line rounded-xl p-4"
                    aria-disabled
                  >
                    🔒 Foundation Level の全章クリアで解放されます
                  </div>
                ) : (
                  lv.chapters.map((n) => {
                    const scenarios = levelScenarios
                      .filter((s) => s.chapter === n)
                      .sort((a, b) => a.order - b.order)
                    // FL は歴史的経緯で chapter-{n}、AL は chapter-{slug}-{n}（既存E2E・スクショとの互換）
                    const chapterTestId = lv.key === 'FL' ? `chapter-${n}` : `chapter-${lv.slug}-${n}`

                    if (scenarios.length === 0) {
                      return (
                        <div
                          key={n}
                          data-testid={chapterTestId}
                          className="opacity-40 grayscale pointer-events-none border border-line rounded-xl p-3 mb-2"
                          aria-disabled
                        >
                          第{n}章　{lv.titles[n] ?? ''}（制作中）
                        </div>
                      )
                    }

                    const chKey = chapterOpenKey(lv.slug, n)
                    const chAuto = autoChapterOpen(lv, n)
                    const chOpen = isOpen(chKey, chAuto)
                    const p = chapterProgress(index, save, lv.key, n)
                    const chapterCleared = p.cleared === p.total

                    return (
                      <div key={n} className="mb-2">
                        <h3>
                          <button
                            type="button"
                            data-testid={`chapter-toggle-${lv.slug}-${n}`}
                            onClick={() => toggle(chKey, chAuto)}
                            aria-expanded={chOpen}
                            aria-controls={chOpen ? `chapter-body-${lv.slug}-${n}` : undefined}
                            className="w-full flex items-baseline gap-2 text-left p-2 rounded-lg hover:bg-surface transition focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
                          >
                            <span aria-hidden className="text-text-muted text-xs w-3">
                              {chOpen ? '▼' : '▶'}
                            </span>
                            <span className="flex-1 font-bold">
                              第{n}章　{lv.titles[n] ?? ''}
                            </span>
                            {/* 章の全クリアは明るい緑（PO判断 2026-07-25）。色だけに頼らず ✓ を併記（§7.1） */}
                            <span
                              className={`text-xs whitespace-nowrap ${
                                chapterCleared ? 'text-cleared' : 'text-text-muted'
                              }`}
                            >
                              {chapterCleared ? `✓ ${p.total}/${p.total}` : `${p.cleared}/${p.total}`}
                            </span>
                          </button>
                        </h3>

                        {chOpen && (
                          <div
                            id={`chapter-body-${lv.slug}-${n}`}
                            data-testid={chapterTestId}
                            className="flex flex-col gap-2 mt-2 mb-4 pl-5"
                          >
                            {scenarios.map((s) => {
                              const cleared = Boolean(save.cleared[s.id])
                              return (
                                <button
                                  key={s.id}
                                  data-testid={`scenario-item-${s.id}`}
                                  onClick={() => onSelect(s)}
                                  className="text-left bg-surface border border-line rounded-xl p-4 hover:border-accent transition focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent"
                                >
                                  <div className="font-bold">{s.title}</div>
                                  <div className="text-xs text-text-muted mt-1">
                                    {cleared && (
                                      <span className="text-cleared">✓ クリア済み ・ </span>
                                    )}
                                    約{s.estimatedMinutes}分
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
