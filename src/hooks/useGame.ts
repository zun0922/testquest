// ルート状態管理（設計書 v1.1 §6）。reducer は純粋関数。
// localStorage 書き込みは App 層の副作用で行う（rules/common/react/state-side-effects.md）。
import { useReducer } from 'react'
import {
  type Scenario,
  type ScenarioIndex,
  type ScenarioIndexEntry,
  type Choice,
  type ChoiceNode,
  type Rating,
  type SaveDataV1,
  type StatusValues,
  type StatusKey,
  type ClearRecord,
  INITIAL_STATUS,
} from '../types'
import { applyStatusEffects } from '../utils/status'

export type Screen = 'title' | 'select' | 'play' | 'result'
export type LoadState = 'loading' | 'success' | 'error'

export interface PlaySession {
  scenario: Scenario
  /** シナリオのレベル。ヒントの閾値がレベル別のため保持する（FR-P2-007）。 */
  level: ScenarioIndexEntry['level']
  nodeId: string
  isReplay: boolean
  ratings: Record<Rating, number>
  statusGain: Partial<Record<StatusKey, number>> // 当該プレイの累積効果（表示用）
  statusBefore: StatusValues // シナリオ開始前のスナップショット（結果比較・QUIT復元）
  syllabusRefs: string[] // 通過した選択の参照項番（結果画面で重複排除して表示）
  feedbackChoice: Choice | null
}

export interface GameState {
  screen: Screen
  save: SaveDataV1
  storageAvailable: boolean
  index: ScenarioIndex | null
  indexState: LoadState
  scenarioState: 'idle' | 'loading' | 'error'
  session: PlaySession | null
}

const ZERO_RATINGS: Record<Rating, number> = { best: 0, good: 0, poor: 0 }

export type GameAction =
  | { type: 'INDEX_LOADED'; index: ScenarioIndex }
  | { type: 'INDEX_ERROR' }
  | { type: 'START_NEW' }
  | { type: 'CONTINUE' }
  | { type: 'SELECT_SCENARIO' } // ロード開始（App が fetch）
  | { type: 'SCENARIO_LOADED'; scenario: Scenario; isReplay: boolean; level: ScenarioIndexEntry['level'] }
  | { type: 'SCENARIO_ERROR' }
  | { type: 'RETRY_SCENARIO' }
  | { type: 'ADVANCE' }
  | { type: 'CHOOSE'; index: number }
  | { type: 'CLOSE_FEEDBACK' }
  | { type: 'FINISH' }
  | { type: 'QUIT' }
  | { type: 'BACK_TO_SELECT' }

function freshSave(): SaveDataV1 {
  return { version: 1, status: { ...INITIAL_STATUS }, cleared: {} }
}

export function createInitialState(loaded: SaveDataV1 | null, storageAvailable: boolean): GameState {
  return {
    screen: 'title',
    save: loaded ?? freshSave(),
    storageAvailable,
    index: null,
    indexState: 'loading',
    scenarioState: 'idle',
    session: null,
  }
}

function currentNode(session: PlaySession) {
  return session.scenario.nodes.find((n) => n.id === session.nodeId)
}

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'INDEX_LOADED':
      return { ...state, index: action.index, indexState: 'success' }
    case 'INDEX_ERROR':
      return { ...state, indexState: 'error' }

    case 'START_NEW':
      // 進捗を初期化して章選択へ（設計書§5.1）
      return { ...state, save: freshSave(), screen: 'select', session: null }
    case 'CONTINUE':
      return { ...state, screen: 'select', session: null }

    case 'SELECT_SCENARIO':
      return { ...state, scenarioState: 'loading' }
    case 'SCENARIO_LOADED': {
      const session: PlaySession = {
        scenario: action.scenario,
        level: action.level,
        nodeId: action.scenario.startNodeId,
        isReplay: action.isReplay,
        ratings: { ...ZERO_RATINGS },
        statusGain: {},
        statusBefore: { ...state.save.status },
        syllabusRefs: [],
        feedbackChoice: null,
      }
      return { ...state, screen: 'play', scenarioState: 'idle', session }
    }
    case 'SCENARIO_ERROR':
      return { ...state, scenarioState: 'error' }
    case 'RETRY_SCENARIO':
      return { ...state, scenarioState: 'loading' }

    case 'ADVANCE': {
      if (!state.session) return state
      const node = currentNode(state.session)
      if (!node || node.type !== 'text' || node.next === null) return state
      return { ...state, session: { ...state.session, nodeId: node.next } }
    }

    case 'CHOOSE': {
      if (!state.session) return state
      const node = currentNode(state.session)
      if (!node || node.type !== 'choice') return state
      const choice = (node as ChoiceNode).choices[action.index]
      if (!choice) return state

      const ratings = { ...state.session.ratings }
      ratings[choice.rating] = ratings[choice.rating] + 1

      // 当該プレイの累積効果（表示用・結果集計用）
      const statusGain = { ...state.session.statusGain }
      for (const k of Object.keys(choice.statusEffects) as StatusKey[]) {
        const d = choice.statusEffects[k]
        if (d === undefined) continue
        statusGain[k] = (statusGain[k] ?? 0) + d
      }

      // 再プレイでなければ実ステータスに加算（クランプ）。再プレイは status 不変（FR-002）
      const save = state.session.isReplay
        ? state.save
        : { ...state.save, status: applyStatusEffects(state.save.status, choice.statusEffects) }

      const syllabusRefs = [...state.session.syllabusRefs, ...choice.feedback.syllabusRefs]

      return {
        ...state,
        save,
        session: { ...state.session, ratings, statusGain, syllabusRefs, feedbackChoice: choice },
      }
    }

    case 'CLOSE_FEEDBACK': {
      if (!state.session || !state.session.feedbackChoice) return state
      return {
        ...state,
        session: { ...state.session, nodeId: state.session.feedbackChoice.next, feedbackChoice: null },
      }
    }

    case 'FINISH': {
      if (!state.session) return state
      // 初回クリアのみ ClearRecord を記録（再プレイは初回記録を上書きしない・設計書§5.7）
      let save = state.save
      const id = state.session.scenario.id
      if (!state.session.isReplay && !state.save.cleared[id]) {
        const record: ClearRecord = {
          clearedAt: new Date().toISOString(),
          ratings: { ...state.session.ratings },
          statusGain: { ...state.session.statusGain },
        }
        save = { ...state.save, cleared: { ...state.save.cleared, [id]: record } }
      }
      return { ...state, save, screen: 'result' }
    }

    case 'QUIT': {
      // 途中中断：進捗をシナリオ開始前に戻す（設計書§5.3）
      if (!state.session) return { ...state, screen: 'select' }
      return {
        ...state,
        save: { ...state.save, status: { ...state.session.statusBefore } },
        session: null,
        screen: 'select',
      }
    }

    case 'BACK_TO_SELECT':
      return { ...state, session: null, screen: 'select' }

    default:
      return state
  }
}

export function useGame(loaded: SaveDataV1 | null, storageAvailable: boolean) {
  return useReducer(reducer, createInitialState(loaded, storageAvailable))
}
