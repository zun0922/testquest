// FR-P2-005 既読記録の単体テスト。
// 要点：①ノード単位で記録する ②壊れていても「未読」として通常どおり遊べる
//      ③保存できない環境でもそのセッション中は既読が効く
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  EMPTY_READ_LOG,
  READ_KEY,
  clearReadLog,
  isRead,
  loadReadLog,
  markRead,
  readCount,
} from './readLog'

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('loadReadLog', () => {
  it('記録が無ければ空を返す', () => {
    expect(loadReadLog()).toEqual(EMPTY_READ_LOG)
  })

  it('保存した記録を読み戻せる', () => {
    const log = markRead(EMPTY_READ_LOG, 'fl-1-01', 'n1')
    expect(loadReadLog()).toEqual(log)
  })

  it('壊れたJSONは空として扱う（例外を投げない）', () => {
    localStorage.setItem(READ_KEY, '{壊れている')
    expect(loadReadLog()).toEqual(EMPTY_READ_LOG)
  })

  it('形が違う記録も空として扱う', () => {
    localStorage.setItem(READ_KEY, JSON.stringify({ version: 2, nodes: {} }))
    expect(loadReadLog()).toEqual(EMPTY_READ_LOG)
    localStorage.setItem(READ_KEY, JSON.stringify({ version: 1, nodes: { 'fl-1-01': [1, 2] } }))
    expect(loadReadLog()).toEqual(EMPTY_READ_LOG)
  })

  it('localStorage が使えなくても空を返す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable')
    })
    expect(loadReadLog()).toEqual(EMPTY_READ_LOG)
  })
})

describe('markRead / isRead', () => {
  it('ノード単位で既読になる（同じシナリオの別ノードは未読のまま）', () => {
    const log = markRead(EMPTY_READ_LOG, 'fl-1-01', 'n1')
    expect(isRead(log, 'fl-1-01', 'n1')).toBe(true)
    expect(isRead(log, 'fl-1-01', 'n2')).toBe(false)
    expect(isRead(log, 'fl-1-02', 'n1')).toBe(false)
  })

  it('引数の記録は書き換えない（新しい記録を返す）', () => {
    const before = markRead(EMPTY_READ_LOG, 'fl-1-01', 'n1')
    const after = markRead(before, 'fl-1-01', 'n2')
    expect(readCount(before, 'fl-1-01')).toBe(1)
    expect(readCount(after, 'fl-1-01')).toBe(2)
  })

  it('同じノードを重ねて記録しても増えない', () => {
    let log = markRead(EMPTY_READ_LOG, 'fl-1-01', 'n1')
    log = markRead(log, 'fl-1-01', 'n1')
    expect(readCount(log, 'fl-1-01')).toBe(1)
  })

  it('保存に失敗してもその場の記録は返る（セッション中はスキップが効く）', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const log = markRead(EMPTY_READ_LOG, 'fl-1-01', 'n1')
    expect(isRead(log, 'fl-1-01', 'n1')).toBe(true)
  })
})

describe('clearReadLog', () => {
  it('記録を消せる', () => {
    markRead(EMPTY_READ_LOG, 'fl-1-01', 'n1')
    clearReadLog()
    expect(loadReadLog()).toEqual(EMPTY_READ_LOG)
  })
})

describe('進捗データとの分離', () => {
  it('既読は進捗（testquest:save）とは別キーに保存する', () => {
    markRead(EMPTY_READ_LOG, 'fl-1-01', 'n1')
    expect(READ_KEY).not.toBe('testquest:save')
    expect(localStorage.getItem('testquest:save')).toBeNull()
    expect(localStorage.getItem(READ_KEY)).not.toBeNull()
  })
})
