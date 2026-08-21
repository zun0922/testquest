// テストデータ（TD群）の門番 — 宿題B-3
//
// public/data/scenarios_test/ の各ケースが、テスト仕様書§6 で意図した
// 検証結果（どの検証項目に当たるか／正常通過するか）になっていることを保証する。
// データは scripts/gen-testdata.mjs が生成する。手編集や生成ロジックの劣化で
// 「異常系のはずが正常通過する」状態になると、機能テストが無意味になるため門番を置く。
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { validateScenario, ValidationError } from './validator'

const ROOT = path.resolve(__dirname, '../..')
const TD_ROOT = path.join(ROOT, 'public/data/scenarios_test')

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(path.join(TD_ROOT, rel), 'utf8'))
}

/** ケースの index.json から、含まれるシナリオファイルの相対パスを返す。 */
function scenarioFiles(dir: string): string[] {
  const idx = readJson(`${dir}/index.json`) as { scenarios: Array<{ file: string }> }
  return idx.scenarios.map((s) => `${dir}/${s.file}`)
}

/** 最初のシナリオを検証し、投げられた ValidationError を返す（投げなければ null）。 */
function validateFirst(dir: string): ValidationError | null {
  const data = readJson(scenarioFiles(dir)[0])
  try {
    validateScenario(data)
    return null
  } catch (e) {
    if (e instanceof ValidationError) return e
    throw e
  }
}

/** 期待する検証番号（'#4' 等）が violations に含まれるか。 */
function hasViolation(err: ValidationError, tag: string): boolean {
  return err.violations.some((v) => v.startsWith(tag))
}

// [ディレクトリ, 期待する検証タグ]
const ERROR_CASES: Array<[string, string]> = [
  ['td-scn-001', '#1'], // 必須フィールド欠損（speaker）
  ['td-scn-002', '#3'], // 参照先ノード不在
  ['td-scn-003a', '#4'], // 選択肢1個
  ['td-scn-003b', '#4'], // 選択肢4個
  ['td-scn-004', '#5'], // 本文201文字
  ['td-scn-005a', '#6'], // statusEffects 6
  ['td-scn-005b', '#6'], // statusEffects 空
  ['td-scn-006', '#7'], // syllabusRefs 空
  ['td-scn-007', '#12'], // 最終ノード不在
]

const VALID_CASES = ['td-scn-009', 'td-scn-010', 'td-scn-011', 'td-scn-012', 'td-sec']

describe('TD群（scenarios_test）の存在と構成', () => {
  it('生成物が存在する（未生成なら gen-testdata.mjs を実行する）', () => {
    expect(existsSync(TD_ROOT)).toBe(true)
    expect(existsSync(path.join(TD_ROOT, 'README.md'))).toBe(true)
  })

  it('全15ケースが index.json とシナリオファイルを持つ', () => {
    const dirs = [...ERROR_CASES.map(([d]) => d), 'td-scn-008', ...VALID_CASES]
    expect(dirs).toHaveLength(15)
    for (const d of dirs) {
      expect(existsSync(path.join(TD_ROOT, d, 'index.json')), `${d}/index.json`).toBe(true)
      for (const f of scenarioFiles(d)) {
        expect(existsSync(path.join(TD_ROOT, f)), f).toBe(true)
      }
    }
  })
})

describe('異常系TDが意図した検証項目で失敗する', () => {
  it.each(ERROR_CASES)('%s は %s で ValidationError になる', (dir, tag) => {
    const err = validateFirst(dir)
    expect(err, `${dir} は検証を通ってしまった（異常系として無効）`).not.toBeNull()
    expect(
      hasViolation(err!, tag),
      `${dir} の違反が ${tag} を含まない: ${err!.violations.join(' / ')}`,
    ).toBe(true)
  })

  it('壊し方は1点だけである（余計な違反が混入していない）', () => {
    // 構造破壊（#1）は後続検証を打ち切るため対象外。参照・値系のみ確認する。
    for (const [dir, tag] of ERROR_CASES.filter(([, t]) => t !== '#1')) {
      const err = validateFirst(dir)!
      const tags = new Set(err.violations.map((v) => v.split(':')[0]))
      expect(tags, `${dir}: ${err.violations.join(' / ')}`).toEqual(new Set([tag]))
    }
  })
})

describe('正常系TDが検証を通る', () => {
  it.each(VALID_CASES)('%s は ValidationError にならない', (dir) => {
    const err = validateFirst(dir)
    expect(err ? err.violations : null, `${dir} が失敗した`).toBeNull()
  })

  it('TD-SCN-009 は本文200文字ちょうど（境界の内側）', () => {
    const s = readJson(scenarioFiles('td-scn-009')[0]) as { nodes: Array<{ id: string; text: string }> }
    expect(s.nodes.find((n) => n.id === 'intro')!.text).toHaveLength(200)
  })

  it('TD-SCN-004 は本文201文字（境界の外側）', () => {
    const s = readJson(scenarioFiles('td-scn-004')[0]) as { nodes: Array<{ id: string; text: string }> }
    expect(s.nodes.find((n) => n.id === 'intro')!.text).toHaveLength(201)
  })

  it('TD-SCN-010 は statusEffects の下限1と上限5を含む', () => {
    const s = readJson(scenarioFiles('td-scn-010')[0]) as {
      nodes: Array<{ id: string; choices?: Array<{ statusEffects: Record<string, number> }> }>
    }
    const q1 = s.nodes.find((n) => n.id === 'q1')!
    const values = q1.choices!.flatMap((c) => Object.values(c.statusEffects))
    expect(values).toContain(1)
    expect(values).toContain(5)
  })

  it('TD-SCN-011 は index.json に2エントリを持ち、両方が検証を通る', () => {
    const files = scenarioFiles('td-scn-011')
    expect(files).toHaveLength(2)
    for (const f of files) {
      expect(() => validateScenario(readJson(f))).not.toThrow()
    }
  })

  it('TD-SCN-012 は explanation 400文字ちょうど（境界の内側）', () => {
    const s = readJson(scenarioFiles('td-scn-012')[0]) as {
      nodes: Array<{ id: string; choices?: Array<{ feedback: { explanation: string } }> }>
    }
    const q1 = s.nodes.find((n) => n.id === 'q1')!
    expect(q1.choices![0].feedback.explanation).toHaveLength(400)
  })

  it('TD-SEC は script タグを含む（エスケープ確認用データとして有効）', () => {
    const raw = readFileSync(path.join(TD_ROOT, scenarioFiles('td-sec')[0]), 'utf8')
    expect(raw).toContain('<script>alert(1)</script>')
    expect(raw).toContain('onerror=')
  })
})

describe('TD-SCN-008（到達不能ノード）は警告どまりで開始できる', () => {
  it('ValidationError にはならず、警告 #11 が返る', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const data = readJson(scenarioFiles('td-scn-008')[0])
      const result = validateScenario(data)
      expect(result.warnings.some((w) => w.startsWith('#11'))).toBe(true)
      expect(result.warnings.some((w) => w.includes('orphan'))).toBe(true)
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})
