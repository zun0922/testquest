---
paths:
  - "**/*.tsx"
  - "**/*.spec.ts"
  - "**/playwright.config.ts"
---

# Visual Regression（VR）運用ルール

## UI 変更時の baseline 再生成（必須手順）
- UI コンポーネントを変更したら、VR テストの baseline を `--update-snapshots` で再生成する
- 再生成した snapshot は `git add` して **UI 変更と同一コミットに同梱** する
- 怠ると CI で VR テストが必ず FAIL し、変更と無関係の赤が出る

## snapshot 命名規則
- TC に紐づくスクリーンショットは `{TC-ID}-vr.png` 形式で命名する（トレース可能性の確保）

## しきい値設計
- `maxDiffPixels` / `threshold` は導入時に明示設定する（デフォルト依存にしない）
- アンチエイリアス差分による flaky を防ぐため、極端に厳しい値は避ける
