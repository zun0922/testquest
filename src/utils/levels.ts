// レベル（FL / AL-TM / AL-TTA）の定義と解放判定。設計書 v1.2 §5.2（レベル別セクション）。
import { type ScenarioIndex, type SaveDataV1 } from '../types'

export type LevelKey = 'FL' | 'AL-TM' | 'AL-TTA'

export interface LevelDef {
  key: LevelKey
  slug: string // data-testid・パス用（'fl' | 'al-tm' | 'al-tta'）
  heading: string
  chapters: number[]
  titles: Record<number, string>
}

// 章タイトルの正：FL＝FLシラバスV4.0／AL＝企画書§5.2.1・§5.3.1（シラバス章題準拠）
export const LEVELS: LevelDef[] = [
  {
    key: 'FL',
    slug: 'fl',
    heading: 'Foundation Level',
    chapters: [1, 2, 3, 4, 5, 6],
    titles: {
      1: 'テストの基礎',
      2: 'ソフトウェア開発ライフサイクル全体を通してのテスト',
      3: '静的テスト',
      4: 'テスト分析と設計',
      5: 'テスト活動のマネジメント',
      6: 'テストツール',
    },
  },
  {
    key: 'AL-TM',
    slug: 'al-tm',
    heading: 'Advanced Level：テストマネジメント',
    chapters: [1, 2, 3],
    titles: {
      1: 'テスト活動のマネジメント',
      2: 'プロダクトのマネジメント',
      3: 'チームのマネジメント',
    },
  },
  {
    key: 'AL-TTA',
    slug: 'al-tta',
    heading: 'Advanced Level：テクニカルテストアナリスト',
    chapters: [1, 2, 3, 4, 5, 6],
    titles: {
      1: 'リスクベースドテストにおけるテクニカルテストアナリストのタスク',
      2: 'ホワイトボックステスト技法',
      3: '静的解析と動的解析',
      4: 'テクニカルテストのための品質特性',
      5: 'レビュー',
      6: 'テストツールと自動化',
    },
  },
]

/**
 * AL 解放判定（企画書§5.5：FL全章クリアで AL 全種を一斉解放）。
 * index 上の FL シナリオがすべて save.cleared に存在すれば解放。
 */
export function isAlUnlocked(index: ScenarioIndex, save: SaveDataV1): boolean {
  const fl = index.scenarios.filter((s) => s.level === 'FL')
  return fl.length > 0 && fl.every((s) => Boolean(save.cleared[s.id]))
}
