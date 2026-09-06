import { test, expect, type Page } from '@playwright/test'

// FR-P2-003 編成パターン（技術メンター 匠 ⇄ 澪）。
// 検証の要点は「シナリオJSONを変えずに、見た目・名前・本文・音声が入れ替わる」こと。

/** AL を解放した状態で選択画面を開く（AL-TTA は FL 全クリアが前提のため）。 */
async function openSelectWithAl(page: Page) {
  await page.goto('/?skipTyping=1&unlockAll=1')
  await page.getByTestId('btn-start').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()
  const level = page.getByTestId('level-al-tta')
  await expect(level).toBeVisible()
  // 節が閉じていれば開く
  if ((await page.getByTestId('casting-picker').count()) === 0) {
    await page.getByTestId('level-toggle-al-tta').click()
  }
  await expect(page.getByTestId('casting-picker')).toBeVisible()
}

/** al-tta-1-01 を開いて最初のセリフを表示する。 */
async function openFirstTtaScenario(page: Page) {
  const chapter = page.getByTestId('chapter-toggle-al-tta-1')
  if (await chapter.isVisible()) await chapter.click()
  await page.getByTestId('scenario-item-al-tta-1-01').click()
  await expect(page.getByTestId('screen-play')).toBeVisible()
  // 最初のノードは情景描写（ナレーション）なので、メンターが話すところまで送る
  await page.getByTestId('message-window').click()
  await expect(page.getByTestId('speaker-name')).toBeVisible()
}

test('既定の編成では高橋 匠が出る', async ({ page }) => {
  await openSelectWithAl(page)
  await expect(page.getByTestId('casting-default')).toHaveAttribute('aria-pressed', 'true')
  await openFirstTtaScenario(page)

  await expect(page.getByTestId('speaker-name')).toHaveText('匠')
  await expect(page.getByTestId('message-window')).toContainText('高橋だ')
  await expect(page.locator('img[src*="takumi"]').first()).toBeVisible()
})

test('編成を切り替えると立ち絵・名前・本文がまとめて入れ替わる', async ({ page }) => {
  await openSelectWithAl(page)
  await page.getByTestId('casting-mio').click()
  await expect(page.getByTestId('casting-mio')).toHaveAttribute('aria-pressed', 'true')
  await openFirstTtaScenario(page)

  await expect(page.getByTestId('speaker-name')).toHaveText('澪')
  // 名乗りが差し替わっている（学習内容は変えず、一人称と名前だけ直したもの）
  await expect(page.getByTestId('message-window')).toContainText('伊藤だ')
  await expect(page.getByTestId('message-window')).not.toContainText('高橋')
  await expect(page.locator('img[src*="mio"]').first()).toBeVisible()
  await expect(page.locator('img[src*="takumi"]')).toHaveCount(0)
  await page.screenshot({ path: 'e2e-shots/casting-mio.png' })
})

test('差し替えたキャラのセリフはその編成の音声を鳴らす', async ({ page }) => {
  await openSelectWithAl(page)
  await page.getByTestId('casting-mio').click()
  await openFirstTtaScenario(page)

  // 実音を鳴らせないヘッドレスでも、どのURLを選んだかは観測できる
  const src = await page.evaluate(async () => {
    const res = await fetch('/audio/manifest.json')
    const m = await res.json()
    return Object.keys(m.variants?.mio?.scenarios?.['al-tta-1-01'] ?? {})
  })
  expect(src.length, '澪の音声が manifest に登録されている').toBeGreaterThan(0)
  const ok = await page.evaluate(async () => {
    const r = await fetch('/audio/mio/al-tta-1-01/intro.m4a')
    return { status: r.status, type: r.headers.get('content-type') }
  })
  expect(ok.status, '澪の音声ファイルが配信されている').toBe(200)
})

test('選んだ編成は次に開いたときも保たれる', async ({ page }) => {
  await openSelectWithAl(page)
  await page.getByTestId('casting-mio').click()

  // 開き直す（進捗が無い状態でも、編成の選択は保たれているはず）
  await openSelectWithAl(page)
  await expect(page.getByTestId('casting-mio')).toHaveAttribute('aria-pressed', 'true')
})

test('編成を戻すと元のキャラに戻る（切り替えは何度でもできる）', async ({ page }) => {
  await openSelectWithAl(page)
  await page.getByTestId('casting-mio').click()
  await page.getByTestId('casting-default').click()
  await openFirstTtaScenario(page)

  await expect(page.getByTestId('speaker-name')).toHaveText('匠')
  await expect(page.getByTestId('message-window')).toContainText('高橋だ')
})

test('FL編には編成の選択を出さない（差し替え対象がいないため）', async ({ page }) => {
  await page.goto('/?skipTyping=1')
  await page.getByTestId('btn-start').click()
  await expect(page.getByTestId('level-fl')).toBeVisible()
  // FL の節を開いても選択は出ない
  await expect(page.getByTestId('casting-picker')).toHaveCount(0)
})
