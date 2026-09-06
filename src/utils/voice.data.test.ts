// FR-P2-006 キャラクターボイスのデータ品質の門番。
// シナリオを直したのに音声を作り直していない／音声だけ残っている、といった置き去りを CI で検出する。
// 音声はシナリオ単位で段階導入するため、「manifest に登録のあるシナリオ」だけを検査対象にする
//（未収録のシナリオは無音で進む仕様なので、載っていないこと自体は正常）。
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ScenarioIndex, Scenario } from '../types'
import type { VoiceManifest } from './voice'

const DATA_DIR = join(process.cwd(), 'public', 'data', 'scenarios')
const AUDIO_DIR = join(process.cwd(), 'public', 'audio')
const MANIFEST_PATH = join(AUDIO_DIR, 'manifest.json')

const hasManifest = existsSync(MANIFEST_PATH)

// describe.skipIf でもコールバック自体は収集時に実行されるため、読み込みはここで条件分岐する
// （音声未導入の状態でファイルを開きに行くと収集エラーになる）。
const manifest: VoiceManifest = hasManifest
  ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as VoiceManifest)
  : { version: 1, format: 'm4a', scenarios: {} }
const index = JSON.parse(readFileSync(join(DATA_DIR, 'index.json'), 'utf-8')) as ScenarioIndex

