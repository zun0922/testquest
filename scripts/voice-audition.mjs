// STEP 0 用：音源の試聴サンプル生成と、キャラクター利用規約の一括取得（FR-P2-006）
//
// VOICEVOX の各音声ライブラリには個別の利用規約があり、エンジンの /speaker_info から
// 機械的に取得できる。採用前の権利確認（音声設定書 §8）はこれを一次情報として行う。
//
// 使い方:
//   node scripts/voice-audition.mjs --policies
//       全話者の利用規約を docs/音声ライブラリ規約一覧_v0.1.md に書き出す（生成はしない）
//   node scripts/voice-audition.mjs
//       全話者の既定スタイルで「共通の1文」を読ませて声質を比較できるようにする
//   node scripts/voice-audition.mjs --speakers "玄野武宏,雀松朱司"
//       指定した話者だけで共通の1文を生成する（候補の絞り込み用）
//   node scripts/voice-audition.mjs --speakers "玄野武宏" --roles
//       各役の実セリフ（シナリオから自動抽出）を読ませる（最終確認用）
//
// 出力: assets-candidates/voice-audition/（gitignore・試聴用の一時成果物）

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCENARIOS_DIR = path.join(ROOT, 'public/data/scenarios')
const OUT_DIR = path.join(ROOT, 'assets-candidates/voice-audition')
const CAST_PATH = path.join(ROOT, 'scripts/voice-cast.json')
const POLICY_DOC = path.join(ROOT, 'docs/音声ライブラリ規約一覧_v0.1.md')

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const valueOf = (f, d) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}

