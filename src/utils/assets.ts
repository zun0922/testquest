// 画像アセットのパス解決。実PNG導入時は EXT を 'png' に変えるだけで差し替え可能。
const EXT = 'png' // 本格アート（AI生成PNG・2026-07-02差し替え）。暫定SVGは public/images/ に残置

export function backgroundUrl(bg: string): string {
  return `/images/backgrounds/${bg}.${EXT}`
}

export function characterUrl(id: string, expression: string): string {
  return `/images/characters/${id}/${expression}.${EXT}`
}