// 音声未導入（パイロット前）の状態を「失敗」にはしない。導入後だけ厳しく見る。
describe.skipIf(!hasManifest)('音声マニフェストの整合（音声が配置されている場合のみ）', () => {
  const entryById = new Map(index.scenarios.map((e) => [e.id, e]))
  const registered = Object.keys(manifest.scenarios)

  function readScenario(id: string): Scenario {
    const entry = entryById.get(id)
    if (!entry) throw new Error(`index.json に無いシナリオが manifest にあります: ${id}`)
    return JSON.parse(readFileSync(join(DATA_DIR, entry.file), 'utf-8')) as Scenario
  }

  it('manifest が version 1・配信形式は m4a（Safari 互換）', () => {
    expect(manifest.version).toBe(1)
    expect(manifest.format).toBe('m4a')
  })

  it('manifest のシナリオIDはすべて index.json に存在する', () => {
    const unknown = registered.filter((id) => !entryById.has(id))
    expect(unknown).toEqual([])
  })

  it('登録済みシナリオは全発話ノードに音声がある（部分的な取りこぼしを検出）', () => {
    const missing: string[] = []
    for (const id of registered) {
      const byNode = manifest.scenarios[id]
      for (const node of readScenario(id).nodes) {
        if (node.text && !byNode[node.id]) missing.push(`${id}/${node.id}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('manifest に載っているノードはシナリオに実在する（削除されたノードの置き去りを検出）', () => {
    const stale: string[] = []
    for (const id of registered) {
      const nodeIds = new Set(readScenario(id).nodes.map((n) => n.id))
      for (const nodeId of Object.keys(manifest.scenarios[id])) {
        if (!nodeIds.has(nodeId)) stale.push(`${id}/${nodeId}`)
      }
    }
    expect(stale).toEqual([])
  })

  it('manifest の各エントリに対応する音声ファイルが存在する', () => {
    const missing: string[] = []
    for (const id of registered) {
      for (const nodeId of Object.keys(manifest.scenarios[id])) {
        const file = join(AUDIO_DIR, id, `${nodeId}.${manifest.format}`)
        if (!existsSync(file)) missing.push(`${id}/${nodeId}.${manifest.format}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('public/audio 配下に manifest 未登録の孤児ファイルが無い', () => {
    const orphans: string[] = []
    // 編成パターン（FR-P2-003）の音声は manifest.variants 側で管理するため、ここでは見ない
    const variantDirs = new Set(Object.keys(manifest.variants ?? {}))
    for (const dirent of readdirSync(AUDIO_DIR, { withFileTypes: true })) {
      if (!dirent.isDirectory() || variantDirs.has(dirent.name)) continue
      const byNode = manifest.scenarios[dirent.name] ?? {}
      for (const file of readdirSync(join(AUDIO_DIR, dirent.name))) {
        const nodeId = file.replace(/\.[^.]+$/, '')
        if (!byNode[nodeId]) orphans.push(`${dirent.name}/${file}`)
      }
    }
    expect(orphans).toEqual([])
  })

  it('話者（cast）がシナリオの speaker と一致する（配役の取り違えを検出）', () => {
    const mismatched: string[] = []
    for (const id of registered) {
      const byNode = manifest.scenarios[id]
      for (const node of readScenario(id).nodes) {
        const entry = byNode[node.id]
        if (entry && entry.cast !== node.speaker) {
          mismatched.push(`${id}/${node.id}: manifest=${entry.cast} / scenario=${node.speaker}`)
        }
      }
    }
    expect(mismatched).toEqual([])
  })
})

// FR-P2-003 編成パターンの音声。差し替えたキャラのセリフだけが別音源になるため、
// 「差し替え対象のノードに漏れなく音声があるか」「余計なノードを鳴らしていないか」を見張る。
describe.skipIf(!hasManifest)('編成パターンの音声（配置されている場合のみ）', () => {
  const casting = JSON.parse(
    readFileSync(join(process.cwd(), 'public', 'data', 'casting.json'), 'utf-8'),
  ) as { castings: { id: string; swap: Record<string, string> }[] }

  const load = (id: string): Scenario => {
    const entry = index.scenarios.find((e) => e.id === id)!
    return JSON.parse(readFileSync(join(DATA_DIR, entry.file), 'utf-8')) as Scenario
  }

  for (const c of casting.castings.filter((x) => Object.keys(x.swap).length > 0)) {
    const variant = manifest.variants?.[c.id]

    it.skipIf(!variant)(`${c.id}: 差し替え対象の全セリフに音声がある`, () => {
      const missing: string[] = []
      const extra: string[] = []
      for (const entry of index.scenarios) {
        const byNode = variant!.scenarios[entry.id] ?? {}
        for (const node of load(entry.id).nodes) {
          const shouldHave = Boolean(c.swap[node.speaker]) && node.text.trim().length > 0
          const has = Boolean(byNode[node.id])
          if (shouldHave && !has) missing.push(`${entry.id}/${node.id}`)
          if (!shouldHave && has) extra.push(`${entry.id}/${node.id}`)
        }
      }
      expect(missing, `音声が無い: ${missing.slice(0, 5).join(', ')}`).toEqual([])
      expect(extra, `差し替え対象でないのに音声がある: ${extra.slice(0, 5).join(', ')}`).toEqual([])
    })

    it.skipIf(!variant)(`${c.id}: 音声ファイルが実在する`, () => {
      const missing: string[] = []
      for (const [sid, byNode] of Object.entries(variant!.scenarios)) {
        for (const nid of Object.keys(byNode)) {
          if (!existsSync(join(AUDIO_DIR, c.id, sid, `${nid}.${manifest.format}`))) {
            missing.push(`${c.id}/${sid}/${nid}`)
          }
        }
      }
      expect(missing, `ファイルが無い: ${missing.slice(0, 5).join(', ')}`).toEqual([])
    })

    it.skipIf(!variant)(`${c.id}: 差し替え後のキャラの音源で作られている`, () => {
      const wrong: string[] = []
      const expected = new Set(Object.values(c.swap))
      for (const [sid, byNode] of Object.entries(variant!.scenarios)) {
        for (const [nid, e] of Object.entries(byNode)) {
          if (!expected.has(e.cast)) wrong.push(`${sid}/${nid}=${e.cast}`)
        }
      }
      expect(wrong, `別のキャラの声で生成されている: ${wrong.slice(0, 5).join(', ')}`).toEqual([])
    })
  }
})