const POLICIES = has('--policies')
const ROLES = has('--roles')
const ONLY = valueOf('--speakers', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// 全話者比較に使う共通の1文（学習教材の語り口・専門用語・英字略語を1文に含める）
const COMMON_TEXT =
  'テストの目的は、欠陥を見つけることだけではありません。品質を評価し、意思決定に必要な情報を届けることも含まれます。'

async function engineFetch(engine, pathname, init) {
  let res
  try {
    res = await fetch(`${engine}${pathname}`, init)
  } catch (e) {
    throw new Error(
      `VOICEVOX エンジンに接続できません（${engine}）。VOICEVOX を起動してから再実行してください。\n  原因: ${e.message}`,
    )
  }
  if (!res.ok) throw new Error(`VOICEVOX API エラー: ${pathname} → HTTP ${res.status}`)
  return res
}

/** ファイル名に使えない文字を落とす（話者名は日本語のまま残す）。 */
function safeName(s) {
  return s.replace(/[\\/:*?"<>|]/g, '_')
}

/** 役ごとの代表セリフを実データから決定的に選ぶ（40〜70字の最初の1件）。 */
async function pickRoleLines() {
  const index = JSON.parse(await readFile(path.join(SCENARIOS_DIR, 'index.json'), 'utf8'))
  const lines = {}
  for (const entry of index.scenarios) {
    const scenario = JSON.parse(await readFile(path.join(SCENARIOS_DIR, entry.file), 'utf8'))
    for (const node of scenario.nodes) {
      const role = node.speaker ?? 'narration'
      const text = (node.text ?? '').replace(/`/g, ' ').trim()
      if (!lines[role] && text.length >= 40 && text.length <= 70) {
        lines[role] = { text, from: `${scenario.id}/${node.id}` }
      }
    }
  }
  return lines
}

async function synthesize(engine, styleId, text, outFile) {
  const q = await (
    await engineFetch(engine, `/audio_query?speaker=${styleId}&text=${encodeURIComponent(text)}`, {
      method: 'POST',
    })
  ).json()
  q.prePhonemeLength = 0.05
  q.postPhonemeLength = 0.15
  const res = await engineFetch(engine, `/synthesis?speaker=${styleId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(q),
  })
  const wav = Buffer.from(await res.arrayBuffer())
  const wavFile = outFile.replace(/\.m4a$/, '.wav')
  await writeFile(wavFile, wav)
  await execFileAsync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', wavFile,
    '-c:a', 'aac', '-b:a', '48k', '-ac', '1', outFile,
  ])
  await rm(wavFile, { force: true }) // 試聴用なので中間ファイルは残さない
  return wav.length
}

async function main() {
  const { engine } = JSON.parse(await readFile(CAST_PATH, 'utf8'))
  const version = await (await engineFetch(engine, '/version')).json()
  const speakers = await (await engineFetch(engine, '/speakers')).json()
  console.log(`VOICEVOX ${version} / 話者 ${speakers.length} 名`)

  // --- 規約の一括取得 ---
  if (POLICIES) {
    const today = new Date().toISOString().slice(0, 10)
    const parts = [
      '# 音声ライブラリ利用規約 一覧（VOICEVOX）',
      '',
      '| 項目 | 内容 |',
      '|------|------|',
      '| 取得元 | VOICEVOX ENGINE `/speaker_info` API（一次情報） |',
      `| エンジン版 | ${version} |`,
      `| 取得日 | ${today} |`,
      '| 生成 | `node scripts/voice-audition.mjs --policies` |',
      '',
      '> 本ファイルは自動生成物。**採否と判定根拠は `docs/音声採用記録_v0.1.md` に記録する。**',
      '> VOICEVOX 本体の規約（商用・非商用を問わず利用可／クレジット表記が必要）に加えて、',
      '> 下記の音声ライブラリごとの規約に従う必要がある。',
      '',
      '---',
      '',
    ]
    for (const sp of speakers) {
      const info = await (
        await engineFetch(engine, `/speaker_info?speaker_uuid=${sp.speaker_uuid}&resource_format=url`)
      ).json()
      parts.push(`## ${sp.name}`)
      parts.push('')
      parts.push(`- スタイル: ${sp.styles.map((s) => s.name).join(' / ')}`)
      parts.push(`- speaker_uuid: \`${sp.speaker_uuid}\``)
      parts.push('')
      parts.push('```text')
      parts.push((info.policy ?? '(規約テキストなし)').trim())
      parts.push('```')
      parts.push('')
    }
    await writeFile(POLICY_DOC, `${parts.join('\n')}\n`, 'utf8')
    console.log(`規約を書き出しました: ${path.relative(ROOT, POLICY_DOC)}`)
    return
  }

  // --- 試聴サンプルの生成 ---
  await mkdir(OUT_DIR, { recursive: true })
  const targets = ONLY.length > 0 ? speakers.filter((s) => ONLY.includes(s.name)) : speakers
  if (targets.length === 0) {
    console.error(`指定した話者が見つかりません: ${ONLY.join(', ')}`)
    console.error(`利用可能: ${speakers.map((s) => s.name).join(' / ')}`)
    process.exit(1)
  }

  if (ROLES) {
    // 候補を絞り込んだ段階：役ごとの実セリフを読ませる（--speakers と併用する）
    const lines = await pickRoleLines()
    console.log('役ごとの代表セリフ:')
    for (const [role, l] of Object.entries(lines)) console.log(`  ${role}: ${l.from}（${l.text.length}字）`)
    let n = 0
    for (const sp of targets) {
      for (const [role, line] of Object.entries(lines)) {
        const out = path.join(OUT_DIR, `role_${role}_${safeName(sp.name)}_${safeName(sp.styles[0].name)}.m4a`)
        await synthesize(engine, sp.styles[0].id, line.text, out)
        n++
        console.log(`  ${path.basename(out)}`)
      }
    }
    console.log(`\n完了: ${n} 件 → ${path.relative(ROOT, OUT_DIR)}`)
    return
  }

  // 全話者比較：共通の1文
  console.log(`共通セリフ「${COMMON_TEXT.slice(0, 24)}…」を ${targets.length} 名分生成します`)
  let i = 0
  for (const sp of targets) {
    const style = sp.styles[0]
    const out = path.join(OUT_DIR, `${String(++i).padStart(2, '0')}_${safeName(sp.name)}_${safeName(style.name)}.m4a`)
    await synthesize(engine, style.id, COMMON_TEXT, out)
    console.log(`  ${path.basename(out)}`)
  }
  console.log(`\n完了: ${i} 件 → ${path.relative(ROOT, OUT_DIR)}`)
  if (!existsSync(POLICY_DOC)) {
    console.log('※ 規約は node scripts/voice-audition.mjs --policies で取得できます。')
  }
}

main().catch((e) => {
  console.error(`\n${e.message}`)
  process.exit(1)
})
