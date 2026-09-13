// FR-P2-003 編成パターンの単体テスト。
// 要点：①シナリオJSONを変えずに差し替えられる ②定義が読めなくても既定で動く
import { describe, it, expect, beforeEach } from 'vitest'
import type { CharacterDisplay } from '../types'
import {
  DEFAULT_CASTING,
  DEFAULT_CASTING_ID,
  ensureCastings,
  findCasting,
  hasSwap,
  loadCastings,
  resetCastingCache,
  resolveCharacterId,
  resolveCharacters,
  resolveText,
  type CastingData,
} from './casting'

const DATA: CastingData = {
  version: 1,
  castings: [
    { id: 'default', label: '高橋 匠', description: '', swap: {}, textOverrides: {} },
    {
      id: 'mio',
      label: '伊藤 澪',
      description: '',
      swap: { takumi: 'mio' },
      textOverrides: { 'al-tta-1-01': { intro: '伊藤だ。' } },
    },
  ],
}

const mio = () => findCasting(DATA, 'mio')

beforeEach(() => {
  resetCastingCache()
})

describe('findCasting', () => {
  it('IDで引ける', () => {
    expect(findCasting(DATA, 'mio').label).toBe('伊藤 澪')
  })

  it('未指定・不明なID・定義なしはすべて既定（差し替えなし）', () => {
    expect(findCasting(DATA, undefined)).toBe(DEFAULT_CASTING)
    expect(findCasting(DATA, 'unknown')).toBe(DEFAULT_CASTING)
    expect(findCasting(null, 'mio')).toBe(DEFAULT_CASTING)
    expect(hasSwap(DEFAULT_CASTING)).toBe(false)
  })
})

describe('キャラの差し替え', () => {
  it('対象のキャラだけが入れ替わる', () => {
    expect(resolveCharacterId(mio(), 'takumi')).toBe('mio')
    expect(resolveCharacterId(mio(), 'rin')).toBe('rin')
  })

  it('ナレーションは差し替えない', () => {
    expect(resolveCharacterId(mio(), 'narration')).toBe('narration')
  })

  it('立ち絵は位置と表情を保ったまま入れ替わる', () => {
    const chars: CharacterDisplay[] = [
      { characterId: 'takumi', expression: 'happy', position: 'left' },
      { characterId: 'rin', expression: 'normal', position: 'right' },
    ]
    const out = resolveCharacters(mio(), chars)
    expect(out[0]).toEqual({ characterId: 'mio', expression: 'happy', position: 'left' })
    expect(out[1]).toEqual(chars[1])
  })

  it('既定の編成では配列をそのまま返す（無駄な作り直しをしない）', () => {
    const chars: CharacterDisplay[] = [{ characterId: 'takumi', expression: 'normal', position: 'left' }]
    expect(resolveCharacters(DEFAULT_CASTING, chars)).toBe(chars)
  })
})

describe('本文の差し替え', () => {
  it('差分があるノードだけ置き換わる', () => {
    expect(resolveText(mio(), 'al-tta-1-01', 'intro', '高橋だ。')).toBe('伊藤だ。')
  })

  it('差分が無ければ元の本文のまま（71本を変更しなくてよい根拠）', () => {
    expect(resolveText(mio(), 'al-tta-1-01', 'other', '元の本文')).toBe('元の本文')
    expect(resolveText(mio(), 'al-tta-9-99', 'intro', '元の本文')).toBe('元の本文')
    expect(resolveText(DEFAULT_CASTING, 'al-tta-1-01', 'intro', '高橋だ。')).toBe('高橋だ。')
  })
})

describe('読み込み', () => {
  const okFetch = () =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(DATA) } as unknown as Response)

  it('取得して返す', async () => {
    expect(await loadCastings(okFetch as unknown as typeof fetch)).toEqual(DATA)
  })

  it('404・壊れた内容・通信失敗はすべて null（既定の編成で動く）', async () => {
    const notFound = () => Promise.resolve({ ok: false } as unknown as Response)
    const broken = () =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ version: 2 }) } as unknown as Response)
    const fail = () => Promise.reject(new Error('offline'))
    expect(await loadCastings(notFound as unknown as typeof fetch)).toBeNull()
    expect(await loadCastings(broken as unknown as typeof fetch)).toBeNull()
    expect(await loadCastings(fail as unknown as typeof fetch)).toBeNull()
  })

  it('ensureCastings は一度だけ取得する', async () => {
    let calls = 0
    const counting = () => {
      calls++
      return okFetch()
    }
    await Promise.all([
      ensureCastings(counting as unknown as typeof fetch),
      ensureCastings(counting as unknown as typeof fetch),
    ])
    await ensureCastings(counting as unknown as typeof fetch)
    expect(calls).toBe(1)
  })
})

describe('既定の編成ID', () => {
  it('既定は差し替えなしを指す', () => {
    expect(DEFAULT_CASTING.id).toBe(DEFAULT_CASTING_ID)
  })
})
