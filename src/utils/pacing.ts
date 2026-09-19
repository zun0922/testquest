// 設問の「読む時間」の間合い。
//
// PO実機フィードバック（2026-09-13）：
//   「問題間のメッセージ表示が短く、解答するとすぐに次の問題が出てくる。
//     選択肢表示中は問題が見えるとはいえ、もう少し問題を読む時間が必要」
//
// 対応は2つある。
//   ①選択肢の暗幕を**本文にかけない**ようにして、選んでいる間も設問を読めるようにする（ScenarioPlayer）
//   ②本文を出し切ってから選択肢を出すまでに**ひと呼吸**置く（この関数）
//
// ②を一律の固定値にしないのは、短い設問で無駄に待たされるため。
// 設問が長いほど長く待つ＝読み終えるのに要る時間に合わせる。

/** 下限。短い設問でも「本文 → 選択肢」の順に目が動くだけの間を置く。 */
export const CHOICE_REVEAL_MIN_MS = 450
/** 1文字あたりの追加時間。 */
export const CHOICE_REVEAL_PER_CHAR_MS = 20
/** 上限。長い設問でも待たされすぎない（本文は選択肢の下に出たままなので読み続けられる）。 */
export const CHOICE_REVEAL_MAX_MS = 1600

/**
 * 設問の本文を出し切ってから、選択肢を表示するまでの待ち時間（ミリ秒）。
 * 設問文は実データで中央値40字・最長196字（全569ノード・2026-09-13 実測）。
 * 中央値なら約1.25秒、長文でも上限1.6秒で頭打ちになる。
 */
export function choiceRevealMs(text: string): number {
  const len = text?.length ?? 0
  return Math.min(CHOICE_REVEAL_MAX_MS, CHOICE_REVEAL_MIN_MS + len * CHOICE_REVEAL_PER_CHAR_MS)
}
