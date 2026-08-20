// 画像アセットのパス解決。形式差し替えは EXT の変更だけで完結する。
// 'webp'（2026-08-21圧縮・37.6MB→2.1MB）。元PNGは assets-candidates/original-png/ に退避。
// 生成は scripts/compress-images.mjs。暫定SVGは public/images/ に残置（未使用）。
const EXT = 'webp'

export function backgroundUrl(bg: string): string {
  return `/images/backgrounds/${bg}.${EXT}`
}

export function characterUrl(id: string, expression: string): string {
  return `/images/characters/${id}/${expression}.${EXT}`
}
