// 選択画面の折り畳み状態（UI設定・進捗データとは別キー）の単体テスト
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  chapterOpenKey,
  DEFAULT_VOICE,
  levelOpenKey,
  loadOverrides,
  loadVoiceSettings,
  saveOverrides,
  saveVoiceSettings,
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

describe('音声設定（FR-P2-006）', () => {
  it('未保存なら既定値（ON・音量0.8）を返す', () => {
    expect(loadVoiceSettings()).toEqual(DEFAULT_VOICE)
  })

  it('保存した設定を復元する', () => {
    saveVoiceSettings({ enabled: false, volume: 0.3 })
    expect(loadVoiceSettings()).toEqual({ enabled: false, volume: 0.3 })
  })

  it('音声設定を保存しても折り畳み状態は消えない', () => {
    saveOverrides({ 'lv:fl': false })
    saveVoiceSettings({ enabled: false, volume: 0.5 })
    expect(loadOverrides()).toEqual({ 'lv:fl': false })
  })

  it('折り畳み状態を保存しても音声設定は消えない', () => {
    saveVoiceSettings({ enabled: false, volume: 0.5 })
    saveOverrides({ 'ch:fl-1': true })
    expect(loadVoiceSettings()).toEqual({ enabled: false, volume: 0.5 })
  })

  it('保存は進捗データ（testquest:save）を書き換えない', () => {
    localStorage.setItem(SAVE_KEY, 'PROGRESS')
    saveVoiceSettings({ enabled: false, volume: 0.1 })
    expect(localStorage.getItem(SAVE_KEY)).toBe('PROGRESS')
  })

  it('型不正・音量が範囲外なら既定値に落とす（再生が壊れない）', () => {
    localStorage.setItem(UI_KEY, JSON.stringify({ version: 1, voice: { enabled: 'yes', volume: 0.5 } }))
    expect(loadVoiceSettings()).toEqual(DEFAULT_VOICE)
    localStorage.setItem(UI_KEY, JSON.stringify({ version: 1, voice: { enabled: true, volume: 1.5 } }))
    expect(loadVoiceSettings()).toEqual(DEFAULT_VOICE)
    localStorage.setItem(UI_KEY, JSON.stringify({ version: 1, voice: { enabled: true, volume: -1 } }))
    expect(loadVoiceSettings()).toEqual(DEFAULT_VOICE)
  })

  it('壊れたJSON・利用不可環境でも既定値を返し throw しない', () => {
    localStorage.setItem(UI_KEY, '{壊れている')
    expect(loadVoiceSettings()).toEqual(DEFAULT_VOICE)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => saveVoiceSettings({ enabled: true, volume: 0.2 })).not.toThrow()
  })
})
