# TestQuest — JSTQB テストエンジニア育成ゲーム — CLAUDE.md

Claude Code がセッション開始時に最初に読み込むファイル。
開発体制・フローはクロスワードゲーム開発プロジェクト（`../crossword/jstqb-crossword-starter/`）を踏襲する。

---

## 1. スキルファイルの読み込み（skills/ — クロスワードから引き継ぎ）

`.skill` ファイルはZIPアーカイブ。`unzip -p <file>` で SKILL.md を展開して読む。

### 最優先（常時参照）
- `skills/y-koizumi-profile.skill`：POのプロファイル・思考傾向・AIのフォロー方針
- `skills/improvement-proposal.skill`：スキル更新・プロセス改善の提案基準
- `skills/self-review.skill`：成果物出力前のセルフレビュー観点
- `skills/growth-tracker.skill`：協働の成長記録（クロスワードからの引き継ぎコピー。分岐に注意 — 共有資産化を検討中）

### ドキュメント作成時に参照
- `skills/requirements-engineering.skill` / `software-design.skill` / `test-planning.skill` / `test-spec.skill` / `test-procedure.skill`

### プロジェクト管理・品質管理時に参照
- `skills/project-management.skill`
- `skills/configuration-management.skill`（**v1.6・TestQuest適合改訂済み 2026-07-16**。ディレクトリ構成のSSOTは本ファイル§7。改訂起案：`docs/スキル適合改訂案_configuration-management_v0.1.md`）

### 機能テスト・自動化時に参照
- `skills/test-execution.skill` / `test-automation.skill`

### 画像アセット制作時に参照（本プロジェクト固有）
- `skills/image-asset-production.skill`：キャラ立ち絵・背景のAI生成（設計→生成→採用→表情差分→組み込みの判断フロー・落とし穴・サービス検証履歴）。ルールは `.claude/rules/project/image-assets.md`（2026-07-03作成）

### シナリオ制作時に参照（本プロジェクト固有）
- `skills/scenario-authoring.skill`：学習シナリオの制作（シラバス精読→起案→監修→JSON化→検証の判断フロー・評価基準〔迷ったらpoor〕・配分ルール・validator 12項目・著作権配慮・落とし穴）。FL第1章制作で確立した知見を体系化。クロスワードの `istqb-crossword-terms.skill` に相当する本プロジェクト固有スキル（2026-07-03作成・PO承認済み）。**2026-07-05 かく乱肢（distractor）設計を追加**（原則3択・3類型・FL/AL難易度傾斜・good＝誤りを含まない部分正答。evaluation-rubric §1.6。**PO承認済み 2026-07-05**）

---

## 2. ルール構成（.claude/rules/）

```
.claude/rules/
├── common/    ← 汎用（マスター: ../claude-rules-library/・ここでは編集しない）
│   ├── react/      IME composition・setState副作用禁止
│   ├── testing/    VR baseline・テストデータ原則・デプロイ待ち
│   └── workflow/   Git規約（常時ロード）・ライセンスポリシー
└── project/   ← このプロジェクト固有（自由に編集）
    └── image-assets.md   画像アセットの生成・承認・配置ルール（2026-07-03）
```

- 汎用ルールの改善は library 側を更新 → `sync.ps1 -Target .\testsim` で再配布

---

## 3. プロジェクトドキュメント

| ドキュメント | パス | 状態 |
|------------|------|------|
| 企画書 ver.1.2 | `企画書_TestQuest_v1.2.md` | ✅ 承認済み（2026-06-13） |
| シラバス抽出テキスト（AL-TM V3.0 J03） | `シラバス抽出_AL-TM_V3.0_J03.txt` | 参照資料 |
| シラバス抽出テキスト（AL-TTA V4.0 J01） | `シラバス抽出_AL-TTA_V4.0_J01.txt` | 参照資料 |
| 要件定義書 | `docs/`（未作成） | 🔄 次の成果物 |
| 開発フロー・役割分担定義（TestQuest版） | `docs/`（未作成） | 🔲 要件定義書と並行作成 |
| 作業ログ（中断・再開用） | `docs/worklog.md` | 運用中 |

参照シラバスPDF（親フォルダ `../`）：FL V4.0 J02 / AL-TM V3.0 J03 / AL-TTA 2024 V4.0 J01 / AL-TA V3.1.1 J03（5.4 拡張用）

---

## 4. 技術スタック（企画書10章で定義・要件定義で確定）

