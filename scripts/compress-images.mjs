// 画像アセットの圧縮（PNG → WebP）
//
// 採用済みPNGを WebP へ再エンコードする。決定的処理（顔・構図は変わらない）なので
// 画像アセットルール（.claude/rules/project/image-assets.md）の①クロップ・合成と同列に扱える。
// alphaQuality=100 固定で透過エッジは無劣化に保つ（立ち絵の輪郭に白フリンジを出さないため）。
//
// 使い方:
//   node scripts/compress-images.mjs                       # 未変換のPNGのみ WebP 化（元PNGは残る）
//   node scripts/compress-images.mjs --force               # 既存 WebP も再生成
//   node scripts/compress-images.mjs --archive             # WebP 化後、元PNGを退避先へ移動
//   node scripts/compress-images.mjs --quality 82          # 品質指定（既定 90）
//   node scripts/compress-images.mjs --dry-run             # 実行せず対象と見込みだけ表示
//
// 退避先: assets-candidates/original-png/（gitignore対象・原本保管用）

import sharp from 'sharp'
import { mkdir, readdir, rename, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const IMAGES_DIR = path.join(ROOT, 'public/images')
const ARCHIVE_DIR = path.join(ROOT, 'assets-candidates/original-png')

const argv = process.argv.slice(2)
const has = (flag) => argv.includes(flag)
const valueOf = (flag, fallback) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const QUALITY = Number(valueOf('--quality', '90'))
const FORCE = has('--force')
const ARCHIVE = has('--archive')
const DRY_RUN = has('--dry-run')

if (!Number.isInteger(QUALITY) || QUALITY < 1 || QUALITY > 100) {
  console.error(`--quality は 1〜100 の整数で指定してください（受領値: ${valueOf('--quality', '')}）`)
  process.exit(1)
}

/** IMAGES_DIR 配下の PNG を再帰列挙（IMAGES_DIR からの相対パスを返す） */
async function listPngs(dir, base = '') {
  const entries = await readdir(path.join(dir, base), { withFileTypes: true })
  const out = []
  for (const e of entries) {
    const rel = path.join(base, e.name)
    if (e.isDirectory()) out.push(...(await listPngs(dir, rel)))
    else if (e.isFile() && e.name.toLowerCase().endsWith('.png')) out.push(rel)
  }
  return out.sort()
}

const kb = (n) => (n / 1024).toFixed(0).padStart(6)

const targets = await listPngs(IMAGES_DIR)
if (targets.length === 0) {
  console.log('対象PNGがありません（すでに WebP 化済みか、退避済みです）')
  process.exit(0)
}

console.log(`対象 ${targets.length} 枚 / WebP quality=${QUALITY} alphaQuality=100${DRY_RUN ? ' [DRY RUN]' : ''}`)
console.log('')

let totalBefore = 0
let totalAfter = 0
let converted = 0
let skipped = 0

for (const rel of targets) {
  const src = path.join(IMAGES_DIR, rel)
  const dst = src.replace(/\.png$/i, '.webp')
  const before = (await stat(src)).size

  if (existsSync(dst) && !FORCE) {
    skipped++
    console.log(`  skip  ${rel}（WebP が既に存在。再生成は --force）`)
    continue
  }

  if (DRY_RUN) {
    totalBefore += before
    converted++
    console.log(`  plan  ${rel}  ${kb(before)} KB → (未実行)`)
    continue
  }

  // 元ファイルを読み切ってからバッファ経由で書く（src と dst が同一ディレクトリのため）
  const buf = await sharp(src).webp({ quality: QUALITY, alphaQuality: 100, effort: 6 }).toBuffer()
  const { writeFile } = await import('node:fs/promises')
  await writeFile(dst, buf)

  const after = buf.length
  totalBefore += before
  totalAfter += after
  converted++
  console.log(`  ok    ${rel}  ${kb(before)} KB → ${kb(after)} KB  (${((after / before) * 100).toFixed(0)}%)`)

  if (ARCHIVE) {
    const archived = path.join(ARCHIVE_DIR, rel)
    await mkdir(path.dirname(archived), { recursive: true })
    await rename(src, archived)
  }
}

console.log('')
console.log(`変換 ${converted} 枚 / スキップ ${skipped} 枚`)
if (!DRY_RUN && converted > 0) {
  console.log(
    `合計 ${kb(totalBefore)} KB → ${kb(totalAfter)} KB  (${((totalAfter / totalBefore) * 100).toFixed(1)}%)`
  )
  if (ARCHIVE) console.log(`元PNGを退避: ${path.relative(ROOT, ARCHIVE_DIR)}`)
  else console.log('元PNGは public/images/ に残置（退避は --archive）')
}
