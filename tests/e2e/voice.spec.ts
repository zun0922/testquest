import { test, expect, type Page } from '@playwright/test'

// FR-P2-006 キャラクターボイス。
// 最重要は「音声が無くても・OFFでも従来どおり最後までプレイできる」こと（デグレ防止）。
// 実際の発音はヘッドレスで検証できないため、再生状態は data-voice-state 属性で観測する。

async function advanceToChoice(page: Page, maxClicks = 10) {
  for (let i = 0; i < maxClicks; i++) {
    if (await page.getByTestId('choice-btn-0').isVisible()) return
    await page.getByTestId('message-window').click()
  }
  await expect(page.getByTestId('choice-btn-0')).toBeVisible()
}

async function startFirstScenario(page: Page) {
  await page.goto('/?skipTyping=1')
  await page.getByTestId('btn-start').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()
  await page.getByTestId('scenario-item-fl-1-01').click()
  await expect(page.getByTestId('screen-play')).toBeVisible()
}

test('音声が未配置でもプレイは成立する（voice-state=none で最後まで進める）', async ({ page }) => {
  await startFirstScenario(page)

  // マニフェスト未配置／該当ノード未収録なら 'none'（無音で進行する）
  await expect(page.getByTestId('screen-play')).toHaveAttribute('data-voice-state', /none|playing/)

  await advanceToChoice(page)
  await page.getByTestId('choice-btn-0').click()
  await expect(page.getByTestId('feedback-modal')).toBeVisible()
})

test('ボイスのON/OFFを切り替えられ、再訪しても設定が復元される', async ({ page }) => {
  await startFirstScenario(page)

  const toggle = page.getByTestId('btn-voice')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true') // 既定はON

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('screen-play')).toHaveAttribute('data-voice-state', 'off')

  // 進捗（testquest:save）とは別キーに保存されるため、再訪しても OFF のまま
  await startFirstScenario(page)
  await expect(page.getByTestId('btn-voice')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('screen-play')).toHaveAttribute('data-voice-state', 'off')
})

test('ボイスOFFのままでも結果画面まで到達できる', async ({ page }) => {
  await startFirstScenario(page)
  await page.getByTestId('btn-voice').click()
  await expect(page.getByTestId('screen-play')).toHaveAttribute('data-voice-state', 'off')

  // 最後まで進む（選択→フィードバック→…→結果）
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId('screen-result').isVisible()) break
    if (await page.getByTestId('feedback-modal').isVisible()) {
      await page.getByTestId('btn-feedback-close').click()
      continue
    }
    if (await page.getByTestId('choice-btn-0').isVisible()) {
      await page.getByTestId('choice-btn-0').click()
      continue
    }
    await page.getByTestId('message-window').click()
  }
  await expect(page.getByTestId('screen-result')).toBeVisible()
})

// 音声ライブラリの規約はクレジット表記を必須としている（zunko.jp は「アプリの場合は紹介画面などに記載」と明記）。
// 表示漏れは規約違反に直結するため、実装ではなくテストで担保する。
// クレジットは manifest の credits（= 実際に配信している音源）から出るので、音声を外せばこのテストは
// 意図どおり落ちる（そのときはテスト側も一緒に見直す）。
test('音声を配信しているとき、タイトル画面に音源のクレジットが表示される（規約要件）', async ({ page }) => {
  await page.goto('/?skipTyping=1')
  await expect(page.getByTestId('screen-title')).toBeVisible()

  const credits = page.getByTestId('voice-credits')
  await expect(credits).toBeVisible()
  await expect(credits).toContainText('VOICEVOX')
})