| 領域 | 技術 | 備考 |
|------|------|------|
| フロントエンド | React + TypeScript + Vite | クロスワードと同一構成 |
| スタイリング | Tailwind CSS | |
| シナリオ管理 | JSONベースの静的データ | 参照シラバス項番を保持 |
| 進捗保存 | localStorage（v1.0）→ Supabase（v2.0） | |
| ホスティング | Vercel | |
| E2E | Playwright | クロスワードのノウハウ流用 |

---

## 5. 開発フロー（クロスワード「開発フロー・役割分担定義 v10.1」準拠）

```
STEP 1：仕様確認（AI）→ 不明点を人間に確認してから着手
STEP 2：設計（AI）
STEP 3：設計レビュー（人間承認）
STEP 4：実装（AI）
STEP 5：AIセルフレビュー（AI）→ self-review.skill の汎用5観点
STEP 6：機能テスト（人間・AIサポート）
```

シナリオ制作も同じ構造（STEP 2＝シナリオ案生成、STEP 3＝監修レビュー、STEP 4＝JSONデータ化、STEP 6＝通し確認）。

### AIの行動原則（クロスワードから継承）

- 出力前に必ずセルフレビュー（self-review.skill の5観点）
- 人間のレビューなしに次工程へ進まない
- 曖昧な指示は作業開始前に解消する
- ドキュメント更新はバージョン管理・改版履歴に記録
- 中断時は worklog.md とTODOを更新してから終了する

---

## 6. アクティブ TODO

