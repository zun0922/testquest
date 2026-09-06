import { test, expect, type Page } from '@playwright/test'

// FR-P2-005 既読スキップ・バックログ。
// 学習教材なので「速く進めること」より「読み飛ばさせないこと」を優先して検証する。

/** タイトルから fl-1-01 を開く。 */
async function openScenario(page: Page) {
  await page.goto('/?skipTyping=1')
  await page.getByTestId('btn-start').click()
  await page.getByTestId('scenario-item-fl-1-01').click()
  await expect(page.getByTestId('screen-play')).toBeVisible()
}

/**
 * 入り直す（＝2周目）。選択肢が出ている間は中断ボタンがオーバーレイに覆われて押せないため、
 * 画面を開き直す方法をとる。既読は localStorage に残るのでスキップの検証はできる。
 */
async function reopenScenario(page: Page) {
  await page.goto('/?skipTyping=1')
  await page.getByTestId('btn-start').click()
  if (await page.getByTestId('btn-overwrite-ok').isVisible()) {
    await page.getByTestId('btn-overwrite-ok').click()
  }
  await page.getByTestId('scenario-item-fl-1-01').click()
  await expect(page.getByTestId('screen-play')).toBeVisible()
}

/** 最初の選択肢が出るまでテキストを送る（＝そこまでを既読にする）。 */
async function readUntilChoice(page: Page) {
  for (let i = 0; i < 30; i++) {
    if (await page.getByTestId('choice-btn-0').isVisible()) return
    await page.getByTestId('message-window').click()
  }
  throw new Error('選択肢まで到達しなかった')
}

test('既読スキップは既読のぶんだけ自動で送り、選択肢で止まる', async ({ page }) => {
  await openScenario(page)
  await readUntilChoice(page) // 1周目：ここまでが既読になる
  const readText = await page.getByTestId('message-window').innerText()

  await reopenScenario(page) // 2周目

  // スキップON → 手を触れずに選択肢まで進む
  await page.getByTestId('btn-skip').click()
  await expect(page.getByTestId('choice-btn-0')).toBeVisible({ timeout: 15000 })

  // 選択肢で止まっている＝スキップは解除され、出題は飛ばされない
  await expect(page.getByTestId('btn-skip')).toHaveAttribute('aria-pressed', 'false')
  expect(await page.getByTestId('message-window').innerText()).toContain(readText.slice(-10))
  await page.screenshot({ path: 'e2e-shots/skip-01-stopped-at-choice.png' })
})

test('未読のところでは自動で送らない（読み飛ばし防止）', async ({ page }) => {
  await openScenario(page)

  // 1周目の途中まで読む（この先は未読のまま）
  await page.getByTestId('message-window').click()
  await page.getByTestId('message-window').click()
  const textBefore = await page.getByTestId('message-window').innerText()

  // 未読の位置でスキップONにしても進まない
  await page.getByTestId('btn-skip').click()
  await page.waitForTimeout(1200)
  expect(await page.getByTestId('message-window').innerText()).toBe(textBefore)
  await expect(page.getByTestId('btn-skip')).toHaveAttribute('aria-pressed', 'false')
})

test('スキップ中に画面へ触れると止まる', async ({ page }) => {
  await openScenario(page)
  await readUntilChoice(page)
  await reopenScenario(page)

  await page.getByTestId('btn-skip').click()
  await expect(page.getByTestId('btn-skip')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('message-window').click() // 触れる
  await expect(page.getByTestId('btn-skip')).toHaveAttribute('aria-pressed', 'false')
})

test('バックログでこれまでのセリフを読み返せる', async ({ page }) => {
  await openScenario(page)
  const first = await page.getByTestId('message-window').innerText()
  await page.getByTestId('message-window').click()
  await page.getByTestId('message-window').click()

  await page.getByTestId('btn-backlog').click()
  await expect(page.getByTestId('backlog')).toBeVisible()
  const lines = page.getByTestId('backlog-line')
  expect(await lines.count()).toBeGreaterThanOrEqual(3)
  // 1行目＝最初に読んだセリフが残っている
  await expect(lines.first()).toContainText(first.replace(/^.*\n/, '').slice(0, 12))
  await page.screenshot({ path: 'e2e-shots/skip-02-backlog.png' })

  await page.getByTestId('btn-backlog-close').click()
  await expect(page.getByTestId('backlog')).toBeHidden()
  await expect(page.getByTestId('screen-play')).toBeVisible()
})

test('バックログの再生ボタンは音声のある行にだけ出る', async ({ page }) => {
  await openScenario(page)
  await page.getByTestId('message-window').click()
  await page.getByTestId('btn-backlog').click()
  await expect(page.getByTestId('backlog')).toBeVisible()

  // fl-1-01 は全ノードの音声を配信しているので、行数と再生ボタン数が一致する
  const lines = await page.getByTestId('backlog-line').count()
  const buttons = await page.locator('[data-testid^="btn-backlog-play-"]').count()
  expect(buttons, '音声のある行には再生ボタンが出る').toBe(lines)
})

test('バックログを開くとスキップは止まる（開いている間に進まない）', async ({ page }) => {
  await openScenario(page)
  await readUntilChoice(page)
  await reopenScenario(page)

  await page.getByTestId('btn-skip').click()
  await page.getByTestId('btn-backlog').click()
  await expect(page.getByTestId('backlog')).toBeVisible()
  await expect(page.getByTestId('btn-skip')).toHaveAttribute('aria-pressed', 'false')
})

// 社内で問題になった点：選択肢が出ている間、上部のボタンが暗幕に覆われて押せなかった。
// 中断できないのは操作として困るため、暗幕はクリックを受け取らない作りに直した。
test('選択肢の表示中でも上部のボタン（中断・バックログ・ボイス）を押せる', async ({ page }) => {
  await openScenario(page)
  await readUntilChoice(page)
  await expect(page.getByTestId('choice-btn-0')).toBeVisible()

  // バックログ：開いて閉じられる
  await page.getByTestId('btn-backlog').click()
  await expect(page.getByTestId('backlog')).toBeVisible()
  await page.getByTestId('btn-backlog-close').click()

  // ボイス：切り替えられる
  const before = await page.getByTestId('btn-voice').getAttribute('aria-pressed')
  await page.getByTestId('btn-voice').click()
  await expect(page.getByTestId('btn-voice')).not.toHaveAttribute('aria-pressed', before ?? '')

  // 中断：メニューを開ける（選択肢を選ばずに抜けられる）
  await page.getByTestId('btn-pause').click()
  await expect(page.getByTestId('btn-quit-confirm')).toBeVisible()
  await page.getByTestId('btn-quit-confirm').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()
})
