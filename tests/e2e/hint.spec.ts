import { test, expect, type Page } from '@playwright/test'

// FR-P2-007 ポイントに応じたヒント。
// 閾値は要件仕様 v0.2 §3.3（FL: Lv1=60／Lv2=150）。fl-1-01 は FL なので FL の閾値で判定される。
// 蓄積ポイントは進捗データに保存されるため、localStorage を直接置いて状態を作る。

const SAVE_KEY = 'testquest:save'

/** 合計が total になる進捗データ（4等分＋端数を knowledge へ）。 */
function saveWithTotal(total: number) {
  const base = Math.floor(total / 4)
  return {
    version: 1,
    status: { knowledge: base + (total - base * 4), skill: base, confidence: base, teamwork: base },
    cleared: {},
  }
}

async function openFirstChoice(page: Page, total: number) {
  await page.goto('/?skipTyping=1')
  await page.evaluate(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: SAVE_KEY, v: JSON.stringify(saveWithTotal(total)) },
  )
  await page.reload()
  await page.getByTestId('btn-continue').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()
  await page.getByTestId('scenario-item-fl-1-01').click()
  await expect(page.getByTestId('screen-play')).toBeVisible()
  // 導入（text 群）→ 最初の選択肢まで進める
  for (let i = 0; i < 10; i++) {
    if (await page.getByTestId('choice-btn-0').isVisible()) break
    await page.getByTestId('message-window').click()
  }
  await expect(page.getByTestId('choice-btn-0')).toBeVisible()
}

test('ポイント不足（Lv0）ではヒントボタンが非活性', async ({ page }) => {
  await openFirstChoice(page, 40) // 初期値40＝FLのLv1(60)に届かない
  const btn = page.getByTestId('btn-hint')
  await expect(btn).toBeVisible()
  await expect(btn).toBeDisabled()
  await expect(page.getByTestId('hint-mark')).toHaveCount(0)
})

test('Lv1：ヒント文が表示される（強調はまだ出ない）', async ({ page }) => {
  await openFirstChoice(page, 100) // FL: 60〜149 → Lv1
  const btn = page.getByTestId('btn-hint')
  await expect(btn).toBeEnabled()

  await expect(page.getByTestId('hint-text')).toHaveCount(0) // 押すまでは出ない
  await btn.click()

  await expect(page.getByTestId('hint-text')).toBeVisible()
  await expect(page.getByTestId('hint-text')).toContainText('テストが指す範囲')
  // Lv1 では選択肢の強調はしない（テキストが主役・強調は Lv2 の補助）
  await expect(page.getByTestId('hint-mark')).toHaveCount(0)
  await expect(btn).toBeDisabled() // 表示後は押せない（表示中の状態）
})

test('Lv2：ヒント文に加えて全選択肢の重要語が強調される', async ({ page }) => {
  await openFirstChoice(page, 200) // FL: 150以上 → Lv2
  // PO確認用：押す前後を撮る（STEP 2 の判断材料）
  await page.screenshot({ path: 'e2e-shots/hint-01-before.png', fullPage: true })
  await page.getByTestId('btn-hint').click()
  await expect(page.getByTestId('hint-text')).toBeVisible()
  // fl-1-01 q1 は3択すべてに強調語がある
  await expect(page.getByTestId('hint-mark')).toHaveCount(3)
  await page.screenshot({ path: 'e2e-shots/hint-02-lv2.png', fullPage: true })
})

test('ヒントは問題ごとにリセットされる（前の問題の表示を持ち越さない）', async ({ page }) => {
  await openFirstChoice(page, 200)
  await page.getByTestId('btn-hint').click()
  await expect(page.getByTestId('hint-mark')).toHaveCount(3)

  // 1問目を回答して次の問題へ
  await page.getByTestId('choice-btn-0').click()
  await page.getByTestId('btn-feedback-close').click()
  await expect(page.getByTestId('choice-btn-0')).toBeVisible()

  await expect(page.getByTestId('hint-text')).toHaveCount(0)
  await expect(page.getByTestId('hint-mark')).toHaveCount(0)
  await expect(page.getByTestId('btn-hint')).toBeEnabled()
})

test('ヒント表示中も数値・%が画面に出ない（UI-RULE-006）', async ({ page }) => {
  await openFirstChoice(page, 200)
  await page.getByTestId('btn-hint').click()
  await expect(page.getByTestId('hint-mark')).toHaveCount(3)

  const texts = await page.locator('[data-testid^="status-bar-"]').allTextContents()
  expect(texts.length).toBeGreaterThan(0)
  for (const t of texts) {
    expect(t, `status-bar に数字が出ている: "${t}"`).not.toMatch(/\d+\s*[%％]?/)
  }
  // ヒントボタンのラベルにも数値を出さない
  await expect(page.getByTestId('btn-hint')).not.toHaveText(/\d/)
})