- ✅ 要件定義書 v1.0 承認済み（`docs/要件定義書_v0.1.md`・2026-06-13）
- ✅ デザインモック A案 承認済み（`docs/mockup_a案_ビジュアルノベル風.html`・2026-06-13・レイアウトの正）
- ✅ 設計書 v1.1 承認済み（`docs/設計書_v0.1.md`・2026-06-13 v1.0承認／2026-06-25 v1.1 §10.4 テスト容易性フック `VITE_SCENARIOS_PATH` 追加）
- ✅ テスト計画書 v1.1 承認済み（`docs/テスト計画書_v0.1.md`・2026-06-13 v1.0／2026-06-26 v1.1：§10.7 E2E自動化を全10項目に確定・§10.4 分岐網羅方針）
- ✅ **テスト仕様書 v1.2 承認済み**（2026-06-25・2ファイル構成：本体`テスト仕様書_v0.1.md`§1〜§4＋`テスト仕様書_v0.1_§5-7.md`§5〜§9〔ファイル名は§5-7のままだが内容は§5〜§9〕。v1.0 PO承認→v1.1 非王道ルート TC-005 追加→v1.2 手順書作成時のTD補完 TD-SCN-012〔解説400字〕追加。§8・§9 は逆戻りからの復元版。環境安定時に1ファイルへ統合予定）
- ✅ **テスト手順書 v1.1 承認済み**（2026-06-26 v1.0承認／2026-06-27 v1.1：バッジ色を確定色コードに更新。5ファイル構成：本体`テスト手順書_v0.1.md`〔基盤＋FR-006〕＋`_FR001-003`＋`_FR004-008`＋`_FR009`＋`_§5`。テスト仕様書 v1.2 の全102TC〔FT＋ST〕＋CQ を網羅）
- 🔄 **実装（Phase 1）進行中**（足場＋utils層＋単体テスト完了＝2026-06-26）
  - ✅ 足場（Vite+React+TS+Tailwind+Vitest）・型（`src/types`）・utils4種（status/validator/storage/scenarioLoader）・単体テスト37件PASS・`VITE_SCENARIOS_PATH` 実装済み・開発用サンプルシナリオ（`public/data/scenarios/`・監修前）
  - ✅ hooks（useGame/useTypewriter）＋全画面（Title/Select/ScenarioPlayer/Result/Error）＋共通（Button/ConfirmDialog/StatusHud）。data-testid・?skipTyping・カラートークン実装済み。型チェック/37テスト/ビルド/devスモークOK
  - ✅ Playwright E2E（`walkthrough`＋`persistence`）計5件PASS：ハッピーパス＋数値非表示（FT-006-004）＋保存復元(AC-008)＋再プレイ非加算(AC-009)＋壊れJSON回復(AC-010)＋上書き確認(AC-002)。§10.4 主要シナリオ自動化済み。選択肢はハイブリッド透過に確定
  - ✅ CI（`.github/workflows/ci.yml`）：push/PR で型→実行時脆弱性→単体→E2E。ローカルで全ステップ通過確認済み（GitHub push 時に有効化）
  - ✅ 立ち絵/背景アセット（**暫定SVG**・`scripts/gen-assets.mjs` で16枚生成／`src/utils/assets.ts` でパス解決・実PNG差替可）。Stage が背景画像＋立ち絵＋発話者グレーアウト（UI-RULE-004）を描画
  - ✅ 実FL第1章コンテンツ完成（監修承認・AC-012）：`public/data/scenarios/fl-1/fl-1-01〜05.json`（§1.1〜1.5・起案`docs/シナリオ起案_FL第1章_v0.1.md`準拠）。index.json 5本。**データ検証テスト**で5本とも検証12項目クリア（`scenarios.data.test.ts`）。実画面で動作確認済み
  - 🔲 実装時残：TD群の実データ準備・評価バッジ色コード確定（モックA案/設計§7）
  - ✅ **B-1 本格アート差し替え完了**（2026-07-02）：立ち絵3キャラ×5表情＋office背景（1920×1080）を実PNG化し `public/images/` へ配置・`assets.ts` EXT→png。単体44件＋E2E 6件 全PASS・実画面確認済み
    - 生成方式：**Gemini API（`gemini-3.1-flash-image`・課金≈6円/枚）による画像編集方式**（採用画像を入力に表情のみ変更）。無課金経路（Pollinations seed固定/kontext/表情シート/Stable Horde）は目の対称性・スケール一貫性で品質不達（検証記録は採用記録参照）
    - ドキュメント：設定書v1.2／プロンプト集v1.2（Gemini編集方式）／採用記録v0.2（`docs/画像採用記録_v0.1.md`）
    - APIキー：ユーザー環境変数 `GEMINI_API_KEY`（課金有効・リポジトリにコミット禁止）
    - ⚠ 残宿題：①類似性確認（採用16枚の画像検索逆引き）未実施 ②編集系譜にPollinations製が残る点を法務確認D2へ引き継ぎ ③立ち絵実解像度896×1194（推奨1600px未達・FHDでは十分）
    - ✅ スクリプト恒久化（2026-07-03）：`scripts/gen-expression-gemini.ps1`（表情差分・演技補正内蔵）／`scripts/remove-bg.mjs`（透過・要 `pngjs`＝devDependency追加済み）／`scripts/gen-explore-pollinations.ps1`（デザイン探索用）
  - ⚠ 設計書のレイアウト記述（ステージ16:9等）と実装（フルビューポート）の乖離は別件（PO判断待ち・宿題リスト行き候補）
    - 2026-07-02 立ち絵表示をPO承認で調整：高さ58vh→**68vh**・2体時は**左右分散（justify-around・1体時は中央）**（`ScenarioPlayer.tsx`）。設計書の「左右配置」の意図に接近。設計書改版時にこの実測値で§レイアウト表を更新すること
- ⚠ **運用方針：git へ頻繁に push しない**（PO指示・本リポは現状git管理外。AIからcommit/pushしない。memory `feedback_infrequent_git_push.md`）
- 📋 **保留・要対応の宿題は `docs/宿題リスト_v1.0.md` に集約**（A=PO判断・C-1=✅完了／残: B-1本格アート・B-2 vite8更新・B-3 TD実データ・D ロードマップ）
  - ⚠ dev依存に脆弱性5件（vite/vitest系・実行時0件）。vite8更新は別途判断
