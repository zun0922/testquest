// FR-009 シナリオ検証（設計書 v1.1 §3.4 の12項目）
// 1件でもエラー級違反があれば ValidationError を throw する。
// #11（到達不能ノード）は警告のみ（console.warn・開始は許可）。
import {
  type SceneNode,
  type Choice,
  type CharacterDisplay,
  LIMITS,
} from '../types'

const RATINGS = ['best', 'good', 'poor']
const POSITIONS = ['left', 'right']
const CHARACTER_IDS = ['rin', 'tanaka', 'ken', 'takumi', 'mio'] // takumi/mio は AL 編（2026-07-03 追加）
const EXPRESSIONS = ['normal', 'happy', 'angry', 'sad', 'thinking']
const STATUS_KEYS_SET = ['knowledge', 'skill', 'confidence', 'teamwork']

export class ValidationError extends Error {
  violations: string[]
  constructor(violations: string[]) {
    super(`シナリオ検証エラー（${violations.length}件）`)
    this.name = 'ValidationError'
    this.violations = violations
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isString(v: unknown): v is string {
  return typeof v === 'string'
}
function isInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v)
}

/**
 * シナリオを検証する。エラー級違反があれば ValidationError を throw。
 * 到達不能ノード（#11）は警告として返し console.warn する。
 */
