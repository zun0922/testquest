// キャラクターボイスの生成（VOICEVOX → wav → AAC/m4a）
//
// シナリオJSONの各ノードのセリフを VOICEVOX エンジンで合成し、配信用に AAC へ変換する。
// 同じテキスト・同じ配役パラメータなら同じ音声になる決定的処理で、テキストの SHA-256 を
// manifest に記録して「変わったノードだけ」再生成する（冪等・差分再生成）。
//
// 前提:
//   - VOICEVOX（CPU版で可）が起動していること  winget install HiroshibaKazuyuki.VOICEVOX.CPU
//   - ffmpeg / ffprobe に PATH が通っていること
//
// 使い方:
//   node scripts/gen-voice.mjs --scenario fl-1        # 章プレフィックス指定（パイロットはこれ）
//   node scripts/gen-voice.mjs --scenario fl-1-01     # シナリオID指定
//   node scripts/gen-voice.mjs                        # index.json の全シナリオ
//   node scripts/gen-voice.mjs --dry-run              # 生成せず対象だけ表示
//   node scripts/gen-voice.mjs --force                # ハッシュ一致でも再生成
//   node scripts/gen-voice.mjs --prune                # manifest に無い孤児ファイルを削除
//   node scripts/gen-voice.mjs --cast mio             # 編成パターンの音声（FR-P2-003）
//
// --cast を付けると、public/data/casting.json でキャラを差し替えるノードだけを
// 差し替え後の音源で生成し、public/audio/{castingId}/ へ出力する。
// 既定の音声（public/audio/{scenarioId}/）には一切触れないので、
// パターンを増やしても増えるのは「差し替えたキャラのぶん」だけで済む。
//
// 出力:
//   public/audio/{scenarioId}/{nodeId}.m4a   配信用（コミット対象）
//   public/audio/{castingId}/{scenarioId}/{nodeId}.m4a   編成パターン分（--cast 指定時）
//   public/audio/manifest.json               存在判定・尺・ハッシュ
//   assets-candidates/voice-wav/             wav原本（gitignore・再エンコード用に保管）

import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCENARIOS_DIR = path.join(ROOT, 'public/data/scenarios')
const AUDIO_DIR = path.join(ROOT, 'public/audio')
const WAV_DIR = path.join(ROOT, 'assets-candidates/voice-wav')
const CAST_PATH = path.join(ROOT, 'scripts/voice-cast.json')
const CASTING_PATH = path.join(ROOT, 'public/data/casting.json')
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json')

const argv = process.argv.slice(2)
const has = (flag) => argv.includes(flag)
const valueOf = (flag, fallback) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const FILTER = valueOf('--scenario', '')
const DRY_RUN = has('--dry-run')
const FORCE = has('--force')
const PRUNE = has('--prune')
const CASTING_ID = valueOf('--cast', '')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * VOICEVOX エンジンへのリクエスト（失敗時は原因が分かる文言で落とす）。
 * 数百ノードを連続合成すると 5xx が散発するため、サーバ側エラーだけ短い間隔でリトライする。
 * 接続不可（エンジン未起動）と 4xx は再試行しても無駄なので即座に落とす。
 */
async function engineFetch(engine, pathname, init, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    let res
    try {
      res = await fetch(`${engine}${pathname}`, init)
    } catch (e) {
      throw new Error(
        `VOICEVOX エンジンに接続できません（${engine}）。VOICEVOX を起動してから再実行してください。\n  原因: ${e.message}`,
      )
    }
    if (res.ok) return res
    if (res.status < 500 || attempt >= retries) {
      throw new Error(`VOICEVOX API エラー: ${pathname} → HTTP ${res.status}`)
    }
    const wait = 1000 * (attempt + 1)
    console.warn(`  [リトライ ${attempt + 1}/${retries}] HTTP ${res.status} → ${wait}ms 待機`)
    await sleep(wait)
  }
}

