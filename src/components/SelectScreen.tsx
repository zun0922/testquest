// FR-002 章・シナリオ選択。設計書§5.2・§8.3（v1.2：レベル別セクション・AL解放）。
// レベル→章の2階層をデータ駆動で表示。AL は FL 全章クリアで解放（企画書§5.5）。
import { type ScenarioIndex, type ScenarioIndexEntry, type SaveDataV1 } from '../types'
import { LEVELS, isAlUnlocked } from '../utils/levels'
import StatusHud from './common/StatusHud'

interface Props {
  index: ScenarioIndex
  save: SaveDataV1
  onSelect: (entry: ScenarioIndexEntry) => void
}

// 開発・テスト用の解放フック（テストデータ原則：devモード限定・本番ビルドでは無効）
function devUnlockAll(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('unlockAll') === '1'
}

export default function SelectScreen({ index, save, onSelect }: Props) {
  const alUnlocked = isAlUnlocked(index, save) || devUnlockAll()

  return (
    <div data-testid="screen-select" className="min-h-screen bg-bg-base text-text-main p-5">
      <div className="flex items-start justify-between mb-5">
        <h1 className="text-xl font-bold text-accent">TestQuest</h1>
        <StatusHud status={save.status} />
      </div>

      {LEVELS.map((lv) => {
        const levelScenarios = index.scenarios.filter((s) => s.level === lv.key)
        const locked = lv.key !== 'FL' && !alUnlocked

        return (
          <section key={lv.key} data-testid={`level-${lv.slug}`} className="mb-8">
            <h2 className="text-base font-bold text-accent/90 border-b border-line pb-1 mb-3">
              {lv.heading}
            </h2>

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

                return (
                  <div key={n} className="mb-6">
                    <h3 className="text-lg font-bold mb-3">
                      第{n}章　{lv.titles[n] ?? ''}
                    </h3>
                    <div data-testid={chapterTestId} className="flex flex-col gap-2">
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
                              {cleared ? '✓ クリア済み ・ ' : ''}約{s.estimatedMinutes}分
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </section>
        )
      })}
    </div>
  )
}
