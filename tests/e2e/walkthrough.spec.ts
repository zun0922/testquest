import { test, expect, type Page } from '@playwright/test'

// 数値非表示（UI-RULE-006・FT-006-004）の背理法検証：
// status-bar-* 配下のテキストに数字・% が1つも無いことを確認する。
async function assertNoNumbersInStatus(page: Page) {
  const texts = await page.locator('[data-testid^="status-bar-"]').allTextContents()
  expect(texts.length).toBeGreaterThan(0) // メーターが存在すること
  for (const t of texts) {
    expect(t, `status-bar に数字が出ている: "${t}"`).not.toMatch(/\d+\s*[%％]?/)
  }
}

const SHOTS = 'e2e-shots'

// ST-SCN-001-TC-001 相当（王道の新規プレイ通し）＋ FT-006-004（数値非表示）＋ スクリーンショット
test('ハッピーパス通し：タイトル→選択→再生→選択→フィードバック→結果（数値非表示も検証）', async ({ page }) => {
  // --- タイトル（screen-title） ---
  await page.goto('/?skipTyping=1')
  await expect(page.getByTestId('screen-title')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/01-title.png`, fullPage: true })

  // --- 章選択（screen-select） ---
  await page.getByTestId('btn-start').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()
  await assertNoNumbersInStatus(page) // FT-006-004-TC-002
  await page.screenshot({ path: `${SHOTS}/02-select.png`, fullPage: true })

  // --- シナリオ開始（screen-play） ---
  await page.getByTestId('scenario-item-fl-1-01').click()
  await expect(page.getByTestId('screen-play')).toBeVisible()
  await assertNoNumbersInStatus(page) // FT-006-004-TC-001

  // intro（text・2体表示／発話者以外グレーアウト UI-RULE-004）
  await page.screenshot({ path: `${SHOTS}/02b-play-intro.png`, fullPage: true })

  // intro（text）→ クリックで最初の choice ノードへ
  await page.getByTestId('message-window').click()
  await expect(page.getByTestId('choice-btn-0')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/03-play-choice.png`, fullPage: true })

  // --- choice ノードを通過（fl-1-01 は4ノード。各：選択→フィードバック→閉じる） ---
  for (let i = 0; i < 4; i++) {
    await expect(page.getByTestId('choice-btn-0')).toBeVisible()
    await page.getByTestId('choice-btn-0').click()
    await expect(page.getByTestId('feedback-modal')).toBeVisible()
    if (i === 0) await page.screenshot({ path: `${SHOTS}/04-feedback.png`, fullPage: true })
    await page.getByTestId('btn-feedback-close').click()
  }

  // 最終 text ノード（ending）→ クリックで結果画面へ
  await page.getByTestId('message-window').click()
  await expect(page.getByTestId('screen-result')).toBeVisible()
  await assertNoNumbersInStatus(page) // FT-006-004-TC-003（成長表示に数字なし）
  await page.screenshot({ path: `${SHOTS}/05-result.png`, fullPage: true })

  // 章選択へ戻る（FT-007-002）
  await page.getByTestId('btn-back-select').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()
})