- 🔲 開発フロー・役割分担定義のTestQuest版作成（v10.1を複製しシナリオ制作工程を追加）
- ✅ configuration-management.skill のTestQuest適合改訂（v1.6・2026-07-16 PO承認。§7 ディレクトリ構成を新設し節参照を名前参照化）
- ✅ シナリオ制作スキルの新規作成（`skills/scenario-authoring.skill`・2026-07-03 **PO承認**。評価基準に「迷ったらpoor」を含む。FL第2章以降の起案はこのスキルを発動）
- ✅ **FL第2章コンテンツ完成**（2026-07-03・監修承認 AC-012）：`public/data/scenarios/fl-2/fl-2-01〜05.json`（§2.1×2＋§2.2×2＋§2.3・起案`docs/シナリオ起案_FL第2章_v0.1.md`準拠・ケンが fl-2-02 に初登場）。index.json 計10本。`SelectScreen` を**データ駆動化**（indexにある章＝活性・ない章＝ロック。第3章以降はデータ追加のみで活性化）。単体50件＋E2E6件 全PASS・実画面スクショPO共有済み
- ✅ **FL第3章コンテンツ完成**（2026-07-03・監修承認 AC-012）：`public/data/scenarios/fl-3/fl-3-01〜05.json`（§3.1×2＋§3.2×3・起案`docs/シナリオ起案_FL第3章_v0.1.md`準拠・poor解説トーンガイドライン初適用）。index.json 計15本（第1〜3章）。単体56件＋E2E6件 全PASS・実画面スクショPO共有済み
- ✅ **FL第4章コンテンツ完成**（2026-07-03・監修承認 AC-012）：`public/data/scenarios/fl-4/fl-4-01〜05.json`（§4.1-4.2×2＋§4.3〜4.5各1・起案`docs/シナリオ起案_FL第4章_v0.1.md`準拠・K3はミニ適用例方式・fl-4-03 にケン登場）。index.json 計20本（第1〜4章）。単体62件＋E2E6件 全PASS・実画面スクショPO共有済み
- ✅ **FL第5・6章コンテンツ完成**（2026-07-03・監修承認 AC-012）：`fl-5/fl-5-01〜05.json`＋`fl-6/fl-6-01〜02.json`（起案`docs/シナリオ起案_FL第5-6章_v0.1.md`準拠・三点見積り/欠陥レポートのミニ適用例・第6章ケン＝調べ役の同期）
- 🎉 **FLシラバス V4.0 全6章コンテンツ完成**（2026-07-03）：index.json **計27本**・決定ポイント104問（good 8）・全6章活性。単体71件＋E2E6件 全PASS・実画面スクショPO共有済み
- 🔲 **通しプレイ総合確認＝人間（PO）実施**（全27本・読み味/演出/学習体験。E2E構造検証は自動化済み。観点チェックシートは要望あればAI作成）
- ✅ **AL-TTA技術メンター2名の画像アセット完備**（2026-07-03）：高橋匠〔takumi・50代〕・伊藤澪〔mio・40代前半〕とも**5表情を `public/images/characters/{takumi,mio}/` に配置済み**（STEP D合格・透過機械検証・回帰PASS・採用記録v0.5）。匠は**遠近感修正済み**（腰上構図→頭部比率47%クロップ・679×905）。設定書v1.4/プロンプト集v1.4（演技補正）/gen-expression-gemini.ps1 に恒久化済み。制作費計≈60円
- 🔄 **AL-TM 進行中（起案はTMから・分割起案原則）**：前半バッチ起案 v0.1 **監修承認済み**（`docs/シナリオ起案_AL-TM第1章前半_v0.1.md`・§1.1〜1.3・7本・DP27・K4×2）。**実装増分完了（2026-07-03）**＝types/validator拡張・項番='TM-x.y.z'形式・**ALレベル別セクションUI（A案）**：`src/utils/levels.ts`（isAlUnlocked＝FL全クリア解放・企画書§5.5）＋SelectScreen 2階層化＋`?unlockAll=1`（dev限定）。設計書 v1.2 改版済み。単体77＋E2E6 PASS
- ✅ **AL-TM 前半バッチ完成**（2026-07-04）：`al-tm-1/al-tm-1-01〜07.json`（AL初のJSON・1-04非収束分岐・項番'TM-x.y.z'・ブリーフィング型K4）。index **総計34本**（FL27＋AL-TM7）。データ検証門番拡張（**FL章門番にlevel条件追加**・TM-項番規約テスト新設）。単体87＋E2E6 PASS・実画面スクショPO共有済み
- 🎉 **AL-TM 第1章完成**（2026-07-04・監修承認）：`al-tm-1/al-tm-1-01〜12.json`（12本・28LO・K4×4〔1-04分岐/1-06/1-08/1-12〕・DP47）。index **総計39本**（FL27＋AL-TM12）。門番12本更新。単体92＋E2E6 PASS・実画面PO共有済み
- ✅ **AL-TM 第2章完成**（2026-07-04・監修承認）：`al-tm-2/al-tm-2-01〜07.json`（7本・12LO・K4×2〔2-02 報告／2-04 技法選択・2案件対比〕）。index **総計46本**（FL27＋AL-TM19）。単体100＋E2E6 PASS・実画面PO共有済み
- 🎉 **AL-TM 全3章・23本完成**（2026-07-04・監修承認）：`al-tm-{1,2,3}/`（12+7+4本・48LO・K4×7・K3×3・最終回=昇進編の区切り演出）。index **総計50本**（FL27＋AL-TM23）。門番＝章別＋AL-TM総数。単体106＋E2E6 PASS・実画面PO共有済み
- ✅ **本番デプロイ完了（D-3・2026-07-04）**：GitHub `zun0922/testquest`（main push＝自動デプロイ＋CI）→ Vercel プロジェクト `testsim`。**Production: https://testsim-three.vercel.app**。スモーク合格（50シナリオ配信・unlockAllは本番バンドル除去済み）。B-4未了での公開はPOリスク了承（社内パイロット限定）
- 🎉🎉 **AL-TTA 全6章・21本完成**（2026-07-04・監修承認）：`al-tta-1〜6/`（1+5+3+6+3+3・企画書§5.3.1どおり）。K4×4〔技法選択・非機能計画・アーキ/コードレビュー〕・K3ミニワーク〔カバレッジ計算・キーワード構築〕・匠メンター・server背景・6-03=技術スペシャリスト編修了（ゲーム全体の最終回）。単体134＋E2E8 PASS・実画面PO共有済み
- 🎉🎉🎉 **企画書 Phase3 全コンテンツ達成＝FL27＋AL-TM23＋AL-TTA21＝総計71本**。3ルート（FL入門／AL-TMマネジメント昇進編／AL-TTAテクニカル）が完結。門番＝章別＋レベル別総数＋全体71本
- 🎉🎉🎉 **かく乱肢改訂・全章展開 完遂（2026-07-11・本番反映済み）**：FL6章＋AL-TM3章＋AL-TTA6章＝**全71本・280問すべて3択化**（2択残0・good計63≈7.5%）。AL編5バッチ＝AL-TM 40+26+14肢／AL-TTA 34+44肢（各バッチ起案→監修承認→決定的スクリプト部分編集〔best不変・削除0〕→単体134/E2E8→push→本番スモーク）。本番全71本の全数検証済み。**通しプレイFB②が全ルートで解消**。worklog 追記35〜40
  - ※「AL-TTA第3〜6章の未反映分をpush」という旧記載は誤り＝`af231ae`で反映済みと判明（worklog追記33の訂正参照）
