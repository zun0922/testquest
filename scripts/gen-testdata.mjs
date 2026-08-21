// テストデータ（TD群）の生成 — 宿題B-3
//
// テスト仕様書§6「テストデータ一覧」の TD-SCN-001〜012・TD-SEC を
// public/data/scenarios_test/<ケース>/ に生成する。
//
// 方式：正常な base シナリオを1本定義し、ケースごとに「1点だけ壊す（または境界値にする）」。
// 手書きだと壊し忘れ・二重の壊れが混入するため、決定的スクリプトで生成する。
//
// 使い方:
//   node scripts/gen-testdata.mjs            # 生成（既存は上書き）
//   node scripts/gen-testdata.mjs --dry-run  # 生成せず一覧のみ
//
// 切替（テスト実施時）:
//   VITE_SCENARIOS_PATH=/data/scenarios_test/<ケース> npm run dev
//   ※ 実施後は環境変数なしで再起動して本番データへ復帰する（手順書§1.6）

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_ROOT = path.join(ROOT, 'public/data/scenarios_test')
const DRY_RUN = process.argv.includes('--dry-run')

const clone = (o) => JSON.parse(JSON.stringify(o))
/** 指定文字数ちょうどの日本語文字列（先頭に意味のある文＋パディング）。 */
const pad = (n, head = 'テストデータ用の本文。') =>
  head.length >= n ? head.slice(0, n) : head + 'あ'.repeat(n - head.length)

const CHARS = [
  { characterId: 'tanaka', expression: 'normal', position: 'left' },
  { characterId: 'rin', expression: 'normal', position: 'right' },
]

/** 正常な選択肢を1つ作る。 */
function choice(text, rating, next, effects = { knowledge: 2 }, explanation = 'テストデータ用の解説文です。') {
  return {
    text,
    rating,
    statusEffects: effects,
    feedback: { explanation, syllabusRefs: ['1.1'] },
    next,
  }
}

/** 正常な choice ノードを1つ作る（選択肢3つ）。 */
function choiceNode(id, next) {
  return {
    id,
    type: 'choice',
    background: 'office',
    characters: clone(CHARS),
    speaker: 'tanaka',
    text: `テストデータ用の設問（${id}）。どれを選びますか？`,
    choices: [
      choice('最も適切な選択肢', 'best', next, { knowledge: 3, confidence: 1 }),
      choice('部分的に正しい選択肢', 'good', next, { knowledge: 2 }),
      choice('誤りを含む選択肢', 'poor', next, { knowledge: 1 }),
    ],
  }
}

/**
 * 正常な base シナリオ。validator 12項目をすべて満たす最小構成
 * （choice ノードは #10 の下限である 3 つ）。
 */
function baseScenario() {
  return {
    id: 'td-base',
    title: 'テストデータ基準シナリオ',
    startNodeId: 'intro',
    nodes: [
      {
        id: 'intro',
        type: 'text',
        background: 'office',
        characters: [],
        speaker: 'narration',
        text: 'これはテストデータ用の基準シナリオです。検証の基準となる正常なデータです。',
        next: 'q1',
      },
      choiceNode('q1', 'q2'),
      choiceNode('q2', 'q3'),
      choiceNode('q3', 'end'),
      {
        id: 'end',
        type: 'text',
        background: 'office',
        characters: clone(CHARS),
        speaker: 'rin',
        text: 'ここが最終ノードです。お疲れさまでした。',
        next: null,
      },
    ],
  }
}

function indexFor(entries) {
  return { version: 1, scenarios: entries }
}

const baseEntry = {
  id: 'td-base',
  title: 'テストデータ基準シナリオ',
  level: 'FL',
  chapter: 1,
  order: 1,
  estimatedMinutes: 5,
  file: 'td/td-base.json',
}

