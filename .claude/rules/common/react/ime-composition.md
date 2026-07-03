---
paths:
  - "**/*.tsx"
---

# React × 日本語 IME（Composition イベント）の落とし穴

## compositionend と DOM 反映のタイミング
- `onCompositionEnd` 発火時点では、ブラウザはまだ確定テキストを DOM に反映していない
- ハンドラ内で DOM をリセットしても直後にブラウザが上書きする（リセットが無効になる）
- **対処法**：`setTimeout(() => { input.value = resetVal }, 0)` でブラウザの DOM コミット後にリセットする
- 最後に受け入れた値を ref で追跡し、不正入力のリセット先として使用する

## IME 未確定文字とフォーカス離脱の関係
- **ボタンクリックでフォーカス離脱**：`compositionend` が `blur` より先に発火 → 未確定文字が自動確定 → React state に反映される（確定後の値で処理できる）
- **矢印キー等でフォーカス移動**：`compositionend` が発火しないまま `blur` に到達 → `onBlur` ハンドラで未確定文字を破棄し空白として扱う

## テスト自動化の注意
- Playwright で IME を再現する場合は Composition API（`compositionstart`/`compositionend`）を使用
- input への値設定は native value setter + `input` イベント発火で React の `onChange` を確実に経由させる