/** 話者名＋スタイル名から speaker id を解決する（IDはバージョンで変わるため名前で引く）。 */
function resolveStyleId(speakers, speakerName, styleName) {
  const sp = speakers.find((s) => s.name === speakerName)
  if (!sp) return null
  const st = sp.styles.find((s) => s.name === styleName) ?? sp.styles[0]
  return st ? st.id : null
}

function printSpeakerCatalog(speakers) {
  console.log('\n--- 利用可能な話者（scripts/voice-cast.json の speaker / style に記入してください）---')
  for (const s of speakers) {
    console.log(`  ${s.name}: ${s.styles.map((x) => x.name).join(' / ')}`)
  }
  console.log('---\n')
}

/** 対象シナリオを index.json から決める。 */
async function listTargets() {
  const index = JSON.parse(await readFile(path.join(SCENARIOS_DIR, 'index.json'), 'utf8'))
  return index.scenarios.filter((e) => !FILTER || e.id === FILTER || e.id.startsWith(`${FILTER}-`))
}

/**
 * 読み上げ用にテキストを正規化する（画面に出す本文＝シナリオJSONは一切変えない）。
 * AL-TTA には疑似コードをバッククォートで囲んだセリフがある（al-tta-2-01/q4 など5件）。
 * 記号をそのまま読ませると意味が通らないため、最低限のノイズだけ落とす。
 * ※コード自体をどう読ませるか（読み替え・音声化除外）は STEP 3 でPO判断する。
 */