/** ケース定義：build は base を受け取り {scenarios, index} を返す。 */
const CASES = [
  {
    dir: 'td-scn-001',
    td: 'TD-SCN-001',
    purpose: '必須フィールド欠損（speaker を削除）',
    expect: 'ValidationError #1',
    build: (s) => {
      const q1 = s.nodes.find((n) => n.id === 'q1')
      delete q1.speaker
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-002',
    td: 'TD-SCN-002',
    purpose: '参照先ノード不在（choice.next が存在しないIDを指す）',
    expect: 'ValidationError #3',
    build: (s) => {
      s.nodes.find((n) => n.id === 'q1').choices[0].next = 'no-such-node'
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-003a',
    td: 'TD-SCN-003',
    purpose: '選択肢数範囲外（1個・下限未満）',
    expect: 'ValidationError #4',
    build: (s) => {
      const q1 = s.nodes.find((n) => n.id === 'q1')
      q1.choices = [q1.choices[0]]
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-003b',
    td: 'TD-SCN-003',
    purpose: '選択肢数範囲外（4個・上限超過）',
    expect: 'ValidationError #4',
    build: (s) => {
      const q1 = s.nodes.find((n) => n.id === 'q1')
      q1.choices.push(choice('4つめの選択肢', 'poor', 'q2'))
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-004',
    td: 'TD-SCN-004',
    purpose: 'テキスト長超過（本文201文字）',
    expect: 'ValidationError #5',
    build: (s) => {
      s.nodes.find((n) => n.id === 'intro').text = pad(201)
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-005a',
    td: 'TD-SCN-005',
    purpose: 'statusEffects 範囲外（加算値6・上限超過）',
    expect: 'ValidationError #6',
    build: (s) => {
      s.nodes.find((n) => n.id === 'q1').choices[0].statusEffects = { knowledge: 6 }
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-005b',
    td: 'TD-SCN-005',
    purpose: 'statusEffects 範囲外（0キー・空オブジェクト）',
    expect: 'ValidationError #6',
    build: (s) => {
      s.nodes.find((n) => n.id === 'q1').choices[0].statusEffects = {}
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-006',
    td: 'TD-SCN-006',
    purpose: 'syllabusRefs 欠如（空配列）',
    expect: 'ValidationError #7',
    build: (s) => {
      s.nodes.find((n) => n.id === 'q1').choices[0].feedback.syllabusRefs = []
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-007',
    td: 'TD-SCN-007',
    purpose: '最終ノード不在（next:null の text ノードが無い）',
    expect: 'ValidationError #12',
    build: (s) => {
      s.nodes.find((n) => n.id === 'end').next = 'intro'
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-008',
    td: 'TD-SCN-008',
    purpose: '到達不能ノード（孤立ノードを追加）',
    expect: '警告 #11（エラーではない・開始は許可）',
    build: (s) => {
      s.nodes.push({
        id: 'orphan',
        type: 'text',
        background: 'office',
        characters: [],
        speaker: 'narration',
        text: 'このノードはどこからも参照されていません（到達不能）。',
        next: null,
      })
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-009',
    td: 'TD-SCN-009',
    purpose: 'テキスト長の有効境界（本文200文字ちょうど）',
    expect: '正常通過',
    build: (s) => {
      s.nodes.find((n) => n.id === 'intro').text = pad(200)
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-010',
    td: 'TD-SCN-010',
    purpose: 'statusEffects 値の有効境界（1 と 5）',
    expect: '正常通過',
    build: (s) => {
      const q1 = s.nodes.find((n) => n.id === 'q1')
      q1.choices[0].statusEffects = { knowledge: 5 }
      q1.choices[1].statusEffects = { skill: 1 }
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-scn-011',
    td: 'TD-SCN-011',
    purpose: 'シナリオ追加の反映（正常シナリオ2本・index に2エントリ）',
    expect: '正常通過・index.json が2件',
    build: (s) => {
      const added = clone(s)
      added.id = 'td-added'
      added.title = '追加テスト用シナリオ'
      return {
        scenarios: [s, added],
        index: indexFor([
          baseEntry,
          { ...baseEntry, id: 'td-added', title: '追加テスト用シナリオ', order: 2, file: 'td/td-added.json' },
        ]),
      }
    },
  },
  {
    dir: 'td-scn-012',
    td: 'TD-SCN-012',
    purpose: '長文フィードバック（explanation 400文字ちょうど）',
    expect: '正常通過',
    build: (s) => {
      s.nodes.find((n) => n.id === 'q1').choices[0].feedback.explanation = pad(
        400,
        'これは解説の文字数上限（400字）ちょうどのテストデータです。表示が崩れないか、スクロールが必要な場合に操作できるかを確認します。',
      )
      return { scenarios: [s] }
    },
  },
  {
    dir: 'td-sec',
    td: 'TD-SEC',
    purpose: 'XSS注入（本文・解説・タイトルに script タグ等を含む）',
    expect: '正常通過（validator は通る）。表示側でエスケープされることを確認するデータ',
    build: (s) => {
      const xss = '<script>alert(1)</script>'
      s.title = `XSSテスト${xss}`
      s.nodes.find((n) => n.id === 'intro').text = `本文に注入します ${xss} 表示されればエスケープ失敗。`
      const q1 = s.nodes.find((n) => n.id === 'q1')
      q1.text = `設問にも注入します <img src=x onerror=alert(2)>`
      q1.choices[0].text = `選択肢に注入 ${xss}`
      q1.choices[0].feedback.explanation = `解説に注入します ${xss} と "><b>太字化</b> を含みます。`
      return {
        scenarios: [s],
        index: indexFor([{ ...baseEntry, title: `XSSテスト${xss}` }]),
      }
    },
  },
]

const written = []
for (const c of CASES) {
  const built = c.build(baseScenario())
  const files = built.scenarios.map((sc) => ({
    rel: `td/${sc.id}.json`,
    body: JSON.stringify(sc, null, 2) + '\n',
  }))
  const idx = built.index ?? indexFor([baseEntry])

  if (!DRY_RUN) {
    const dir = path.join(OUT_ROOT, c.dir)
    await mkdir(path.join(dir, 'td'), { recursive: true })
    await writeFile(path.join(dir, 'index.json'), JSON.stringify(idx, null, 2) + '\n', 'utf8')
    for (const f of files) await writeFile(path.join(dir, f.rel), f.body, 'utf8')
  }
  written.push({ ...c, files: files.length })
  console.log(`${DRY_RUN ? 'plan' : 'ok  '}  ${c.dir.padEnd(14)} ${c.td.padEnd(12)} ${c.purpose}`)
}

// README（対応表・使い方・TD-SAVE 投入文字列）
const readme = `# テストデータ（TD群）— 自動生成

**このディレクトリは \`scripts/gen-testdata.mjs\` が生成する。手で編集せず、スクリプトを直して再生成する。**

- 正となる定義：テスト仕様書§6「テストデータ一覧」
- 生成方式：正常な base シナリオ（validator 12項目をすべて満たす最小構成・choice ノードは下限の3つ）を
  ケースごとに **1点だけ壊す／境界値にする**
- 期待挙動は \`src/utils/testdata.test.ts\` が全ケースで機械検証している（データが劣化したら単体テストが落ちる）

## 切替手順（テスト手順書§1.6）

\`\`\`
# 切替
VITE_SCENARIOS_PATH=/data/scenarios_test/<ケース> npm run dev
# 復帰（実施後は必ず本番データへ戻す）
npm run dev
\`\`\`

### ⚠ Windows での注意（2026-08-21 実測）

**Git Bash では上のコマンドは機能しない。** \`/data/...\` が MSYS2 のパス変換で
\`C:/Program Files/Git/data/...\` に化け、TD データを読めない。次のいずれかを使う。

\`\`\`powershell
# PowerShell（推奨）
$env:VITE_SCENARIOS_PATH='/data/scenarios_test/td-scn-001'; npm run dev
# 復帰
Remove-Item Env:VITE_SCENARIOS_PATH; npm run dev
\`\`\`

\`\`\`bash
# Git Bash を使う場合は変換を抑止する
MSYS_NO_PATHCONV=1 VITE_SCENARIOS_PATH=/data/scenarios_test/td-scn-001 npm run dev
\`\`\`

切替後は \`http://localhost:5173/src/utils/scenarioLoader.ts\` を開き、埋め込まれた値が
\`"/data/scenarios_test/<ケース>"\` になっていることを確認してからテストを開始する（変換事故の検知）。

## ケース一覧

| ディレクトリ | TD | 内容 | 期待挙動 |
|------------|-----|------|---------|
${written.map((c) => `| \`${c.dir}\` | ${c.td} | ${c.purpose} | ${c.expect} |`).join('\n')}

## TD-STORAGE（データ不要・ブラウザ操作）

localStorage を利用不可にした状態を再現する（プライベートブラウズ、またはブラウザ設定でサイトのデータ保存を禁止）。
対象：FT-008-002-TC-001・ST-RC-001-TC-002・FT-001-003（保存不可注記の表示）。

## TD-SAVE（DevTools で localStorage に投入する文字列）

キー \`testquest:save\` に以下を投入する（対象：FT-008-002-TC-002）。

\`\`\`js
// (a) version 不一致
localStorage.setItem('testquest:save', JSON.stringify({ version: 999, status: {}, cleared: {} }))

// (b) 型不正（status が数値・cleared が配列）
localStorage.setItem('testquest:save', JSON.stringify({ version: 1, status: 0, cleared: [] }))

// (c) JSON として壊れている
localStorage.setItem('testquest:save', '{"version":1,')
\`\`\`

期待：console.error が出て「読み込めません」相当の扱いになり、**セーブを消さず**「はじめから」は活性のままであること。
`

if (!DRY_RUN) {
  await mkdir(OUT_ROOT, { recursive: true })
  await writeFile(path.join(OUT_ROOT, 'README.md'), readme, 'utf8')
}

console.log('')
console.log(`${written.length} cases${DRY_RUN ? ' (dry run)' : ` written to ${path.relative(ROOT, OUT_ROOT)}`}`)
