---
paths:
  - "**/*.tsx"
  - "**/hooks/**/*.ts"
---

# React setState コールバックに副作用を含めない

- `setState`（updater 関数）の中は pure に保つ
- localStorage 書き込み・API 呼び出し・console 出力などの副作用は setState の外（イベントハンドラ本体や useEffect）で行う
- **理由**：StrictMode では updater が二重実行されるため、副作用が二重に走る（localStorage 二重書き込み・API 二重送信など）
