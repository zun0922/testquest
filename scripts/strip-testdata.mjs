// ビルド成果物からテストデータを除去する — 宿題B-3の是正
//
// TD群は仕様書§6の指定どおり public/data/scenarios_test/ に置くため、
// vite の publicDir コピーで dist にも入り、そのまま本番に公開されてしまう
// （2026-08-21 に本番で HTTP 200 を確認）。アプリは読まない（本番の
// VITE_SCENARIOS_PATH は未設定＝/data/scenarios）ので実害はないが、
// テストデータの本番混入は避けるべきなのでビルド後に削除する。
//
// dev サーバーは public/ を直接配信するため、テスト時の切替には影響しない。
//
// 使い方: node scripts/strip-testdata.mjs   （npm run build から自動実行）

import { rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGETS = ['dist/data/scenarios_test']

for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel)
  try {
    await stat(abs)
  } catch {
    console.log(`skip   ${rel}（存在しない）`)
    continue
  }
  await rm(abs, { recursive: true, force: true })
  console.log(`strip  ${rel}`)
}