export function validateScenario(data: unknown): { warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // --- #1 必須フィールドの存在・型一致（トップレベル） ---
  if (!isObject(data)) {
    throw new ValidationError(['#1: シナリオがオブジェクトではありません'])
  }
  if (!isString(data.id)) errors.push('#1: id が文字列ではありません')
  if (!isString(data.title)) errors.push('#1: title が文字列ではありません')
  if (!isString(data.startNodeId)) errors.push('#1: startNodeId が文字列ではありません')
  if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
    // nodes が無ければ以降の検証は不能
    errors.push('#1: nodes が空または配列ではありません')
    throw new ValidationError(errors)
  }

  const rawNodes = data.nodes as unknown[]
  const nodes: SceneNode[] = []

  // 各ノードの構造（#1）を検証しつつ、後続検証用に型付けして収集
  rawNodes.forEach((raw, i) => {
    if (!isObject(raw)) {
      errors.push(`#1: nodes[${i}] がオブジェクトではありません`)
      return
    }
    const id = raw.id
    if (!isString(id)) errors.push(`#1: nodes[${i}].id が文字列ではありません`)
    if (raw.type !== 'text' && raw.type !== 'choice') {
      errors.push(`#1: nodes[${i}].type が 'text'|'choice' ではありません`)
    }
    if (!isString(raw.background)) errors.push(`#1: nodes[${i}].background が文字列ではありません`)
    if (!isString(raw.speaker)) errors.push(`#1: nodes[${i}].speaker が文字列ではありません`)
    if (!isString(raw.text)) errors.push(`#1: nodes[${i}].text が文字列ではありません`)
    if (!Array.isArray(raw.characters)) {
      errors.push(`#1: nodes[${i}].characters が配列ではありません`)
    }
    if (raw.type === 'text') {
      if (!(isString(raw.next) || raw.next === null)) {
        errors.push(`#1: nodes[${i}].next が string|null ではありません`)
      }
    } else if (raw.type === 'choice') {
      if (!Array.isArray(raw.choices)) {
        errors.push(`#1: nodes[${i}].choices が配列ではありません`)
      }
    }
    nodes.push(raw as unknown as SceneNode)
  })

  // 構造が壊れている場合はここで打ち切る（参照系の検証が誤作動するため）
  if (errors.length > 0) {
    throw new ValidationError(errors)
  }

  const ids = nodes.map((n) => n.id)

  // --- #2 ノードIDの一意性 ---
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) errors.push(`#2: ノードID '${id}' が重複しています`)
    seen.add(id)
  }
  const idSet = new Set(ids)

  // --- #3 startNodeId・各 next の参照先が存在 ---
  if (!idSet.has(data.startNodeId as string)) {
    errors.push(`#3: startNodeId '${data.startNodeId}' のノードが存在しません`)
  }
  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.next !== null && !idSet.has(node.next)) {
        errors.push(`#3: nodes '${node.id}'.next '${node.next}' のノードが存在しません`)
      }
    } else {
      for (const c of node.choices) {
        if (!idSet.has(c.next)) {
          errors.push(`#3: choice.next '${c?.next}' のノードが存在しません（nodes '${node.id}'）`)
        }
      }
    }
  }

  // ノード単位の検証（#4〜#9）
  let choiceNodeCount = 0
  for (const node of nodes) {
    // --- #5 text 長 ---
    if (node.text.length > LIMITS.TEXT_MAX) {
      errors.push(`#5: nodes '${node.id}'.text が ${LIMITS.TEXT_MAX} 文字を超えています`)
    }
    // --- #8 characters 0〜2体・position 重複なし ---
    const chars = node.characters as CharacterDisplay[]
    if (chars.length > LIMITS.CHARACTERS_MAX) {
      errors.push(`#8: nodes '${node.id}'.characters が ${LIMITS.CHARACTERS_MAX} 体を超えています`)
    }
    const positions = new Set<string>()
    for (const ch of chars) {
      if (!isObject(ch) || !CHARACTER_IDS.includes(ch.characterId as string)) {
        errors.push(`#1: nodes '${node.id}' の characters に不正な characterId があります`)
      }
      if (!isObject(ch) || !EXPRESSIONS.includes(ch.expression as string)) {
        errors.push(`#1: nodes '${node.id}' の characters に不正な expression があります`)
      }
      if (!isObject(ch) || !POSITIONS.includes(ch.position as string)) {
        errors.push(`#1: nodes '${node.id}' の characters に不正な position があります`)
      } else {
        if (positions.has(ch.position)) {
          errors.push(`#8: nodes '${node.id}' で position '${ch.position}' が重複しています`)
        }
        positions.add(ch.position)
      }
    }
    // --- #9 speaker が characters に存在 or narration ---
    if (node.speaker !== 'narration') {
      const speakerInChars = chars.some((c) => c?.characterId === node.speaker)
      if (!speakerInChars) {
        errors.push(`#9: nodes '${node.id}'.speaker '${node.speaker}' が characters にも narration にも該当しません`)
      }
    }

    if (node.type === 'choice') {
      choiceNodeCount++
      const choices = node.choices as Choice[]
      // --- #4 選択肢数 2〜3 ---
      if (choices.length < LIMITS.CHOICES_MIN || choices.length > LIMITS.CHOICES_MAX) {
        errors.push(`#4: nodes '${node.id}' の選択肢数が ${LIMITS.CHOICES_MIN}〜${LIMITS.CHOICES_MAX} ではありません（${choices.length}）`)
      }
      for (const c of choices) {
        if (!isObject(c)) {
          errors.push(`#1: nodes '${node.id}' に不正な選択肢があります`)
          continue
        }
        // --- #5 choice.text・explanation 長 ---
        if (!isString(c.text) || c.text.length > LIMITS.CHOICE_TEXT_MAX) {
          errors.push(`#5: nodes '${node.id}' の選択肢 text が不正または ${LIMITS.CHOICE_TEXT_MAX} 文字超です`)
        }
        if (!RATINGS.includes(c.rating as string)) {
          errors.push(`#1: nodes '${node.id}' の選択肢 rating が不正です`)
        }
        // --- #6 statusEffects 1キー以上・各値 整数1〜5 ---
        if (!isObject(c.statusEffects)) {
          errors.push(`#6: nodes '${node.id}' の statusEffects がオブジェクトではありません`)
        } else {
          const keys = Object.keys(c.statusEffects)
          if (keys.length < 1) {
            errors.push(`#6: nodes '${node.id}' の statusEffects が空です（1キー以上必須）`)
          }
          for (const k of keys) {
            const val = (c.statusEffects as Record<string, unknown>)[k]
            if (!STATUS_KEYS_SET.includes(k)) {
              errors.push(`#6: nodes '${node.id}' の statusEffects に不正なキー '${k}' があります`)
            }
            if (!isInteger(val) || (val as number) < LIMITS.STATUS_EFFECT_MIN || (val as number) > LIMITS.STATUS_EFFECT_MAX) {
              errors.push(`#6: nodes '${node.id}' の statusEffects['${k}'] が整数 ${LIMITS.STATUS_EFFECT_MIN}〜${LIMITS.STATUS_EFFECT_MAX} ではありません`)
            }
          }
        }
        // --- #1/#5/#7 feedback ---
        if (!isObject(c.feedback)) {
          errors.push(`#1: nodes '${node.id}' の選択肢に feedback がありません`)
        } else {
          const explanation = c.feedback.explanation
          if (!isString(explanation) || explanation.length > LIMITS.EXPLANATION_MAX) {
            errors.push(`#5: nodes '${node.id}' の explanation が不正または ${LIMITS.EXPLANATION_MAX} 文字超です`)
          }
          const refs = c.feedback.syllabusRefs
          // --- #7 syllabusRefs 1件以上 ---
          if (!Array.isArray(refs) || refs.length < 1) {
            errors.push(`#7: nodes '${node.id}' の syllabusRefs が1件以上ありません`)
          }
        }
        if (!isString(c.next)) {
          errors.push(`#1: nodes '${node.id}' の選択肢 next が文字列ではありません`)
        }
      }
    }
  }

  // --- #10 選択肢ノード数 3〜5 ---
  if (choiceNodeCount < LIMITS.CHOICE_NODES_MIN || choiceNodeCount > LIMITS.CHOICE_NODES_MAX) {
    errors.push(`#10: choice ノード数が ${LIMITS.CHOICE_NODES_MIN}〜${LIMITS.CHOICE_NODES_MAX} ではありません（${choiceNodeCount}）`)
  }

  // --- #12 最終ノード（next:null）が1つ以上存在 ---
  const hasFinal = nodes.some((n) => n.type === 'text' && n.next === null)
  if (!hasFinal) {
    errors.push('#12: 最終ノード（next:null の text ノード）が存在しません')
  }

  // --- #11 到達不能ノード（警告のみ） ---
  const reachable = computeReachable(nodes, data.startNodeId as string, idSet)
  for (const id of ids) {
    if (!reachable.has(id)) {
      warnings.push(`#11: ノード '${id}' は startNodeId から到達不能です`)
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors)
  }

  if (warnings.length > 0) {
    // 開始は許可するが警告を出す
    console.warn('[validator] 到達不能ノード:', warnings)
  }

  return { warnings }
}

/** startNodeId から到達可能なノードIDの集合を返す（#11 用）。 */
function computeReachable(nodes: SceneNode[], startNodeId: string, idSet: Set<string>): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const reachable = new Set<string>()
  if (!idSet.has(startNodeId)) return reachable
  const stack = [startNodeId]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (reachable.has(id)) continue
    reachable.add(id)
    const node = byId.get(id)
    if (!node) continue
    if (node.type === 'text') {
      if (node.next !== null && idSet.has(node.next)) stack.push(node.next)
    } else {
      for (const c of node.choices) {
        if (idSet.has(c.next)) stack.push(c.next)
      }
    }
  }
  return reachable
}