- ✅ **UI改善：選択画面の折り畳み**（2026-07-25・PO要望→承認）：レベル・章の2階層トグル化（閉じた節は非描画）。初期展開＝**続きの章のみ**（`findContinueChapter`）・開閉は**明示操作＞自動判定**の優先順で `localStorage 'testquest:ui'`（進捗とは別キー）に保存。見出しにクリア進捗（n/N）・**クリア済み＝明るい緑 `cleared #8ef0c4`**（設計書 v1.4 §5.2/§7.1/§10.2）。単体153＋E2E15 PASS
- ✅ **画像圧縮 完了（2026-08-21・PO承認）**：当初案の pngquant（GPL-3.0・削減21%止まり）ではなく **WebP q90** を採用し **27枚 37.6MB → 2.1MB（5.5%・約1/18）**。`alphaQuality:100` で透過エッジ無劣化・`assets.ts` EXT→`webp`・元PNGは `assets-candidates/original-png/` へ退避。恒久スクリプト `scripts/compress-images.mjs`（`--dry-run`/`--force`/`--archive`/`--quality`・冪等）。**`LICENSES.md` を新規作成**（sharp の prebuilt が LGPL-3.0 を含むが devDependency＝配布物に伝播なしの判断根拠を記録）。単体153＋E2E15 PASS・実画面確認済み。※git履歴の旧PNGは残るため `.git` は縮まない（worklog 追記45）
- 🔲 **残タスク**：通しプレイFB反映（確認シート回収待ち・**改訂後の再プレイ推奨**）／ B-4類似性逆引き（匠5＋澪5＋server背景も対象）
- 🔲 **通しプレイ総合確認（PO実施中）**：`docs/通しプレイ確認シート_v0.1.md`（全39本・観点C1-C6/A1-A5/X1-X5）。フィードバック受領後にAIが修正案リスト化
- 🔲 **AL実装の残作業**：①`types`/`validator` の CharacterId に **'takumi'/'mio' 追加（コード変更）**・level 'AL-TM'/'AL-TTA' の index対応 ②server背景（設定書§5.2予約・TTA用）③類似性逆引き（匠5＋澪5を宿題B-4に追加済み）
- ⚠ **ケンの人物像は設定書§4.3「同期エンジニア」が正**（技術メンターではない。AL編メンターは将来の別新キャラ）。2026-07-03 に混同事故→fl-2-02/fl-4-03 の口調を同期風に修正済み・スキルに教訓恒久化（worklog 追記10）
- 🔲 法務確認（クロスワードD2の結果待ち → 流用可否判断）
- 🔲 プロトタイプ（HTML単体版）の本リポジトリへの取り込み検討
- ✅ **環境移行 案B 実行（2026-07-11・PO指示）＝正の作業場所は `C:\dev\testquest`（OneDrive外の clone）**
  - **今後の作業はすべて `C:\dev\testquest` で行う。OneDrive側（本フォルダ）は参照専用アーカイブ**（gitignore対象の原本置き場：`assets-candidates/` 93MB・`シラバス抽出_*.txt`・`e2e-shots/`）。OneDrive側での編集・コミットは禁止
  - PC間同期は git push/pull（**PC切替時は push 必須**）。gitignore対象（シラバス抽出txt・.env.local・.vercel）は clone 先へ手動コピー済み
  - 背景：OneDrive同期による破損が2026-07-11に顕在化（skill 7件ZIP破損・振り返りmd 0バイト化→復旧済み。worklog 追記33）

