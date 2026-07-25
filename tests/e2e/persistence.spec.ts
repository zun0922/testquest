import { test, expect, type Page } from '@playwright/test'

// テスト計画書§10.4 の E2E シナリオ（ハッピーパス以外）。
// 対応：AC-008 保存と復元／AC-009 再プレイ非加算／AC-010 壊れJSON回復／AC-002 上書き確認

const SAVE_KEY = 'testquest:save'
const EXISTING_SAVE = {
  version: 1,
  status: { knowledge: 20, skill: 15, confidence: 12, teamwork: 10 },
  cleared: {},
}

// 導入シーンの text ノード数に依存せず最初の選択肢まで進める（導入シーン拡充 2026-07-26）
async function advanceToChoice(page: Page, maxClicks = 10) {
  for (let i = 0; i < maxClicks; i++) {
    if (await page.getByTestId('choice-btn-0').isVisible()) return
    await page.getByTestId('message-window').click()
  }
  await expect(page.getByTestId('choice-btn-0')).toBeVisible()
}

// 章選択 → サンプルシナリオを最後まで通しでプレイ → 結果画面まで
async function playThroughFromSelect(page: Page) {
  await page.getByTestId('scenario-item-fl-1-01').click()
  await expect(page.getByTestId('screen-play')).toBeVisible()
  await advanceToChoice(page) // 導入（text 群）→ 最初の choice
  for (let i = 0; i < 4; i++) {
    // fl-1-01 は choice ノード4本
    await page.getByTestId('choice-btn-0').click()
    await page.getByTestId('btn-feedback-close').click()
  }
  await page.getByTestId('message-window').click() // ending（next:null）→ 結果
  await expect(page.getByTestId('screen-result')).toBeVisible()
}

async function readSave(page: Page) {
  return page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?skipTyping=1')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('AC-001：セーブ無しで「つづきから」非活性・「はじめから」で確認なく開始', async ({ page }) => {
  // beforeEach で localStorage はクリア済み（セーブ無し）
  // FT-001-001-TC-001：つづきからが非活性
  await expect(page.getByTestId('btn-continue')).toBeDisabled()
  // FT-001-001-TC-002：はじめからで確認ダイアログなく章選択へ
  await page.getByTestId('btn-start').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()
  await expect(page.getByTestId('btn-overwrite-ok')).toHaveCount(0)
})

test('AC-008：結果到達で保存され、リロード後つづきからで復元される', async ({ page }) => {
  await page.getByTestId('btn-start').click()
  await playThroughFromSelect(page)

  // FT-008-001-TC-001：cleared に記録される
  const saved = await readSave(page)
  expect(saved).toContain('fl-1-01')

  // リロード → つづきから（FT-008-001-TC-002・ST-SCN-001-TC-002）
  await page.getByTestId('btn-back-select').click()
  await page.reload()
  await expect(page.getByTestId('btn-continue')).toBeEnabled()
  await page.getByTestId('btn-continue').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()
  await expect(page.getByTestId('scenario-item-fl-1-01')).toContainText('クリア済み')
})

test('AC-009：クリア済みを再プレイしてもステータスが加算されない', async ({ page }) => {
  await page.getByTestId('btn-start').click()
  await playThroughFromSelect(page) // 初回クリア
  await page.getByTestId('btn-back-select').click()

  const before = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).status, SAVE_KEY)

  // 再プレイ（isReplay=true）
  await playThroughFromSelect(page)
  await page.getByTestId('btn-back-select').click()

  const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).status, SAVE_KEY)
  // FT-006-003-TC-001・ST-SCN-001-TC-003：再プレイ前後で status 不変
  expect(after).toEqual(before)
})

test('AC-010：シナリオロード失敗でエラー画面・進捗は破壊されない', async ({ page }) => {
  // 既存進捗を用意
  await page.evaluate(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: SAVE_KEY, v: JSON.stringify(EXISTING_SAVE) },
  )
  await page.reload()

  // シナリオファイルのfetchを404にする（index.json は通す）
  await page.route('**/scenarios/fl-1/fl-1-01.json', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: 'not found' }),
  )

  await page.getByTestId('btn-continue').click()
  await page.getByTestId('scenario-item-fl-1-01').click()

  // FT-009-002-TC-001：エラー画面＋再読み込みボタン
  await expect(page.getByTestId('screen-error')).toBeVisible()
  await expect(page.getByTestId('btn-reload')).toBeVisible()

  // FT-009-002-TC-002：進捗が破壊されていない（AC-010）
  const after = await readSave(page)
  expect(after).toBe(JSON.stringify(EXISTING_SAVE))
})

test('AC-002：はじめからで上書き確認・キャンセルで進捗保持', async ({ page }) => {
  await page.evaluate(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: SAVE_KEY, v: JSON.stringify(EXISTING_SAVE) },
  )
  await page.reload()

  await page.getByTestId('btn-start').click()
  // FT-001-001-TC-003：確認ダイアログ
  await expect(page.getByTestId('btn-overwrite-ok')).toBeVisible()

  // FT-001-001-TC-004：キャンセルで進捗保持・タイトルに留まる
  await page.getByRole('button', { name: 'キャンセル' }).click()
  await expect(page.getByTestId('screen-title')).toBeVisible()
  const after = await readSave(page)
  expect(after).toBe(JSON.stringify(EXISTING_SAVE))
})
