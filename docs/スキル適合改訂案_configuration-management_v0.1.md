# スキル適合改訂案：configuration-management.skill（v1.5 → v1.6・TestQuest適合）

| 項目 | 内容 |
|------|------|
| 作成日 | 2026-07-16 |
| 状態 | 起案（STEP 2）→ PO監修レビュー待ち（STEP 3） |
| 対象 | `skills/configuration-management.skill`（クロスワードからの引き継ぎコピー・v1.5） |
| 背景 | CLAUDE.md §1 の注記「クロスワード固有記述が7箇所残存。本格利用前に適合改訂する」の実行 |

## 0. PO決定済みの改訂方針（2026-07-16）

1. **ディレクトリ構成の SSOT は CLAUDE.md に新設**（クロスワードと同じ型・コンパクトな節を追加）
2. **クロスワード固有の事例・経緯は圧縮して残す**（教訓のエッセンスは汎用化して本文に残し、事例詳細は「クロスワードでの確立経緯」の1行注記に。TestQuest 事例を追加）

追加の設計判断（本改訂案で提案）：

3. **スキル内の節番号参照は「名前参照」に統一**：「CLAUDE.md §9」→「CLAUDE.md『ディレクトリ構成』節」。節番号の増減に対して壊れない参照にする
4. **CLAUDE.md への新設位置は §7**（現 §7 改版履歴を §8 へ繰り下げ）。§1〜§6 の番号は不変のため、worklog 等の既存参照（「CLAUDE.md §6」）は壊れない

## 1. 改訂箇所一覧（8箇所）

| # | 箇所 | 現状（クロスワード固有） | 改訂後 |
|---|------|----------------------|--------|
| 1 | frontmatter＋本文全域 | 「CLAUDE.md §9 ディレクトリ構成」参照（TestQuest に §9 は不存在） | 「CLAUDE.md『ディレクトリ構成』節」（名前参照）に全数置換。CLAUDE.md 側に節を新設（§2 参照） |
| 2 | §2 責務表・ルート直下リスト | `slides/`・`presentations/`・`MVP_総括ガイド.md`・`handover.md` | TestQuest 実構成に置換：`assets-candidates/`（gitignored・OneDrive側原本）・`e2e-shots/`（gitignored）・`企画書_TestQuest_v1.2.md`・`TestQuest.html`（プロトタイプ原本）。slides/presentations 行は削除 |
| 3 | §3 VR 命名規則 | DEF-V2-006 の経緯・v2機能テストの詳細（TestQuest は VR 未導入） | 命名規則の要点（`{TC-ID}-vr.png`・spec側ルール・採番方針）は将来導入に備え保持。経緯は「クロスワード DEF-V2-006（2026-05-17）で確立」の1行注記に圧縮。冒頭に「TestQuest では VR 未導入（導入時に本節を適用）」と明記 |
| 4 | §3 命名例・§6 記述粒度の重要ファイル例 | `terms_v1_119words.csv`・`2026-05-15_terms-data-revamp.md`・`terms.csv`・`useTimer.ts` | TestQuest 実例に置換：`index.json`・`scenarioLoader.ts`・`振り返り_2026-07-05_振る舞い評価と改善案.md` 等 |
| 5 | §7・§7.5・§8 の memory 参照3件 | `project_handover_application_protocol.md` 等（TestQuest の memory は空＝不存在を確認済み） | 参照を削除し「クロスワード側 memory で確立（原本はクロスワード環境）」の注記に置換。ルール本文はスキル内で自己完結させる |
| 6 | §7.5 外部ツール出力の構成管理 | Cowork スライド出力の散乱（slides/presentations 前提）・過去事例2件の詳細 | 3層構造（事前ガイダンス／事後整理／ディレクトリ規約）は汎用の骨格として保持。TestQuest の主対象＝**AI画像生成の候補画像**（出力先 `assets-candidates/`・採用済みのみ `public/images/`）に差し替え、**配置ルールの正は `.claude/rules/project/image-assets.md`** と SSOT 関係を明記。クロスワード散乱事故2件は1行圧縮 |
| 7 | §7.6 ルール二層構造 | `AI_WG/claude-rules-library/` パス・「CLAUDE.md スリム化 686行→190行」 | パスを `../claude-rules-library/`（CLAUDE.md §2 と整合）に修正。スリム化数値は「クロスワードで確立」の注記に圧縮 |
| 8 | §9 適用事例 | クロスワード事例3件（e2e/ 移動・MVP振り返り引き上げ・terms.csv バックアップ） | 3件を各1〜2行に圧縮し「クロスワードからの引き継ぎ事例」小節へ。**TestQuest 事例を新規追加**：2026-07-11 環境移行 案B（OneDrive 同期破損 → `C:\dev\testquest` clone を正に・gitignore 対象の手動コピー・OneDrive 側は参照専用アーカイブ化） |