---

## 7. ディレクトリ構成（配置判断のSSOT・configuration-management.skill が参照）

```
src/
  components/        画面（TitleScreen/SelectScreen/ResultScreen/ErrorScreen）＋ common/（Button・ConfirmDialog・StatusHud）＋ player/（ScenarioPlayer）
  hooks/             useGame・useTypewriter
  types/             型定義
  utils/             status/validator/storage/scenarioLoader/levels/assets（単体テストは *.test.ts を同居）
public/
  data/scenarios/    シナリオJSON＝学習コンテンツの正（fl-1〜6・al-tm-1〜3・al-tta-1〜6・index.json）
  images/            採用済みアセットのみ（characters/{tanaka,rin,ken,takumi,mio}/・backgrounds/）＝**WebP**（2026-08-21圧縮・元PNGは assets-candidates/original-png/）
tests/e2e/           Playwright E2E（walkthrough・persistence・orientation）
scripts/             画像生成・運用スクリプト（gen-expression-gemini.ps1・remove-bg.mjs 等）
docs/                プロジェクトドキュメント（起案・仕様書・手順書・worklog・宿題リスト・採用記録）
skills/              スキルファイル（name.skill＝zip形式）
.claude/rules/       AIルール（common/＝同期コピー・編集禁止、project/＝固有）
.github/workflows/   CI
```

- **ルート直下に置いてよいもの**：CLAUDE.md・企画書・LICENSES.md（依存ライセンス台帳・依存追加時に同一コミットで更新）・ビルド設定（package.json・*.config.*・tsconfig*）・index.html・TestQuest.html（プロトタイプ原本）・.gitignore
- **gitignored（コミット禁止）**：node_modules/・dist/・test-results/・playwright-report/・e2e-shots/・assets-candidates/（候補画像93MB＝原本はOneDrive側・`original-png/`＝WebP圧縮前の採用PNG 27枚37.6MB）・シラバス抽出_*.txt（著作物）・.env*・.vercel
- 新規ディレクトリ追加時は本節＋.gitignore を同一コミットで更新する（configuration-management.skill §1）

---

## 8. 改版履歴

| 日付 | 内容 |
|------|------|
| 2026-06-13 | 初版作成（企画書v1.2承認・クロスワードからルール7件/スキル13件を引き継ぎ） |
| 2026-06-25 | テスト仕様書 v1.0 PO承認（§5〜§9を逆戻りから復元・レビュー確認）→ v1.1 でシナリオテスト網羅性を補強（非王道ルート TC-005 追加）。次はテスト手順書 v0.1 |
| 2026-07-16 | configuration-management.skill v1.6（TestQuest適合改訂・PO承認）に伴い §7「ディレクトリ構成」を新設・旧§7 改版履歴を §8 へ繰り下げ。§1 スキル一覧の注記を更新 |
| 2026-08-21 | 画像圧縮（PNG→WebP q90・37.6MB→2.1MB）完了に伴い §6 TODO を更新・§7 に WebP／`assets-candidates/original-png/`／`LICENSES.md` を反映 |
