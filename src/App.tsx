// ルート。useGame と各画面を配線。fetch と localStorage 書き込みは App 層の副作用で行う
//（reducer は純粋・設計書§6）。
import { useEffect, useState, useCallback } from 'react'
import { useGame } from './hooks/useGame'
import type { ScenarioIndexEntry } from './types'
import * as storage from './utils/storage'
import { loadIndex, loadScenario } from './utils/scenarioLoader'
import TitleScreen from './components/TitleScreen'
import SelectScreen from './components/SelectScreen'
import ScenarioPlayer from './components/player/ScenarioPlayer'
import ResultScreen from './components/ResultScreen'
import ErrorScreen from './components/ErrorScreen'

export default function App() {
  // 起動時に1回だけ localStorage を判定・読込（設計書§5.0）
  const [initial] = useState(() => {
    const avail = storage.isAvailable()
    const loaded = avail ? storage.load() : null
    return { avail, loaded }
  })
  const hasSave = initial.loaded !== null

  const [state, dispatch] = useGame(initial.loaded, initial.avail)
  const [pending, setPending] = useState<ScenarioIndexEntry | null>(null)
  const [saveError, setSaveError] = useState(false)

  // index.json をロード
  const loadIndexNow = useCallback(async () => {
    try {
      const idx = await loadIndex()
      dispatch({ type: 'INDEX_LOADED', index: idx })
    } catch (e) {
      console.error('[App] index ロード失敗:', e)
      dispatch({ type: 'INDEX_ERROR' })
    }
  }, [dispatch])

  useEffect(() => {
    void loadIndexNow()
  }, [loadIndexNow])

  // シナリオをロード（fetch＋検証）
  const loadScenarioNow = useCallback(
    async (entry: ScenarioIndexEntry) => {
      try {
        const scenario = await loadScenario(entry.file)
        const isReplay = Boolean(state.save.cleared[entry.id])
        dispatch({ type: 'SCENARIO_LOADED', scenario, isReplay })
      } catch (e) {
        console.error('[App] シナリオロード失敗:', e)
        dispatch({ type: 'SCENARIO_ERROR' })
      }
    },
    [dispatch, state.save.cleared],
  )

  const handleSelect = (entry: ScenarioIndexEntry) => {
    setPending(entry)
    dispatch({ type: 'SELECT_SCENARIO' })
    void loadScenarioNow(entry)
  }

  const handleRetry = () => {
    if (state.scenarioState === 'error' && pending) {
      dispatch({ type: 'RETRY_SCENARIO' })
      void loadScenarioNow(pending)
    } else {
      dispatch({ type: 'INDEX_ERROR' }) // 再ロード前に loading に戻す
      void loadIndexNow()
    }
  }

  // 結果画面到達時に保存（初回クリアのみ・オートセーブなし・設計書§5.7）
  useEffect(() => {
    if (state.screen === 'result' && state.session && !state.session.isReplay && state.storageAvailable) {
      try {
        storage.save(state.save)
        setSaveError(false)
      } catch (e) {
        console.error('[App] 保存失敗:', e)
        setSaveError(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen])

  // --- 描画 ---
  if (state.indexState === 'loading') {
    return <div className="min-h-screen bg-bg-base text-text-muted flex items-center justify-center">読み込み中…</div>
  }
  if (state.indexState === 'error') {
    return <ErrorScreen onRetry={handleRetry} />
  }
  // シナリオロード失敗はエラー画面（進捗は破壊しない）
  if (state.scenarioState === 'error') {
    return <ErrorScreen onRetry={handleRetry} />
  }
  if (state.scenarioState === 'loading') {
    return <div className="min-h-screen bg-bg-base text-text-muted flex items-center justify-center">読み込み中…</div>
  }

  switch (state.screen) {
    case 'title':
      return (
        <TitleScreen
          hasSave={hasSave}
          storageAvailable={state.storageAvailable}
          onStartNew={() => dispatch({ type: 'START_NEW' })}
          onContinue={() => dispatch({ type: 'CONTINUE' })}
        />
      )
    case 'select':
      return state.index ? (
        <SelectScreen index={state.index} save={state.save} onSelect={handleSelect} />
      ) : null
    case 'play':
      return state.session ? (
        <ScenarioPlayer
          session={state.session}
          status={state.save.status}
          onChoose={(index) => dispatch({ type: 'CHOOSE', index })}
          onAdvance={() => dispatch({ type: 'ADVANCE' })}
          onCloseFeedback={() => dispatch({ type: 'CLOSE_FEEDBACK' })}
          onFinish={() => dispatch({ type: 'FINISH' })}
          onQuit={() => dispatch({ type: 'QUIT' })}
        />
      ) : null
    case 'result':
      return state.session ? (
        <ResultScreen
          session={state.session}
          statusAfter={state.save.status}
          saveError={saveError}
          onBack={() => dispatch({ type: 'BACK_TO_SELECT' })}
        />
      ) : null
    default:
      return null
  }
}
