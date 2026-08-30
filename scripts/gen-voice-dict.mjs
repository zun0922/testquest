// VOICEVOX ユーザー辞書の一括登録（FR-P2-006）
//
// scripts/voice-dict.json の読みを VOICEVOX のユーザー辞書へ反映する。
// 辞書をリポジトリで管理することで、誰の環境で生成しても同じ読みになる（再現性の担保）。
// 読み間違いを見つけたら voice-dict.json に足して本スクリプトを再実行し、
// gen-voice.mjs --force で該当シナリオを鳴らし直す。
//
// 使い方:
//   node scripts/gen-voice-dict.mjs            # 登録・更新
//   node scripts/gen-voice-dict.mjs --list     # 現在の辞書を表示するだけ
//   node scripts/gen-voice-dict.mjs --dry-run  # 差分だけ表示

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DICT_PATH = path.join(ROOT, 'scripts/voice-dict.json')
const CAST_PATH = path.join(ROOT, 'scripts/voice-cast.json')

const argv = process.argv.slice(2)
const LIST = argv.includes('--list')
const DRY_RUN = argv.includes('--dry-run')

async function engineFetch(engine, pathname, init) {
  let res
  try {
    res = await fetch(`${engine}${pathname}`, init)
  } catch (e) {
    throw new Error(
      `VOICEVOX エンジンに接続できません（${engine}）。VOICEVOX を起動してから再実行してください。\n  原因: ${e.message}`,
    )
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`VOICEVOX API エラー: ${pathname} → HTTP ${res.status} ${body.slice(0, 200)}`)
  }
  return res
}

function query(params) {
  return new URLSearchParams(params).toString()
}

async function main() {
  const { engine } = JSON.parse(await readFile(CAST_PATH, 'utf8'))
  const dict = JSON.parse(await readFile(DICT_PATH, 'utf8'))

  // 既存辞書（{ uuid: { surface, pronunciation, accent_type, ... } }）
  const current = await (await engineFetch(engine, '/user_dict')).json()
  const bySurface = new Map(Object.entries(current).map(([uuid, w]) => [w.surface, { uuid, ...w }]))

  if (LIST) {
    console.log(`登録済み ${bySurface.size} 語:`)
    for (const [surface, w] of bySurface) {
      console.log(`  ${surface} → ${w.pronunciation} (accent ${w.accent_type})`)
    }
    return
  }

  let added = 0
  let updated = 0
  let same = 0

  for (const w of dict.words) {
    const exists = bySurface.get(w.surface)
    const params = {
      surface: w.surface,
      pronunciation: w.pronunciation,
      accent_type: String(w.accent_type ?? 0),
      word_type: w.word_type ?? 'PROPER_NOUN',
    }

    if (exists && exists.pronunciation === w.pronunciation && exists.accent_type === (w.accent_type ?? 0)) {
      same++
      continue
    }
    if (DRY_RUN) {
      console.log(`  [dry-run] ${exists ? '更新' : '追加'}: ${w.surface} → ${w.pronunciation}`)
      exists ? updated++ : added++
      continue
    }

    if (exists) {
      await engineFetch(engine, `/user_dict_word/${exists.uuid}?${query(params)}`, { method: 'PUT' })
      updated++
    } else {
      await engineFetch(engine, `/user_dict_word?${query(params)}`, { method: 'POST' })
      added++
    }
    console.log(`  ${exists ? '更新' : '追加'}: ${w.surface} → ${w.pronunciation}`)
  }

  console.log(`\n完了: 追加 ${added} / 更新 ${updated} / 変更なし ${same}${DRY_RUN ? '（dry-run）' : ''}`)
  if (added + updated > 0 && !DRY_RUN) {
    console.log('※読みを変えたシナリオは node scripts/gen-voice.mjs --force で鳴らし直してください。')
  }
}

main().catch((e) => {
  console.error(`\n${e.message}`)
  process.exit(1)
})
