// FR-P2-003 編成パターンの選択。
// 性別は尋ねない（PO決定 2026-09-06）。企画書§9.5「取得する個人情報は最小限」に沿い、
// 「誰と学ぶか」を直接選んでもらう方式にした。体験は同じで、性別情報を一切持たなくて済む。
//
// 置き場所はシナリオ選択画面（＝章の区切り）。プレイ中に変えられないのは企画書§9.1 のとおり。
import { useEffect, useState } from 'react'
import { DEFAULT_CASTING_ID, ensureCastings, type Casting } from '../../utils/casting'
import { loadCastingId, saveCastingId } from '../../utils/uiState'
import { characterUrl } from '../../utils/assets'

export default function CastingPicker() {
  const [castings, setCastings] = useState<Casting[] | null>(null)
  const [selected, setSelected] = useState<string>(() => loadCastingId() ?? DEFAULT_CASTING_ID)

  useEffect(() => {
    let alive = true
    void ensureCastings().then((d) => {
      if (alive) setCastings(d?.castings ?? null)
    })
    return () => {
      alive = false
    }
  }, [])

  // 定義が配信されていない場合は何も出さない（従来どおり既定の編成で遊べる）
  if (!castings || castings.length < 2) return null

  const choose = (id: string) => {
    setSelected(id)
    saveCastingId(id)
  }

  return (
    <div data-testid="casting-picker" className="mb-4 border border-line rounded-xl p-3">
      <p className="text-sm text-text-muted mb-2">技術メンターを選べます（いつでも変更できます）</p>
      <div className="flex flex-wrap gap-2">
        {castings.map((c) => {
          // swap の行き先＝そのパターンで実際に出るキャラ（既定は匠のまま）
          const face = Object.values(c.swap)[0] ?? 'takumi'
          const active = c.id === selected
          return (
            <button
              key={c.id}
              data-testid={`casting-${c.id}`}
              aria-pressed={active}
              onClick={() => choose(c.id)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent ${
                active
                  ? 'border-accent bg-accent/15'
                  : 'border-line hover:border-accent/70 hover:-translate-y-0.5'
              }`}
            >
              <img
                src={characterUrl(face, 'normal')}
                alt=""
                aria-hidden
                className="w-10 h-10 rounded-full object-cover object-top bg-surface"
              />
              <span>
                <span className={`block font-bold ${active ? 'text-accent' : 'text-text-main'}`}>
                  {c.label}
                </span>
                <span className="block text-xs text-text-muted">{c.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
