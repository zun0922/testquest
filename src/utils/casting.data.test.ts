// FR-P2-003 編成データの門番。
// シナリオJSONと casting.json は別ファイルなので、放っておくと簡単にずれる。
// 「差し替え先が実在するか」「本文差分の宛先が実在するか」をCIで見張る。
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CastingData } from './casting'
import type { Scenario, ScenarioIndex } from '../types'

const DATA_DIR = join(process.cwd(), 'public', 'data')
const SCENARIOS_DIR = join(DATA_DIR, 'scenarios')
const EXPRESSIONS = ['normal', 'happy', 'angry', 'sad', 'thinking']

const casting = JSON.parse(readFileSync(join(DATA_DIR, 'casting.json'), 'utf-8')) as CastingData
const index = JSON.parse(readFileSync(join(SCENARIOS_DIR, 'index.json'), 'utf-8')) as ScenarioIndex

function loadScenario(id: string): Scenario | null {
  const entry = index.scenarios.find((s) => s.id === id)
  if (!entry) return null
  return JSON.parse(readFileSync(join(SCENARIOS_DIR, entry.file), 'utf-8')) as Scenario
}

describe('casting.json', () => {
  it('version 1・既定の編成が先頭にある', () => {
    expect(casting.version).toBe(1)
    expect(casting.castings[0].id).toBe('default')
    expect(casting.castings[0].swap).toEqual({})
  })

  it('IDが重複していない', () => {
    const ids = casting.castings.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('差し替え先のキャラの立ち絵が5表情そろっている', () => {
    for (const c of casting.castings) {
      for (const to of Object.values(c.swap)) {
        for (const e of EXPRESSIONS) {
          const file = join(process.cwd(), 'public', 'images', 'characters', to, `${e}.webp`)
          expect(existsSync(file), `${c.id}: ${to}/${e} が無い`).toBe(true)
        }
      }
    }
  })
})

describe('本文の差分', () => {
  it('差分の宛先（シナリオ・ノード）がすべて実在する', () => {
    for (const c of casting.castings) {
      for (const [sid, nodes] of Object.entries(c.textOverrides)) {
        const scenario = loadScenario(sid)
        expect(scenario, `${c.id}: シナリオ ${sid} が無い`).not.toBeNull()
        for (const nid of Object.keys(nodes)) {
          const node = scenario!.nodes.find((n) => n.id === nid)
          expect(node, `${c.id}: ${sid}/${nid} が無い`).toBeDefined()
        }
      }
    }
  })

  it('差分の宛先は差し替え対象キャラのセリフである（別人のセリフを書き換えない）', () => {
    for (const c of casting.castings) {
      const from = Object.keys(c.swap)
      for (const [sid, nodes] of Object.entries(c.textOverrides)) {
        const scenario = loadScenario(sid)!
        for (const nid of Object.keys(nodes)) {
          const node = scenario.nodes.find((n) => n.id === nid)!
          expect(from, `${c.id}: ${sid}/${nid} の話者は ${node.speaker}`).toContain(node.speaker)
        }
      }
    }
  })

  it('差分は空でなく、元の本文とも違う（無意味な差分を残さない）', () => {
    for (const c of casting.castings) {
      for (const [sid, nodes] of Object.entries(c.textOverrides)) {
        const scenario = loadScenario(sid)!
        for (const [nid, text] of Object.entries(nodes)) {
          const node = scenario.nodes.find((n) => n.id === nid)!
          expect(text.length, `${c.id}: ${sid}/${nid} が空`).toBeGreaterThan(0)
          expect(text, `${c.id}: ${sid}/${nid} が元と同じ`).not.toBe(node.text)
        }
      }
    }
  })

  it('差し替え後の本文に、差し替え前のキャラの名前が残っていない', () => {
    // 「高橋だ。」のような名乗りを直し忘れると、立ち絵と名前が食い違う
    const NAMES: Record<string, string[]> = { takumi: ['高橋', '匠'] }
    for (const c of casting.castings) {
      for (const [from] of Object.entries(c.swap)) {
        for (const [sid, nodes] of Object.entries(c.textOverrides)) {
          for (const [nid, text] of Object.entries(nodes)) {
            for (const name of NAMES[from] ?? []) {
              expect(text.includes(name), `${c.id}: ${sid}/${nid} に「${name}」が残っている`).toBe(false)
            }
          }
        }
      }
    }
  })
})

describe('差し替え対象の網羅', () => {
  it('差し替えるキャラの名前を含むセリフは、すべて差分が用意されている', () => {
    // 名乗りや呼びかけを見落とすと、澪なのに「高橋だ」と名乗ってしまう
    const NAMES: Record<string, string[]> = { takumi: ['高橋'] }
    for (const c of casting.castings) {
      for (const from of Object.keys(c.swap)) {
        for (const entry of index.scenarios) {
          const scenario = loadScenario(entry.id)!
          for (const node of scenario.nodes) {
            const hit = (NAMES[from] ?? []).some((n) => node.text.includes(n))
            if (!hit) continue
            const has = Boolean(c.textOverrides[entry.id]?.[node.id])
            expect(has, `${c.id}: ${entry.id}/${node.id} に名前が出るが差分が無い`).toBe(true)
          }
        }
      }
    }
  })
})
