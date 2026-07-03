// テスト計画書§10.3「全シナリオJSONを validator に通す」データ品質の門番。
// public/data/scenarios/ の本番データを実際に読み込み、検証12項目を満たすことを保証する。
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateScenario } from './validator'
import type { ScenarioIndex } from '../types'

const DATA_DIR = join(process.cwd(), 'public', 'data', 'scenarios')

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(DATA_DIR, rel), 'utf-8'))
}

const index = readJson('index.json') as ScenarioIndex

describe('本番シナリオデータの検証（FR-009 データ品質の門番）', () => {
  it('index.json が ScenarioIndex 形式（version 1・scenarios 配列）', () => {
    expect(index.version).toBe(1)
    expect(Array.isArray(index.scenarios)).toBe(true)
    expect(index.scenarios.length).toBeGreaterThan(0)
  })

  it('第1章は order 昇順で5本（設計 index・テスト仕様 ST-SCN-001-TC-004）', () => {
    const ch1 = index.scenarios.filter((s) => s.level === 'FL' && s.chapter === 1)
    expect(ch1).toHaveLength(5)
    const orders = ch1.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('第2章は order 昇順で5本（起案 FL第2章 v0.1・監修承認 2026-07-03）', () => {
    const ch2 = index.scenarios.filter((s) => s.level === 'FL' && s.chapter === 2)
    expect(ch2).toHaveLength(5)
    const orders = ch2.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('第3章は order 昇順で5本（起案 FL第3章 v0.1・監修承認 2026-07-03）', () => {
    const ch3 = index.scenarios.filter((s) => s.level === 'FL' && s.chapter === 3)
    expect(ch3).toHaveLength(5)
    const orders = ch3.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('第4章は order 昇順で5本（起案 FL第4章 v0.1・監修承認 2026-07-03）', () => {
    const ch4 = index.scenarios.filter((s) => s.level === 'FL' && s.chapter === 4)
    expect(ch4).toHaveLength(5)
    const orders = ch4.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('第5章は order 昇順で5本（起案 FL第5-6章 v0.1・監修承認 2026-07-03）', () => {
    const ch5 = index.scenarios.filter((s) => s.level === 'FL' && s.chapter === 5)
    expect(ch5).toHaveLength(5)
    const orders = ch5.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('第6章は order 昇順で2本（起案 FL第5-6章 v0.1・シラバス20分に見合う分量・監修承認 2026-07-03）', () => {
    const ch6 = index.scenarios.filter((s) => s.level === 'FL' && s.chapter === 6)
    expect(ch6).toHaveLength(2)
    const orders = ch6.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('AL-TM第1章は order 昇順で12本（前半7＋後半5・起案 前半/後半 v0.1・監修承認 2026-07-03/04・企画書§5.2.1）', () => {
    const altm1 = index.scenarios.filter((s) => s.level === 'AL-TM' && s.chapter === 1)
    expect(altm1).toHaveLength(12)
    const orders = altm1.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('AL-TM第2章は order 昇順で7本（起案 AL-TM第2章 v0.1・監修承認 2026-07-04・企画書§5.2.1）', () => {
    const altm2 = index.scenarios.filter((s) => s.level === 'AL-TM' && s.chapter === 2)
    expect(altm2).toHaveLength(7)
    const orders = altm2.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('AL-TM第3章は order 昇順で4本（起案 AL-TM第3章 v0.1・監修承認 2026-07-04・企画書§5.2.1）', () => {
    const altm3 = index.scenarios.filter((s) => s.level === 'AL-TM' && s.chapter === 3)
    expect(altm3).toHaveLength(4)
    const orders = altm3.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('AL-TM は全23本（12+7+4・企画書§5.2.1 の計画どおり）', () => {
    expect(index.scenarios.filter((s) => s.level === 'AL-TM')).toHaveLength(23)
  })

  it('FL章の門番は level FL のみを数える（AL追加による誤カウント防止）', () => {
    const flCh1 = index.scenarios.filter((s) => s.level === 'FL' && s.chapter === 1)
    expect(flCh1).toHaveLength(5)
  })

  it('AL-TM の syllabusRefs は TM- 接頭辞形式（al-adaptation.md の項番規約）', () => {
    for (const s of index.scenarios.filter((x) => x.level === 'AL-TM')) {
      const data = readJson(s.file) as {
        nodes: Array<{ type: string; choices?: Array<{ feedback: { syllabusRefs: string[] } }> }>
      }
      for (const node of data.nodes) {
        for (const c of node.choices ?? []) {
          for (const ref of c.feedback.syllabusRefs) {
            expect(ref, `${s.id} の項番 '${ref}' が TM- 形式でない`).toMatch(/^TM-\d+\.\d+(\.\d+)?$/)
          }
        }
      }
    }
  })

  it.each(index.scenarios.map((s) => [s.id, s.file] as const))(
    '%s が検証12項目を満たす（到達不能の警告なし）',
    (id, file) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const data = readJson(file)
      // id が index と一致
      expect((data as { id: string }).id).toBe(id)
      // 検証エラーが無いこと（throw しない）
      let result: { warnings: string[] } | undefined
      expect(() => {
        result = validateScenario(data)
      }).not.toThrow()
      // 本番データは到達不能ノード（#11警告）も無いことを期待
      expect(result!.warnings).toHaveLength(0)
      warn.mockRestore()
    },
  )
})

