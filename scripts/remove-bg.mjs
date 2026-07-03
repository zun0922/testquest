// 立ち絵のライトグレー単色背景をフラッドフィルで透過化する
// 判定: グローバル距離(コーナー平均色と比較) + ローカル連続性(隣接画素との差) + 無彩色判定(淡色の服の保護)
// 注意: Gemini出力PNGは末尾に余分データがあり厳格パースに失敗する場合がある。
//       その場合は System.Drawing 等で再エンコードしてから投入する（skills/image-asset-production 参照）
// 使い方: node scripts/remove-bg.mjs <inDir> <outDir> <file1.png> [file2.png ...]
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const [, , inDir, outDir, ...files] = process.argv
fs.mkdirSync(outDir, { recursive: true })

const GLOBAL_TOL = 60   // コーナー平均色からの最大距離(勾配許容)
const LOCAL_TOL = 12    // 隣接画素との最大差(輪郭線で停止)
const EDGE_ALPHA_TOL = 40 // 縁の半透明化判定
const CHROMA_MAX = 18   // 無彩色判定: RGBチャネル間の最大差(背景グレーはほぼ0・服には色味がある)

function dist(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

for (const f of files) {
  const png = PNG.sync.read(fs.readFileSync(path.join(inDir, f)))
  const { width: W, height: H, data: d } = png
  const idx = (x, y) => (W * y + x) << 2

  // コーナー4点の平均を背景色とする
  const cs = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]
  let br = 0, bg = 0, bb = 0
  for (const [x, y] of cs) { const i = idx(x, y); br += d[i]; bg += d[i + 1]; bb += d[i + 2] }
  br /= 4; bg /= 4; bb /= 4

  const filled = new Uint8Array(W * H)
  const stack = []
  // 外周全画素をシードに
  for (let x = 0; x < W; x++) { stack.push([x, 0], [x, H - 1]) }
  for (let y = 0; y < H; y++) { stack.push([0, y], [W - 1, y]) }

  while (stack.length) {
    const [x, y] = stack.pop()
    if (x < 0 || y < 0 || x >= W || y >= H) continue
    const p = W * y + x
    if (filled[p]) continue
    const i = p << 2
    if (dist(d[i], d[i + 1], d[i + 2], br, bg, bb) > GLOBAL_TOL) continue
    if (chroma(d[i], d[i + 1], d[i + 2]) > CHROMA_MAX) continue // 色味のある画素(服等)は保護
    filled[p] = 1
    // 4近傍: ローカル連続性チェック付きで拡張
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const np = W * ny + nx
      if (filled[np]) continue
      const ni = np << 2
      if (dist(d[i], d[i + 1], d[i + 2], d[ni], d[ni + 1], d[ni + 2]) <= LOCAL_TOL) stack.push([nx, ny])
    }
  }

  // 透過化 + 縁の1px半透明化(フリンジ緩和)
  let removed = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = W * y + x
      const i = p << 2
      if (filled[p]) { d[i + 3] = 0; removed++ }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = W * y + x
      const i = p << 2
      if (filled[p]) continue
      let touching = false
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        if (filled[W * ny + nx]) { touching = true; break }
      }
      if (touching && dist(d[i], d[i + 1], d[i + 2], br, bg, bb) < EDGE_ALPHA_TOL && chroma(d[i], d[i + 1], d[i + 2]) <= CHROMA_MAX) d[i + 3] = 120
    }
  }

  fs.writeFileSync(path.join(outDir, f), PNG.sync.write(png))
  console.log(`OK: ${f} ${W}x${H} bg=(${br | 0},${bg | 0},${bb | 0}) removed=${((removed / (W * H)) * 100).toFixed(1)}%`)
}
