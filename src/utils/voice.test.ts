// FR-P2-006 キャラクターボイス：パス解決とマニフェスト判定の単体テスト。
// 方針の核＝「音声が無くてもプレイは成立する」ため、異常系はすべて null / false に落ちることを確認する。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DEFAULT_FORMAT,
  ensureManifest,
  getSharedAudio,
  hasVoice,
  loadManifest,
  resetAudioForTest,
  resetManifestCache,
  unlockAudio,
  voiceUrl,
  voiceUrlFor,
  type VoiceManifest,
} from './voice'

const VALID: VoiceManifest = {
  version: 1,
  format: 'm4a',
  scenarios: {
    'fl-1-01': {
      n1: { hash: 'a3f', dur: 8.2, cast: 'tanaka' },
      n2: { hash: 'b7c', dur: 4.1, cast: 'rin' },
    },
  },
}

function fetchOf(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch
}

beforeEach(() => {
  resetManifestCache()
  resetAudioForTest()
})

describe('voiceUrl', () => {
  it('シナリオIDとノードIDから規約どおりのパスを組み立てる（JSONに音声フィールドは不要）', () => {
    expect(voiceUrl('fl-1-01', 'n1')).toBe(`/audio/fl-1-01/n1.${DEFAULT_FORMAT}`)
  })

  it('形式は差し替えられる（manifest.format の変更だけで完結する）', () => {
    expect(voiceUrl('al-tta-6-03', 'q2', 'opus')).toBe('/audio/al-tta-6-03/q2.opus')
  })

  it('既定形式は m4a（Ogg Opus は iOS 16 以前の Safari が再生できないため）', () => {
    expect(DEFAULT_FORMAT).toBe('m4a')
  })
})

describe('loadManifest', () => {
  it('正常なマニフェストを読み込む', async () => {
    await expect(loadManifest(fetchOf(200, VALID))).resolves.toEqual(VALID)
  })

  it('未配置（404）なら null＝音声機能なしとして扱う', async () => {
    await expect(loadManifest(fetchOf(404, null))).resolves.toBeNull()
  })

  it('version 違い・形式不正は null（例外を投げない）', async () => {
    await expect(loadManifest(fetchOf(200, { version: 2, format: 'opus', scenarios: {} }))).resolves.toBeNull()
    await expect(loadManifest(fetchOf(200, { version: 1, scenarios: {} }))).resolves.toBeNull()
    await expect(
      loadManifest(fetchOf(200, { version: 1, format: 'opus', scenarios: { 'fl-1-01': { n1: { hash: 'a' } } } })),
    ).resolves.toBeNull()
  })

  it('通信失敗でも throw せず null を返す（プレイを止めない）', async () => {
    const failing = vi.fn(async () => {
      throw new Error('network')
    }) as unknown as typeof fetch
    await expect(loadManifest(failing)).resolves.toBeNull()
  })
})

describe('ensureManifest', () => {
  it('複数回呼んでも fetch は1回だけ（ノードごとに取りに行かない）', async () => {
    const f = fetchOf(200, VALID)
    await ensureManifest(f)
    await ensureManifest(f)
    await ensureManifest(f)
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('hasVoice / voiceUrlFor', () => {
  it('登録済みノードだけ true・URL を返す', () => {
    expect(hasVoice(VALID, 'fl-1-01', 'n1')).toBe(true)
    expect(voiceUrlFor(VALID, 'fl-1-01', 'n2')).toBe('/audio/fl-1-01/n2.m4a')
  })

  it('未登録のノード・シナリオは false / null（未制作の章でも壊れない）', () => {
    expect(hasVoice(VALID, 'fl-1-01', 'n99')).toBe(false)
    expect(hasVoice(VALID, 'fl-2-01', 'n1')).toBe(false)
    expect(voiceUrlFor(VALID, 'fl-2-01', 'n1')).toBeNull()
  })

  it('マニフェスト自体が null（未配置）でも false / null', () => {
    expect(hasVoice(null, 'fl-1-01', 'n1')).toBe(false)
    expect(voiceUrlFor(null, 'fl-1-01', 'n1')).toBeNull()
  })

  it('マニフェストの format を優先する（既定と異なる形式でも解決できる）', () => {
    const m: VoiceManifest = { ...VALID, format: 'opus' }
    expect(voiceUrlFor(m, 'fl-1-01', 'n1')).toBe('/audio/fl-1-01/n1.opus')
  })
})

describe('共有音声要素', () => {
  it('常に同一インスタンスを返す（同時に2つのセリフが鳴らない）', () => {
    const a = getSharedAudio()
    expect(a).not.toBeNull()
    expect(getSharedAudio()).toBe(a)
  })

  it('解錠は何度呼んでも throw しない（失敗しても無音で進むだけ）', () => {
    expect(() => {
      unlockAudio()
      unlockAudio()
    }).not.toThrow()
  })
})
