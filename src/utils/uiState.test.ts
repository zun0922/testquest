// 選択画面の折り畳み状態（UI設定・進捗データとは別キー）の単体テスト
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  chapterOpenKey,
  levelOpenKey,
  loadOverrides,
  saveOverrides,
  UI_KEY,
} from './uiState'
import { SAVE_KEY } from './storage'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('キー生成', () => {
  it('レベル・章で衝突しないキーを作る', () => {
    expect(levelOpenKey('fl')).toBe('lv:fl')
    expect(chapterOpenKey('fl', 2)).toBe('ch:fl-2')
    expect(chapterOpenKey('al-tm', 1)).toBe('ch:al-tm-1')
    expect(levelOpenKey('fl')).not.toBe(chapterOpenKey('fl', 1))
  })

  it('進捗データとは別の localStorage キーを使う（セーブ仕様に影響しない）', () => {
    expect(UI_KEY).not.toBe(SAVE_KEY)
  })
})

describe('loadOverrides / saveOverrides', () => {
  it('未保存なら空（＝すべて自動判定に従う）', () => {
    expect(loadOverrides()).toEqual({})
  })

  it('保存した開閉状態を復元する', () => {
    saveOverrides({ 'lv:fl': false, 'ch:al-tm-1': true })
    expect(loadOverrides()).toEqual({ 'lv:fl': false, 'ch:al-tm-1': true })
  })

  it('保存は進捗データ（testquest:save）を書き換えない', () => {
    localStorage.setItem(SAVE_KEY, 'PROGRESS')
    saveOverrides({ 'lv:fl': true })
    expect(localStorage.getItem(SAVE_KEY)).toBe('PROGRESS')
  })

  it('壊れたJSONなら空を返す（画面は自動判定で成立する）', () => {
    localStorage.setItem(UI_KEY, '{壊れている')
    expect(loadOverrides()).toEqual({})
  })

  it('boolean 以外が混ざる不正データは丸ごと無視する', () => {
    localStorage.setItem(UI_KEY, JSON.stringify({ version: 1, open: { 'lv:fl': 'yes' } }))
    expect(loadOverrides()).toEqual({})
  })

  it('open が無い・配列などの想定外形状でも空を返す', () => {
    localStorage.setItem(UI_KEY, JSON.stringify({ version: 1 }))
    expect(loadOverrides()).toEqual({})
    localStorage.setItem(UI_KEY, JSON.stringify({ version: 1, open: ['lv:fl'] }))
    expect(loadOverrides()).toEqual({})
  })

  it('保存が例外（Quota等）でも throw しない（UI設定のため無視する）', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => saveOverrides({ 'lv:fl': true })).not.toThrow()
  })

  it('読み込みが例外（localStorage 利用不可）でも空を返す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(loadOverrides()).toEqual({})
  })
})
