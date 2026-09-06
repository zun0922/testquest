// FR-P2-005 既読の記録。
// 進捗（testquest:save）とは別キーに分ける：既読は「利便性のための補助データ」であり、
// 壊れても学習の進捗を失ってはならないため（読めなければ「未読」として扱えば済む）。
// 記録はノード単位。シナリオ単位にすると分岐のあるシナリオで未読の枝まで既読扱いになる。

export const READ_KEY = 'testquest:read'

export interface ReadLog {
  version: 1
  /** scenarioId → 既読ノードIDの配列 */
  nodes: Record<string, string[]>
}

export const EMPTY_READ_LOG: ReadLog = { version: 1, nodes: {} }

function isReadLog(v: unknown): v is ReadLog {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (o.version !== 1 || typeof o.nodes !== 'object' || o.nodes === null) return false
  return Object.values(o.nodes as Record<string, unknown>).every(
    (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
  )
}

/** 読み込み。壊れていても例外を投げず、空の記録として扱う（プレイを止めない）。 */
export function loadReadLog(): ReadLog {
  try {
    const raw = localStorage.getItem(READ_KEY)
    if (!raw) return EMPTY_READ_LOG
    const parsed: unknown = JSON.parse(raw)
    return isReadLog(parsed) ? parsed : EMPTY_READ_LOG
  } catch {
    return EMPTY_READ_LOG // localStorage 不可・壊れたJSON。既読が無いだけで通常どおり遊べる
  }
}

export function isRead(log: ReadLog, scenarioId: string, nodeId: string): boolean {
  return log.nodes[scenarioId]?.includes(nodeId) ?? false
}

/**
 * 既読にして保存し、新しい記録を返す（引数は変更しない）。
 * 保存に失敗しても記録そのものは返すので、そのセッション中はスキップが効く。
 */
export function markRead(log: ReadLog, scenarioId: string, nodeId: string): ReadLog {
  if (isRead(log, scenarioId, nodeId)) return log
  const next: ReadLog = {
    version: 1,
    nodes: { ...log.nodes, [scenarioId]: [...(log.nodes[scenarioId] ?? []), nodeId] },
  }
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(next))
  } catch {
    // 容量超過・プライベートモード等。既読が残らないだけでプレイには影響しない
  }
  return next
}

/** そのシナリオの既読ノード数（テストと将来のUI表示用）。 */
export function readCount(log: ReadLog, scenarioId: string): number {
  return log.nodes[scenarioId]?.length ?? 0
}

export function clearReadLog(): void {
  try {
    localStorage.removeItem(READ_KEY)
  } catch {
    // 消せなくても実害はない
  }
}
