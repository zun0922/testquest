// FR-P2-002 エンディングデータの門番。
// 判定に使う定数（理論最大値）はシナリオデータから導ける値なので、
// **データを改訂したら CI で落ちる**ようにしておく（気づかないまま判定が狂うのを防ぐ）。
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EndingsData, ScenarioIndex, Scenario, StatusKey } from '../types'
import { FL_THEORETICAL_MAX } from './ending'

const DATA_DIR = join(process.cwd(), 'public', 'data')
const SCENARIOS_DIR = join(DATA_DIR, 'scenarios')

const index = JSON.parse(readFileSync(join(SCENARIOS_DIR, 'index.json'), 'utf-8')) as ScenarioIndex
const endingsData = JSON.parse(readFileSync(join(DATA_DIR, 'endings.json'), 'utf-8')) as EndingsData

const KEYS: StatusKey[] = ['knowledge', 'skill', 'confidence', 'teamwork']

describe('理論最大値の定数（判定の基準）', () => {
  it('FL_THEORETICAL_MAX が実データから計算した値と一致する', () => {
    const calc: Record<string, number> = { knowledge: 0, skill: 0, confidence: 0, teamwork: 0 }
    for (const entry of index.scenarios.filter((s) => s.level === 'FL')) {
      const scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, entry.file), 'utf-8')) as Scenario
      for (const node of scenario.nodes) {
        if (node.type !== 'choice') continue
        // poor は判定に算入しないので、理論最大も best/good だけで計算する
        const choices = node.choices.filter((c) => c.rating !== 'poor')
        if (choices.length === 0) continue
        for (const k of KEYS) {
          calc[k] += Math.max(...choices.map((c) => c.statusEffects[k] ?? 0))
        }
      }
    }
    expect(calc).toEqual(FL_THEORETICAL_MAX)
  })
})

describe('endings.json', () => {
  const ids = endingsData.endings.map((e) => e.id)

  it('version 1・7種のエンディングが定義されている', () => {
    expect(endingsData.version).toBe(1)
    expect(endingsData.endings).toHaveLength(7)
  })

  it('判定コードが返す ID がすべて定義に存在する', () => {
    const expected = ['fl-knowledge', 'fl-skill', 'fl-teamwork', 'fl-balanced', 'al-tm', 'al-tta', 'grand']
    expect(ids).toEqual(expected)
  })

  it('ID が重複していない', () => {
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('名称・説明・本文が空でない', () => {
    for (const e of endingsData.endings) {
      expect(e.name.length, e.id).toBeGreaterThan(0)
      expect(e.subtitle.length, e.id).toBeGreaterThan(0)
      expect(e.lines.length, e.id).toBeGreaterThan(0)
      for (const l of e.lines) expect(l.text.length, `${e.id}: 空の行`).toBeGreaterThan(0)
    }
  })

  it('背景画像が実在する', () => {
    for (const e of endingsData.endings) {
      const file = join(process.cwd(), 'public', 'images', 'backgrounds', `${e.background}.webp`)
      expect(existsSync(file), `${e.id}: 背景 ${e.background} が無い`).toBe(true)
    }
  })

  it('立ち絵が実在する（キャラ×表情）', () => {
    for (const e of endingsData.endings) {
      for (const l of e.lines) {
        for (const c of l.characters) {
          const file = join(process.cwd(), 'public', 'images', 'characters', c.characterId, `${c.expression}.webp`)
          expect(existsSync(file), `${e.id}: ${c.characterId}/${c.expression} が無い`).toBe(true)
        }
      }
    }
  })

  it('発話者が立ち絵に含まれる（グレーアウト判定が成立する）', () => {
    for (const e of endingsData.endings) {
      for (const l of e.lines) {
        if (l.speaker === 'narration') continue
        const ids2 = l.characters.map((c) => c.characterId)
        expect(ids2, `${e.id}: 発話者 ${l.speaker} の立ち絵が無い`).toContain(l.speaker)
      }
    }
  })

  it('同じ position に複数の立ち絵を置かない', () => {
    for (const e of endingsData.endings) {
      for (const l of e.lines) {
        const pos = l.characters.map((c) => c.position)
        expect(new Set(pos).size, `${e.id}: position が重複`).toBe(pos.length)
      }
    }
  })
})
