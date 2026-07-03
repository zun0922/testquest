import { describe, it, expect, beforeEach, vi } from 'vitest'
import { load, save, clear, isSaveDataV1, isAvailable, SAVE_KEY } from './storage'
import type { SaveDataV1 } from '../types'

const validSave: SaveDataV1 = {
  version: 1,
  status: { knowledge: 13, skill: 12, confidence: 10, teamwork: 10 },
  cleared: {
    'fl-1-01': {
      clearedAt: '2026-06-26T00:00:00.000Z',
      ratings: { best: 3, good: 1, poor: 0 },
      statusGain: { knowledge: 3 },
    },
  },
}

describe('storage.ts（FR-008 保存・型ガード）', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('isAvailable：通常環境では true', () => {
    expect(isAvailable()).toBe(true)
  })

  it('save → load：往復で同一データが復元される', () => {
    save(validSave)
    expect(load()).toEqual(validSave)
  })

  it('clear：削除後は load が null', () => {
    save(validSave)
    clear()
    expect(load()).toBeNull()
  })

  it('未保存時：load は null', () => {
    expect(load()).toBeNull()
  })

  it('FT-008-002-TC-002 相当：version不一致は不正として null＋console.error', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 99, status: validSave.status, cleared: {} }))
    expect(load()).toBeNull()
    expect(err).toHaveBeenCalled()
  })

  it('型不正（status欠損）は不正として null', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, cleared: {} }))
    expect(load()).toBeNull()
  })

  it('壊れたJSON文字列は null（解析失敗）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(SAVE_KEY, '{壊れたJSON')
    expect(load()).toBeNull()
  })

  it('isSaveDataV1：正当データは true・不正は false', () => {
    expect(isSaveDataV1(validSave)).toBe(true)
    expect(isSaveDataV1({ version: 2, status: validSave.status, cleared: {} })).toBe(false)
    expect(isSaveDataV1(null)).toBe(false)
    expect(isSaveDataV1({ version: 1, status: { knowledge: 1 }, cleared: {} })).toBe(false)
  })
})
