import type { Config } from 'tailwindcss'

// 設計書 v1.1 §7.1 カラーパレット（モックA案から抽出）。
// カラーコードはここで一元管理し、コンポーネントにハードコードしない。
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#10141f',
        surface: '#141b2e',
        'surface-light': '#1b2440',
        line: '#2e3a55',
        accent: '#ffd97a',
        'text-main': '#e8e8f0',
        'text-muted': '#9aa4bd',
        'rating-best': '#2e9e6b',
        'rating-good': '#e6b73c',
        'rating-poor': '#c0504d',
        'status-knowledge': '#4da3ff',
        'status-skill': '#ffa94d',
        'status-confidence': '#ffd54d',
        'status-teamwork': '#5ee6a8',
        'status-gain': '#8ef0c4',
        // クリア済み表示（選択画面のシナリオ・章の完了。status-gain と同値の明るい緑＝達成の色）
        cleared: '#8ef0c4',
        // ヒントの強調（FR-P2-007）。選択肢の透過ゴールド背景の上でコントラストが出る明るいシアン。
        // rating 3色（緑/黄/赤）とも status メーター色とも用途が重ならない色を選ぶ。
        hint: '#7ce0ff',
      },
      fontFamily: {
        sans: ["'Segoe UI'", "'Hiragino Sans'", "'Meiryo'", 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
