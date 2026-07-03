// テキスト送り（30ms/文字）。設計書 v1.1 §5.3・§10。
// E2E用フック ?skipTyping=1 で即時全文表示（本番UIに影響しない）。
import { useEffect, useState, useCallback } from 'react'

const CHAR_MS = 30

function skipTypingFromUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('skipTyping') === '1'
  } catch {
    return false
  }
}

export interface Typewriter {
  shown: string // 現在表示中のテキスト
  done: boolean // 全文表示が完了したか
  skip: () => void // 送り中なら全文即時表示
}

export function useTypewriter(text: string): Typewriter {
  const skipAll = skipTypingFromUrl()
  const [count, setCount] = useState(skipAll ? text.length : 0)

  // テキストが変わったら先頭から送り直す（skip 時は即全文）
  useEffect(() => {
    setCount(skipAll ? text.length : 0)
  }, [text, skipAll])

  // 1文字ずつ進める
  useEffect(() => {
    if (count >= text.length) return
    const id = window.setTimeout(() => setCount((c) => c + 1), CHAR_MS)
    return () => window.clearTimeout(id)
  }, [count, text])

  const skip = useCallback(() => setCount(text.length), [text])

  return {
    shown: text.slice(0, count),
    done: count >= text.length,
    skip,
  }
}
