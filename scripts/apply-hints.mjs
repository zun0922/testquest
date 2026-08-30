// ヒントデータ（FR-P2-007）をシナリオJSONへ挿入する
//
// `hint`（ChoiceNode・ヒント文）と `emphasis`（Choice・強調範囲）を、
// **既存の整形を崩さず行ベースで挿入**する。JSON.parse→stringify で書き戻すと
// `characters` を1行にまとめている既存の整形が展開されて差分が膨らむため、この方式を採る。
//
// 使い方:
//   node scripts/apply-hints.mjs <データJSON>            # 挿入
//   node scripts/apply-hints.mjs <データJSON> --dry-run  # 対象と検証だけ
//
// データJSONの形式:
//   {
//     "fl-1-02": {
//       "hints":    { "q1": "ヒント文", ... },
//       "emphasis": { "選択肢のtext": ["強調語"], ... }
//     }
//   }
//
// 挿入前に「hint が最大100字」「emphasis の語が選択肢 text に実在する」を検証し、
// 1件でも違反があれば何も書き換えずに終了する（validator #13/#14 と同じ観点を先回りで確認）。

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCENARIOS_DIR = path.join(ROOT, 'public/data/scenarios')
const HINT_MAX = 100

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const dataPath = argv.find((a) => !a.startsWith('--'))

if (!dataPath) {
  console.error('データJSONのパスを指定してください')
  process.exit(1)
}

/** index.json から シナリオID → ファイルパス を引く。 */
async function scenarioFiles() {
  const index = JSON.parse(await readFile(path.join(SCENARIOS_DIR, 'index.json'), 'utf8'))
  return new Map(index.scenarios.map((e) => [e.id, path.join(SCENARIOS_DIR, e.file)]))
}

/** 行ベースで hint / emphasis を挿入する（既存の整形を保つ）。 */
function insert(src, hints, emphasis) {
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const out = []
  let currentNode = null
  let pendingEmphasis = null
  let hintCount = 0
  let empCount = 0

  for (const line of src.split(nl)) {
    const idMatch = /^\s*"id": "([\w-]+)",\s*$/.exec(line)
    if (idMatch) currentNode = idMatch[1]

    // ヒント文は "choices": [ の直前に置く（text の後に来るので読みやすい）
    if (currentNode && hints[currentNode] && line.includes('"choices": [')) {
      const indent = /^(\s*)/.exec(line)[1]
      out.push(`${indent}"hint": ${JSON.stringify(hints[currentNode])},`)
      hintCount++
      currentNode = null
    }

    out.push(line)

    // 強調範囲は選択肢の "rating" の直後に置く（型定義の並びに合わせる）
    const textMatch = /^(\s*)"text": "(.+?)",\s*$/.exec(line)
    if (textMatch && emphasis[textMatch[2]]) {
      pendingEmphasis = { indent: textMatch[1], words: emphasis[textMatch[2]] }
      continue
    }
    if (pendingEmphasis && line.includes('"rating":')) {
      out.push(`${pendingEmphasis.indent}"emphasis": ${JSON.stringify(pendingEmphasis.words)},`)
      empCount++
      pendingEmphasis = null
    }
  }
  return { text: out.join(nl), hintCount, empCount }
}

async function main() {
  const data = JSON.parse(await readFile(path.resolve(dataPath), 'utf8'))
  const files = await scenarioFiles()

  // --- 事前検証（1件でも違反があれば何も書かない）---
  const problems = []
  for (const [sid, spec] of Object.entries(data)) {
    const file = files.get(sid)
    if (!file || !existsSync(file)) {
      problems.push(`${sid}: index.json に無いシナリオです`)
      continue
    }
    const scenario = JSON.parse(await readFile(file, 'utf8'))
    const nodeIds = new Set(scenario.nodes.map((n) => n.id))
    const choiceTexts = new Set(scenario.nodes.flatMap((n) => (n.choices ?? []).map((c) => c.text)))

    for (const [nodeId, hint] of Object.entries(spec.hints ?? {})) {
      if (!nodeIds.has(nodeId)) problems.push(`${sid}/${nodeId}: そのノードがありません`)
      if (hint.length > HINT_MAX) problems.push(`${sid}/${nodeId}: hint が ${HINT_MAX} 字超（${hint.length}）`)
      if (hint.length === 0) problems.push(`${sid}/${nodeId}: hint が空です`)
    }
    for (const [text, words] of Object.entries(spec.emphasis ?? {})) {
      if (!choiceTexts.has(text)) {
        problems.push(`${sid}: 選択肢 "${text.slice(0, 20)}…" がありません`)
        continue
      }
      for (const w of words) {
        if (!text.includes(w)) problems.push(`${sid}: 強調語 "${w}" が選択肢 text に含まれません`)
      }
    }
  }
  if (problems.length > 0) {
    console.error('検証エラー（書き換えを中止しました）:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }

  // --- 挿入 ---
  let totalHint = 0
  let totalEmp = 0
  for (const [sid, spec] of Object.entries(data)) {
    const file = files.get(sid)
    const src = await readFile(file, 'utf8')
    const { text, hintCount, empCount } = insert(src, spec.hints ?? {}, spec.emphasis ?? {})
    totalHint += hintCount
    totalEmp += empCount
    if (!DRY_RUN) await writeFile(file, text, 'utf8')
    console.log(`  ${sid}: hint ${hintCount} / emphasis ${empCount}`)
  }
  console.log(`\n完了: hint ${totalHint} 件 / emphasis ${totalEmp} 件${DRY_RUN ? '（dry-run）' : ''}`)
}

main().catch((e) => {
  console.error(`\n${e.message}`)
  process.exit(1)
})
