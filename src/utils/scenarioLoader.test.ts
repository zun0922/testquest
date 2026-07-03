import { describe, it, expect, vi } from 'vitest'
import { loadIndex, loadScenario, ValidationError } from './scenarioLoader'
import type { Scenario, ScenarioIndex } from '../types'

function mockFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
  })) as unknown as typeof fetch
}

const validIndex: ScenarioIndex = {
  version: 1,
  scenarios: [
    { id: 'fl-1-01', title: 'テスト', level: 'FL', chapter: 1, order: 1, estimatedMinutes: 5, file: 'fl-1/fl-1-01.json' },
  ],
}

function validScenario(): Scenario {
  const cn = (id: string, next: string): Scenario['nodes'][number] => ({
    id, type: 'choice', background: 'office', characters: [], speaker: 'narration', text: 'シーン',
    choices: [
      { text: 'A', rating: 'best', statusEffects: { knowledge: 3 }, feedback: { explanation: '解説', syllabusRefs: ['1.1'] }, next },
      { text: 'B', rating: 'good', statusEffects: { skill: 2 }, feedback: { explanation: '解説', syllabusRefs: ['1.2'] }, next },
    ],
  })
  return {
    id: 'fl-1-01', title: 'テスト', startNodeId: 'n1',
    nodes: [cn('n1', 'n2'), cn('n2', 'n3'), cn('n3', 'n4'),
      { id: 'n4', type: 'text', background: 'office', characters: [], speaker: 'narration', text: '終わり', next: null }],
  }
}

describe('scenarioLoader.ts（FR-009 fetch＋検証）', () => {
  it('loadIndex：成功時に index を返す', async () => {
    const idx = await loadIndex(mockFetch(validIndex))
    expect(idx.scenarios).toHaveLength(1)
  })

  it('loadIndex：HTTPエラー時は throw', async () => {
    await expect(loadIndex(mockFetch(null, false, 404))).rejects.toThrow()
  })

  it('loadScenario：成功＋検証OKで Scenario を返す', async () => {
    const s = await loadScenario('fl-1/fl-1-01.json', mockFetch(validScenario()))
    expect(s.startNodeId).toBe('n1')
  })

  it('FT-009-002-TC-001 相当：fetch失敗（404）は Error を throw', async () => {
    await expect(loadScenario('fl-1/nope.json', mockFetch(null, false, 404))).rejects.toThrow()
  })

  it('検証エラーのシナリオは ValidationError を throw', async () => {
    const broken = validScenario()
    broken.startNodeId = 'missing' // #3 参照エラー
    await expect(loadScenario('fl-1/broken.json', mockFetch(broken))).rejects.toThrow(ValidationError)
  })
})
