# テストデータ（TD群）— 自動生成

**このディレクトリは `scripts/gen-testdata.mjs` が生成する。手で編集せず、スクリプトを直して再生成する。**

- 正となる定義：テスト仕様書§6「テストデータ一覧」
- 生成方式：正常な base シナリオ（validator 12項目をすべて満たす最小構成・choice ノードは下限の3つ）を
  ケースごとに **1点だけ壊す／境界値にする**
- 期待挙動は `src/utils/testdata.test.ts` が全ケースで機械検証している（データが劣化したら単体テストが落ちる）

## 切替手順（テスト手順書§1.6）

```
# 切替
VITE_SCENARIOS_PATH=/data/scenarios_test/<ケース> npm run dev
# 復帰（実施後は必ず本番データへ戻す）
npm run dev
```

### ⚠ Windows での注意（2026-08-21 実測）

**Git Bash では上のコマンドは機能しない。** `/data/...` が MSYS2 のパス変換で
`C:/Program Files/Git/data/...` に化け、TD データを読めない。次のいずれかを使う。

```powershell
# PowerShell（推奨）
$env:VITE_SCENARIOS_PATH='/data/scenarios_test/td-scn-001'; npm run dev
# 復帰
Remove-Item Env:VITE_SCENARIOS_PATH; npm run dev
```

```bash
# Git Bash を使う場合は変換を抑止する
MSYS_NO_PATHCONV=1 VITE_SCENARIOS_PATH=/data/scenarios_test/td-scn-001 npm run dev
```

切替後は `http://localhost:5173/src/utils/scenarioLoader.ts` を開き、埋め込まれた値が
`"/data/scenarios_test/<ケース>"` になっていることを確認してからテストを開始する（変換事故の検知）。

## ケース一覧

| ディレクトリ | TD | 内容 | 期待挙動 |
|------------|-----|------|---------|
| `td-scn-001` | TD-SCN-001 | 必須フィールド欠損（speaker を削除） | ValidationError #1 |
| `td-scn-002` | TD-SCN-002 | 参照先ノード不在（choice.next が存在しないIDを指す） | ValidationError #3 |
| `td-scn-003a` | TD-SCN-003 | 選択肢数範囲外（1個・下限未満） | ValidationError #4 |
| `td-scn-003b` | TD-SCN-003 | 選択肢数範囲外（4個・上限超過） | ValidationError #4 |
| `td-scn-004` | TD-SCN-004 | テキスト長超過（本文201文字） | ValidationError #5 |
| `td-scn-005a` | TD-SCN-005 | statusEffects 範囲外（加算値6・上限超過） | ValidationError #6 |
| `td-scn-005b` | TD-SCN-005 | statusEffects 範囲外（0キー・空オブジェクト） | ValidationError #6 |
| `td-scn-006` | TD-SCN-006 | syllabusRefs 欠如（空配列） | ValidationError #7 |
| `td-scn-007` | TD-SCN-007 | 最終ノード不在（next:null の text ノードが無い） | ValidationError #12 |
| `td-scn-008` | TD-SCN-008 | 到達不能ノード（孤立ノードを追加） | 警告 #11（エラーではない・開始は許可） |
| `td-scn-009` | TD-SCN-009 | テキスト長の有効境界（本文200文字ちょうど） | 正常通過 |
| `td-scn-010` | TD-SCN-010 | statusEffects 値の有効境界（1 と 5） | 正常通過 |
| `td-scn-011` | TD-SCN-011 | シナリオ追加の反映（正常シナリオ2本・index に2エントリ） | 正常通過・index.json が2件 |
| `td-scn-012` | TD-SCN-012 | 長文フィードバック（explanation 400文字ちょうど） | 正常通過 |
| `td-sec` | TD-SEC | XSS注入（本文・解説・タイトルに script タグ等を含む） | 正常通過（validator は通る）。表示側でエスケープされることを確認するデータ |

## TD-STORAGE（データ不要・ブラウザ操作）

localStorage を利用不可にした状態を再現する（プライベートブラウズ、またはブラウザ設定でサイトのデータ保存を禁止）。
対象：FT-008-002-TC-001・ST-RC-001-TC-002・FT-001-003（保存不可注記の表示）。

## TD-SAVE（DevTools で localStorage に投入する文字列）

キー `testquest:save` に以下を投入する（対象：FT-008-002-TC-002）。

```js
// (a) version 不一致
localStorage.setItem('testquest:save', JSON.stringify({ version: 999, status: {}, cleared: {} }))

// (b) 型不正（status が数値・cleared が配列）
localStorage.setItem('testquest:save', JSON.stringify({ version: 1, status: 0, cleared: [] }))

// (c) JSON として壊れている
localStorage.setItem('testquest:save', '{"version":1,')
```

期待：console.error が出て「読み込めません」相当の扱いになり、**セーブを消さず**「はじめから」は活性のままであること。
