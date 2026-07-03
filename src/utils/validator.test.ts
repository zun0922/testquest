import { describe, it, expect, vi } from 'vitest'
import { validateScenario, ValidationError } from './validator'
import type { Scenario } from '../types'

// すべての検証を通る基準シナリオ（choice ノード3本＋最終 text ノード1本）。
// 各TCはこれを複製して1点だけ壊す。
function makeValidScenario(): Scenario {
  const choiceNode = (id: string, next: string): Scenario['nodes'][number] => ({
    id,
    type: 'choice',
    background: 'office',
    characters: [],
    speaker: 'narration',
    text: 'これはテスト用のシーンです。',
    choices: [
      {
        text: '選択肢A',
        rating: 'best',
        statusEffects: { knowledge: 3 },
        feedback: { explanation: '解説A', syllabusRefs: ['1.1'] },
        next,
      },
      {
        text: '選択肢B',
        rating: 'good',
        statusEffects: { skill: 2 },
        feedback: { explanation: '解説B', syllabusRefs: ['1.2'] },
        next,
      },
    ],
  })
  return {
    id: 'fl-1-test',
    title: 'テストシナリオ',
    startNodeId: 'n1',
    nodes: [
      choiceNode('n1', 'n2'),
      choiceNode('n2', 'n3'),
      choiceNode('n3', 'n4'),
      { id: 'n4', type: 'text', background: 'office', characters: [], speaker: 'narration', text: '終わり。', next: null },
    ],
  }
}

function clone(s: Scenario): Scenario {
  return structuredClone(s)
}

describe('validator.ts（FR-009 検証12項目）', () => {
  it('FT-009-001-TC-015：正常系（全検証通過・throwしない）', () => {
    expect(() => validateScenario(makeValidScenario())).not.toThrow()
  })

  it('FT-009-001-TC-001：必須フィールド欠損（speaker欠損）→ #1', () => {
    const s = clone(makeValidScenario())
    delete (s.nodes[0] as unknown as Record<string, unknown>).speaker
    expect(() => validateScenario(s)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-002：参照先ノード不在（next不在）→ #3', () => {
    const s = clone(makeValidScenario())
    ;(s.nodes[0] as { choices: { next: string }[] }).choices[0].next = 'nope'
    expect(() => validateScenario(s)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-003：選択肢数範囲外（1個・4個）→ #4', () => {
    const one = clone(makeValidScenario())
    ;(one.nodes[0] as { choices: unknown[] }).choices = [(one.nodes[0] as { choices: unknown[] }).choices[0]]
    expect(() => validateScenario(one)).toThrow(ValidationError)

    const four = clone(makeValidScenario())
    const c = (four.nodes[0] as { choices: unknown[] }).choices
    ;(four.nodes[0] as { choices: unknown[] }).choices = [c[0], c[1], c[0], c[1]]
    expect(() => validateScenario(four)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-004：テキスト長超過（201字）→ #5', () => {
    const s = clone(makeValidScenario())
    s.nodes[0].text = 'あ'.repeat(201)
    expect(() => validateScenario(s)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-005：statusEffects範囲外（値6・0キー）→ #6', () => {
    const over = clone(makeValidScenario())
    ;(over.nodes[0] as { choices: { statusEffects: Record<string, number> }[] }).choices[0].statusEffects = { knowledge: 6 }
    expect(() => validateScenario(over)).toThrow(ValidationError)

    const empty = clone(makeValidScenario())
    ;(empty.nodes[0] as { choices: { statusEffects: Record<string, number> }[] }).choices[0].statusEffects = {}
    expect(() => validateScenario(empty)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-006：syllabusRefs欠如（空）→ #7', () => {
    const s = clone(makeValidScenario())
    ;(s.nodes[0] as { choices: { feedback: { syllabusRefs: string[] } }[] }).choices[0].feedback.syllabusRefs = []
    expect(() => validateScenario(s)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-007：最終ノード不在（next=nullが無い）→ #12', () => {
    const s = clone(makeValidScenario())
    ;(s.nodes[3] as { next: string | null }).next = 'n3' // 最終ノードを参照ありに変える
    expect(() => validateScenario(s)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-008：到達不能ノード → #11（警告のみ・throwしない）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = clone(makeValidScenario())
    // 孤立した text ノードを追加（どこからも参照されない）
    s.nodes.push({ id: 'orphan', type: 'text', background: 'office', characters: [], speaker: 'narration', text: '孤立。', next: null })
    let result: { warnings: string[] } | undefined
    expect(() => {
      result = validateScenario(s)
    }).not.toThrow()
    expect(result!.warnings.length).toBeGreaterThan(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('FT-009-001-TC-009：ノードID重複 → #2', () => {
    const s = clone(makeValidScenario())
    s.nodes[1].id = 'n1' // n2 を n1 に重複させる
    expect(() => validateScenario(s)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-010：characters制約違反（3体・position重複）→ #8', () => {
    const s = clone(makeValidScenario())
    s.nodes[0].characters = [
      { characterId: 'rin', expression: 'normal', position: 'left' },
      { characterId: 'tanaka', expression: 'normal', position: 'right' },
      { characterId: 'ken', expression: 'normal', position: 'left' },
    ]
    expect(() => validateScenario(s)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-011：speaker不正（charactersに無いID）→ #9', () => {
    const s = clone(makeValidScenario())
    s.nodes[0].speaker = 'ken' // characters が空なので該当なし
    expect(() => validateScenario(s)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-012：選択肢ノード数範囲外（2本）→ #10', () => {
    const s = clone(makeValidScenario())
    // n3 を text に変換して choice ノードを2本にする
    s.nodes[2] = { id: 'n3', type: 'text', background: 'office', characters: [], speaker: 'narration', text: '中継。', next: 'n4' }
    expect(() => validateScenario(s)).toThrow(ValidationError)
  })

  it('FT-009-001-TC-013：テキスト長の有効境界（200字ちょうど）→ throwしない', () => {
    const s = clone(makeValidScenario())
    s.nodes[0].text = 'あ'.repeat(200)
    expect(() => validateScenario(s)).not.toThrow()
  })

  it('FT-009-001-TC-014：statusEffects値の有効境界（1および5）→ throwしない', () => {
    const s = clone(makeValidScenario())
    ;(s.nodes[0] as { choices: { statusEffects: Record<string, number> }[] }).choices[0].statusEffects = { knowledge: 1, skill: 5 }
    expect(() => validateScenario(s)).not.toThrow()
  })
})
