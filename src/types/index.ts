// 設計書 v1.1 §3 データ構造定義に準拠

// ===== 3.1 基本型 =====
export type StatusKey = 'knowledge' | 'skill' | 'confidence' | 'teamwork'
export type StatusValues = Record<StatusKey, number> // 各 0〜100 の整数

export const STATUS_KEYS: StatusKey[] = ['knowledge', 'skill', 'confidence', 'teamwork']

export const INITIAL_STATUS: StatusValues = {
  knowledge: 10,
  skill: 10,
  confidence: 10,
  teamwork: 10,
} // 要件 FR-006

export const STATUS_MIN = 0
export const STATUS_MAX = 100

export type Rating = 'best' | 'good' | 'poor' // 最適／可／要改善（FR-005）

export type CharacterId = 'rin' | 'tanaka' | 'ken' | 'takumi' | 'mio' // takumi/mio は AL 編（設定書 v1.4 §4.4〜4.5）
export type Expression = 'normal' | 'happy' | 'angry' | 'sad' | 'thinking'
export type Position = 'left' | 'right'

// ===== 3.2 シナリオデータ =====
export interface ScenarioIndex {
  version: 1
  scenarios: ScenarioIndexEntry[]
}
export interface ScenarioIndexEntry {
  id: string // 'fl-1-01' / 'al-tm-1-01' 形式
  title: string
  level: 'FL' | 'AL-TM' | 'AL-TTA' // Phase 3 で AL を追加（2026-07-03）
  chapter: number // FL=1〜6・AL-TM=1〜3・AL-TTA=1〜6（章番号は level 内で解釈する）
  order: number // 章内の表示順（FR-002 は order 昇順）
  estimatedMinutes: number
  file: string // 'fl-1/fl-1-01.json'
}

export interface Scenario {
  id: string
  title: string
  startNodeId: string
  nodes: SceneNode[]
}

export type SceneNode = TextNode | ChoiceNode

export interface NodeBase {
  id: string
  background: string
  characters: CharacterDisplay[] // 0〜2体（UI-RULE-004）
  speaker: CharacterId | 'narration'
  text: string // 最大200文字（UI-RULE-002）
}
export interface TextNode extends NodeBase {
  type: 'text'
  next: string | null // null＝最終シーン（結果画面へ）
}
export interface ChoiceNode extends NodeBase {
  type: 'choice'
  choices: Choice[] // 2〜3個（UI-RULE-003）
  /**
   * FR-P2-007 ヒント文（省略可）。**答えを示さず、判断の観点だけ**を示す1〜2文。
   * 強調（Choice.emphasis）が「どこを見るか」を示すのに対し、こちらは「何を考えるか」を示す。
   */
  hint?: string
}

export interface CharacterDisplay {
  characterId: CharacterId
  expression: Expression
  position: Position // 同一 position の重複は検証エラー
}

export interface Choice {
  text: string // 最大40文字
  rating: Rating
  /**
   * FR-P2-007 ヒント用の強調範囲（省略可）。`text` 内の部分文字列を指定する。
   * 本文（text）は変更せず別フィールドで持つことで、監修済みの文面を不変に保つ。
   * 省略された選択肢ではヒントを出さない（章単位の段階導入を可能にするため）。
   */
  emphasis?: string[]
  statusEffects: Partial<Record<StatusKey, number>> // 値は1〜5・1キー以上必須（減算なし）
  feedback: Feedback
  next: string // 分岐先ノードID
}

export interface Feedback {
  explanation: string // 最大400文字
  syllabusRefs: string[] // 例 ['1.3']。1件以上必須
}

// ===== 3.2.1 エンディングデータ（FR-P2-002・public/data/endings.json） =====
/** エンディングの1行。演出の構成部品はシナリオのノードと揃える（同じ描画を流用するため）。 */
export interface EndingLine {
  speaker: CharacterId | 'narration'
  characters: CharacterDisplay[]
  text: string
}

export interface EndingDef {
  id: string
  scope: 'FL' | 'AL-TM' | 'AL-TTA' | 'ALL'
  name: string
  subtitle: string
  background: string
  lines: EndingLine[]
}

export interface EndingsData {
  version: 1
  endings: EndingDef[]
}

// ===== 3.3 進捗データ（localStorage） =====
export interface SaveDataV1 {
  version: 1
  status: StatusValues
  cleared: Record<string, ClearRecord> // key＝シナリオID
  /**
   * 到達したエンディング（FR-P2-002）。key＝エンディングID・値＝到達日時(ISO 8601)。
   * 省略可（既存セーブは空として扱う）。一度到達したら消えない＝コレクション要素。
   */
  endings?: Record<string, string>
}
export interface ClearRecord {
  clearedAt: string // ISO 8601
  ratings: Record<Rating, number>
  statusGain: Partial<Record<StatusKey, number>> // poor を含む累積（表示用）
  /**
   * FR-P2-002 エンディング判定用の累積。**poor を選んで得た分は含めない**。
   * poor でも知識が大量に入る構造のため、これを分けないとエンディングが分岐しない。
   * 省略可（この記録が無い章は判定から除外する＝PO決定 2026-08-30）。
   */
  cleanGain?: Partial<Record<StatusKey, number>>
}

// ===== 制約値（検証・UIで共有） =====
export const LIMITS = {
  TEXT_MAX: 200, // UI-RULE-002
  CHOICE_TEXT_MAX: 40,
  EXPLANATION_MAX: 400,
  CHOICES_MIN: 2, // 1選択肢ノード内の選択肢数
  CHOICES_MAX: 3,
  CHOICE_NODES_MIN: 3, // シナリオ内の choice ノード数（要件6.1）
  CHOICE_NODES_MAX: 5,
  CHARACTERS_MAX: 2,
  EMPHASIS_MAX: 2, // 1選択肢あたりの強調語数（多いと論点がぼやける・FR-P2-007）
  HINT_MAX: 100, // ヒント文の最大文字数（読む負担を抑える・FR-P2-007）
  STATUS_EFFECT_MIN: 1,
  STATUS_EFFECT_MAX: 5,
} as const