function normalizeForSpeech(text) {
  return text
    .replace(/`/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 音声の尺（秒）。ffprobe が無い・失敗した場合は 0（再生には影響しない）。 */
async function durationOf(file) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', file,
    ])
    const d = Number(stdout.trim())
    return Number.isFinite(d) ? Math.round(d * 100) / 100 : 0
  } catch {
    return 0
  }
}

/**
 * 編成パターンの定義を読む（--cast 指定時のみ）。
 * 差し替えるキャラと本文の差分を返す。シナリオJSONは読み替えるだけで変更しない。
 */
async function loadCasting(id) {
  if (!id) return null
  const data = JSON.parse(await readFile(CASTING_PATH, 'utf8'))
  const found = data.castings.find((c) => c.id === id)
  if (!found) {
    console.error(`編成パターン「${id}」が casting.json にありません`)
    console.error(`利用できるID: ${data.castings.map((c) => c.id).join(', ')}`)
    process.exit(1)
  }
  if (Object.keys(found.swap ?? {}).length === 0) {
    console.error(`編成パターン「${id}」は差し替えが無いため、生成するものがありません`)
    process.exit(1)
  }
  return found
}

async function main() {
  const cast = JSON.parse(await readFile(CAST_PATH, 'utf8'))
  const casting = await loadCasting(CASTING_ID)
  const engine = cast.engine
  const format = cast.format ?? 'm4a'

  // 1) エンジン疎通と話者解決
  const version = await (await engineFetch(engine, '/version')).json()
  console.log(`VOICEVOX エンジン ${version} に接続しました（${engine}）`)
  const speakers = await (await engineFetch(engine, '/speakers')).json()

  const styleIds = {}
  const unset = []
  for (const [role, conf] of Object.entries(cast.cast)) {
    if (!conf.speaker) {
      unset.push(role)
      continue
    }
    const id = resolveStyleId(speakers, conf.speaker, conf.style)
    if (id === null) {
      console.error(`配役エラー: ${role} の話者「${conf.speaker}／${conf.style}」が見つかりません`)
      printSpeakerCatalog(speakers)
      process.exit(1)
    }
    styleIds[role] = id
  }
  if (unset.length > 0) {
    console.error(`配役が未設定です: ${unset.join(', ')}`)
    printSpeakerCatalog(speakers)
    console.error('STEP 0（試聴・PO選定）を先に済ませてください。')
    process.exit(1)
  }

  // 2) 既存 manifest（差分再生成の基準）
  const manifest = existsSync(MANIFEST_PATH)
    ? JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
    : { version: 1, format, scenarios: {} }
  manifest.format = format

  // 編成パターンの音声は manifest.variants に分けて持つ（既定の音声の記録は触らない）
  const outRoot = casting ? path.join(AUDIO_DIR, casting.id) : AUDIO_DIR
  const wavRoot = casting ? path.join(WAV_DIR, casting.id) : WAV_DIR
  let store = manifest.scenarios
  if (casting) {
    manifest.variants ??= {}
    manifest.variants[casting.id] ??= { scenarios: {} }
    store = manifest.variants[casting.id].scenarios
    console.log(`編成パターン「${casting.id}」（${casting.label}）の音声を生成します`)
    console.log(`  差し替え: ${Object.entries(casting.swap).map(([a, b]) => `${a}→${b}`).join(', ')}`)
  }

  const targets = await listTargets()
  if (targets.length === 0) {
    console.error(`対象シナリオがありません（--scenario ${FILTER}）`)
    process.exit(1)
  }
  console.log(`対象: ${targets.length} シナリオ${FILTER ? `（フィルタ: ${FILTER}）` : ''}`)

  // クレジット（音声ライブラリの規約で必須）。
  // manifest に載っている＝実際に配信している音源だけを列挙する（未使用の配役は書かない）。
  const refreshCredits = () => {
    const speakersInUse = new Set()
    const stores = [manifest.scenarios, ...Object.values(manifest.variants ?? {}).map((v) => v.scenarios)]
    for (const byScenario of stores) {
      for (const byNode of Object.values(byScenario)) {
        for (const entry of Object.values(byNode)) {
          const speaker = cast.cast[entry.cast]?.speaker
          if (speaker) speakersInUse.add(speaker)
        }
      }
    }
    manifest.credits = [...speakersInUse].sort().map((name) => `VOICEVOX:${name}`)
  }

  // 全71本の生成は数十分かかるため、シナリオを1本終えるたびに manifest を保存する。
  // 途中で中断しても、次回は生成済みのハッシュが一致してスキップされ、続きから再開できる。
  const saveManifest = async () => {
    if (DRY_RUN) return
    refreshCredits()
    await mkdir(AUDIO_DIR, { recursive: true })
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }

  let generated = 0
  let skipped = 0
  const seen = new Set()

  for (const entry of targets) {
    const scenario = JSON.parse(await readFile(path.join(SCENARIOS_DIR, entry.file), 'utf8'))
    const byNode = (store[scenario.id] ??= {})
    const outDir = path.join(outRoot, scenario.id)
    const wavDir = path.join(wavRoot, scenario.id)

    for (const node of scenario.nodes) {
      const speaker = node.speaker ?? 'narration'
      // 編成パターンでは、差し替えるキャラのセリフだけを鳴らし直す。
      // それ以外のノードは既定の音声をそのまま使うので生成しない。
      if (casting && !casting.swap[speaker]) continue
      const rawText = casting
        ? (casting.textOverrides?.[scenario.id]?.[node.id] ?? node.text)
        : node.text
      const text = normalizeForSpeech(rawText ?? '')
      if (!text) continue
      const role = casting ? casting.swap[speaker] : speaker
      const conf = cast.cast[role]
      if (!conf) {
        console.error(`配役に無い話者です: ${role}（${scenario.id}/${node.id}）`)
        process.exit(1)
      }

      // 話速・音高もハッシュに含める＝配役パラメータを変えたら鳴らし直す
      const hash = createHash('sha256')
        .update(`${text} ${conf.speaker} ${conf.style} ${conf.speedScale} ${conf.pitchScale} ${conf.intonationScale}`)
        .digest('hex')
        .slice(0, 16)

      const outFile = path.join(outDir, `${node.id}.${format}`)
      seen.add(path.relative(outRoot, outFile).replace(/\\/g, '/'))

      if (!FORCE && byNode[node.id]?.hash === hash && existsSync(outFile)) {
        skipped++
        continue
      }
      if (DRY_RUN) {
        console.log(`  [dry-run] ${scenario.id}/${node.id} (${role}, ${text.length}字)`)
        generated++
        continue
      }

      // 3) 合成：audio_query でパラメータを組み立ててから synthesis
      const q = await (
        await engineFetch(engine, `/audio_query?speaker=${styleIds[role]}&text=${encodeURIComponent(text)}`, {
          method: 'POST',
        })
      ).json()
      q.speedScale = conf.speedScale ?? 1.0
      q.pitchScale = conf.pitchScale ?? 0.0
      q.intonationScale = conf.intonationScale ?? 1.0
      q.prePhonemeLength = 0.05
      q.postPhonemeLength = 0.15

      const wavRes = await engineFetch(engine, `/synthesis?speaker=${styleIds[role]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q),
      })
      const wav = Buffer.from(await wavRes.arrayBuffer())

      await mkdir(wavDir, { recursive: true })
      await mkdir(outDir, { recursive: true })
      const wavFile = path.join(wavDir, `${node.id}.wav`)
      await writeFile(wavFile, wav)

      // 4) 配信形式へ（AAC＝Safari も含む全対応ブラウザで鳴る）
      await execFileAsync('ffmpeg', [
        '-y', '-loglevel', 'error', '-i', wavFile,
        '-c:a', 'aac', '-b:a', cast.bitrate ?? '48k', '-ac', '1', outFile,
      ])

      byNode[node.id] = { hash, dur: await durationOf(outFile), cast: role }
      generated++
      if (generated % 10 === 0) console.log(`  ...${generated} 件生成`)
    }
    await saveManifest() // 1シナリオ完了ごとに保存（中断しても続きから再開できる）
  }

  // 5) 孤児ファイル（シナリオから消えたノードの音声）
  const orphans = []
  // 編成パターンのディレクトリは「シナリオではない」ので、既定側の走査からは除く
  // （除かないと mio/ 以下がまるごと孤児に見えてしまう）
  const castingDirs = new Set(
    JSON.parse(await readFile(CASTING_PATH, 'utf8')).castings
      .filter((c) => Object.keys(c.swap ?? {}).length > 0)
      .map((c) => c.id),
  )
  if (existsSync(outRoot)) {
    for (const dir of await readdir(outRoot, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      if (!casting && castingDirs.has(dir.name)) continue
      // フィルタ指定時は対象外シナリオを孤児と誤判定しない
      if (FILTER && !(dir.name === FILTER || dir.name.startsWith(`${FILTER}-`))) continue
      for (const f of await readdir(path.join(outRoot, dir.name))) {
        const rel = `${dir.name}/${f}`
        if (!seen.has(rel)) orphans.push(rel)
      }
    }
  }
  if (orphans.length > 0) {
    if (PRUNE && !DRY_RUN) {
      for (const rel of orphans) await rm(path.join(outRoot, rel))
      console.log(`孤児ファイルを ${orphans.length} 件削除しました`)
    } else {
      const head = orphans.slice(0, 5).join(', ')
      console.warn(`[警告] 孤児ファイル ${orphans.length} 件（--prune で削除）: ${head}${orphans.length > 5 ? ' ...' : ''}`)
    }
  }

  await saveManifest()
  if (!DRY_RUN) {
    console.log(`クレジット: ${manifest.credits.join(' / ') || '(なし)'}`)
  }
  console.log(`\n完了: 生成 ${generated} 件 / スキップ ${skipped} 件${DRY_RUN ? '（dry-run）' : ''}`)
}

main().catch((e) => {
  console.error(`\n${e.message}`)
  process.exit(1)
})