改版履歴に v1.6（2026-07-16・TestQuest適合改訂）を追記する。

## 2. CLAUDE.md 新設節の案文（新 §7「ディレクトリ構成」）

現 §7 改版履歴は §8 へ繰り下げ。以下をそのまま挿入する：

```markdown
## 7. ディレクトリ構成（配置判断のSSOT・configuration-management.skill が参照）

​```
src/
  components/        画面（TitleScreen/SelectScreen/ResultScreen/ErrorScreen）＋ common/ ＋ player/（ScenarioPlayer）
  hooks/             useGame・useTypewriter
  types/             型定義
  utils/             status/validator/storage/scenarioLoader/levels/assets（単体テストは *.test.ts を同居）
public/
  data/scenarios/    シナリオJSON＝学習コンテンツの正（fl-1〜6・al-tm-1〜3・al-tta-1〜6・index.json）
  images/            採用済みアセットのみ（characters/{tanaka,rin,ken,takumi,mio}/・backgrounds/）
tests/e2e/           Playwright E2E（walkthrough・persistence・orientation）
scripts/             画像生成・運用スクリプト（gen-expression-gemini.ps1・remove-bg.mjs 等）
docs/                プロジェクトドキュメント（起案・仕様書・手順書・worklog・宿題リスト・採用記録）
skills/              スキルファイル（name.skill＝zip形式）
.claude/rules/       AIルール（common/＝同期コピー・編集禁止、project/＝固有）
.github/workflows/   CI
​```

- **ルート直下に置いてよいもの**：CLAUDE.md・企画書・ビルド設定（package.json・*.config.*・tsconfig*）・index.html・TestQuest.html（プロトタイプ原本）・.gitignore
- **gitignored（コミット禁止）**：node_modules/・dist/・test-results/・playwright-report/・e2e-shots/・assets-candidates/（候補画像93MB・原本はOneDrive側）・シラバス抽出_*.txt（著作物）・.env*・.vercel
- 新規ディレクトリ追加時は本節＋.gitignore を同一コミットで更新する（configuration-management.skill §1）
```

## 3. 連動更新（STEP 4 で同時実施）

| 対象 | 内容 |
|------|------|
| `skills/configuration-management.skill` | SKILL.md を v1.6 に改訂し zip を `Compress-Archive -Force` で上書き（スキル §8 の上書き原則に従う） |
| CLAUDE.md §1 | スキル一覧の注記「クロスワード固有記述が7箇所残存…」→「TestQuest 適合改訂済み（v1.6・2026-07-16）」に更新 |
| CLAUDE.md 新 §7 | 上記案文を挿入・現 §7 改版履歴を §8 へ |
| CLAUDE.md §6 TODO | 「configuration-management.skill のTestQuest適合改訂」を ✅ に |
| `docs/worklog.md` | 追記（本改訂の記録） |

## 4. 改版履歴（本改訂案）

| 版 | 日付 | 内容 |
|----|------|------|
| v0.1 | 2026-07-16 | 初版起案（PO決定2点＋設計判断2点を反映） |
