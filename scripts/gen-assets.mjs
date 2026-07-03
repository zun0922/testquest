// 暫定SVGアセット生成（立ち絵3キャラ×5表情＋背景）。
// 実画像（PNG）が用意できたら public/images/ 配下を差し替える。命名は設計書§2準拠。
// 実行：node scripts/gen-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHAR_DIR = join(ROOT, 'public/images/characters')
const BG_DIR = join(ROOT, 'public/images/backgrounds')

const CHARS = {
  rin: { hair: '#6b4a8a', hair2: '#553a70', skin: '#f1c9a5', shirt: '#e26d8a', glasses: false, style: 'long' },
  tanaka: { hair: '#36363b', hair2: '#26262b', skin: '#e8b894', shirt: '#4a6fa5', glasses: true, style: 'short' },
  ken: { hair: '#c2622e', hair2: '#a04e1f', skin: '#f0c49a', shirt: '#4caf7d', glasses: false, style: 'spiky' },
}

const EXPRESSIONS = ['normal', 'happy', 'angry', 'sad', 'thinking']

// 表情ごとの 目・眉・口（head中心 cx=110・目 y≈116・眉 y≈100・口 y≈150）
function face(expr) {
  const eyeFill = '#2a2530'
  switch (expr) {
    case 'happy':
      return `
        <path d="M82,118 Q90,108 98,118" fill="none" stroke="${eyeFill}" stroke-width="4" stroke-linecap="round"/>
        <path d="M122,118 Q130,108 138,118" fill="none" stroke="${eyeFill}" stroke-width="4" stroke-linecap="round"/>
        <path d="M94,148 Q110,164 126,148" fill="none" stroke="#b5536a" stroke-width="4" stroke-linecap="round"/>`
    case 'angry':
      return `
        <line x1="80" y1="100" x2="100" y2="108" stroke="${eyeFill}" stroke-width="4" stroke-linecap="round"/>
        <line x1="140" y1="100" x2="120" y2="108" stroke="${eyeFill}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="91" cy="118" r="5" fill="${eyeFill}"/><circle cx="129" cy="118" r="5" fill="${eyeFill}"/>
        <path d="M98,156 Q110,150 122,156" fill="none" stroke="#9a4040" stroke-width="4" stroke-linecap="round"/>`
    case 'sad':
      return `
        <path d="M82,104 L100,98" stroke="${eyeFill}" stroke-width="4" stroke-linecap="round"/>
        <path d="M138,104 L120,98" stroke="${eyeFill}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="91" cy="120" r="5" fill="${eyeFill}"/><circle cx="129" cy="120" r="5" fill="${eyeFill}"/>
        <path d="M98,156 Q110,148 122,156" fill="none" stroke="#5a6b8a" stroke-width="4" stroke-linecap="round"/>`
    case 'thinking':
      return `
        <rect x="80" y="100" width="20" height="4" rx="2" fill="${eyeFill}"/>
        <path d="M120,98 L140,102" stroke="${eyeFill}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="93" cy="113" r="5" fill="${eyeFill}"/><circle cx="131" cy="113" r="5" fill="${eyeFill}"/>
        <path d="M104,152 Q114,150 120,148" fill="none" stroke="#9a7a5a" stroke-width="4" stroke-linecap="round"/>`
    default: // normal
      return `
        <rect x="80" y="100" width="20" height="4" rx="2" fill="${eyeFill}"/>
        <rect x="120" y="100" width="20" height="4" rx="2" fill="${eyeFill}"/>
        <circle cx="91" cy="117" r="5" fill="${eyeFill}"/><circle cx="129" cy="117" r="5" fill="${eyeFill}"/>
        <path d="M99,150 Q110,156 121,150" fill="none" stroke="#9a6a5a" stroke-width="4" stroke-linecap="round"/>`
  }
}

function hair(c) {
  if (c.style === 'long')
    return `<path d="M48,118 Q44,40 110,38 Q176,40 172,118 Q172,150 162,170 L150,120 Q150,70 110,68 Q70,70 70,120 L58,170 Q48,150 48,118 Z" fill="${c.hair}"/>
            <path d="M70,70 Q110,52 150,70 Q140,60 110,58 Q80,60 70,70 Z" fill="${c.hair2}"/>`
  if (c.style === 'spiky')
    return `<path d="M52,110 L60,55 L78,82 L92,46 L110,80 L128,46 L142,82 L160,55 L168,110 Q150,72 110,70 Q70,72 52,110 Z" fill="${c.hair}"/>`
  // short
  return `<path d="M54,112 Q52,52 110,50 Q168,52 166,112 Q160,78 110,76 Q60,78 54,112 Z" fill="${c.hair}"/>`
}

function glasses(c) {
  if (!c.glasses) return ''
  return `<g fill="none" stroke="#2a2a2a" stroke-width="3">
            <rect x="76" y="108" width="28" height="20" rx="5"/>
            <rect x="116" y="108" width="28" height="20" rx="5"/>
            <line x1="104" y1="116" x2="116" y2="116"/>
          </g>`
}

function characterSvg(c, expr) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 300" width="220" height="300">
  <path d="M30,300 Q34,196 110,190 Q186,196 190,300 Z" fill="${c.shirt}"/>
  <path d="M30,300 Q34,196 110,190 L110,300 Z" fill="#000" opacity="0.07"/>
  <rect x="96" y="158" width="28" height="40" rx="10" fill="${c.skin}"/>
  <ellipse cx="110" cy="120" rx="58" ry="64" fill="${c.skin}"/>
  ${hair(c)}
  ${glasses(c)}
  ${face(expr)}
</svg>`
}

function officeBg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b3550"/><stop offset="1" stop-color="#1a2238"/>
    </linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a9c2e8"/><stop offset="1" stop-color="#d9c79f"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#wall)"/>
  <rect x="120" y="90" width="420" height="260" rx="6" fill="url(#sky)" opacity="0.85"/>
  <line x1="330" y1="90" x2="330" y2="350" stroke="#1a2238" stroke-width="8"/>
  <line x1="120" y1="220" x2="540" y2="220" stroke="#1a2238" stroke-width="8"/>
  <rect x="760" y="120" width="360" height="230" rx="8" fill="#222c44"/>
  <rect x="780" y="140" width="320" height="150" rx="4" fill="#3a4a6b"/>
  <rect x="0" y="470" width="1280" height="250" fill="#141b2e"/>
  <rect x="430" y="430" width="420" height="60" rx="8" fill="#5a4632"/>
  <rect x="455" y="490" width="30" height="180" fill="#4a3a28"/>
  <rect x="795" y="490" width="30" height="180" fill="#4a3a28"/>
</svg>`
}

// 生成
mkdirSync(BG_DIR, { recursive: true })
writeFileSync(join(BG_DIR, 'office.svg'), officeBg())

let count = 1 // 背景
for (const [id, c] of Object.entries(CHARS)) {
  const dir = join(CHAR_DIR, id)
  mkdirSync(dir, { recursive: true })
  for (const expr of EXPRESSIONS) {
    writeFileSync(join(dir, `${expr}.svg`), characterSvg(c, expr))
    count++
  }
}
console.log(`生成完了：${count} ファイル（背景1＋立ち絵${count - 1}）`)
