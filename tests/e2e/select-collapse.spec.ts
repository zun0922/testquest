import { test, expect, type Page } from '@playwright/test'

// FR-002 折り畳み（設計書 v1.3 §5.2）。縦スクロール量の抑制（PO要望 2026-07-25）の構造検証。
// 初期展開＝「続きの章」のみ／レベル・章の開閉／開閉状態の永続化（testquest:ui）を確認する。

const SAVE_KEY = 'testquest:save'
const UI_KEY = 'testquest:ui'
const SHOTS = 'e2e-shots'

// FL第1章を全クリア＋第2章は未クリアのセーブ（続き＝FL第2章になる状態）
const SAVE_FL1_DONE = {
  version: 1,
  status: { knowledge: 20, skill: 15, confidence: 12, teamwork: 10 },
  cleared: Object.fromEntries(
    ['fl-1-01', 'fl-1-02', 'fl-1-03', 'fl-1-04', 'fl-1-05'].map((id) => [
      id,
      { clearedAt: '2026-07-25T00:00:00Z', ratings: { best: 1, good: 0, poor: 0 }, statusGain: {} },
    ]),
  ),
}

async function gotoSelect(page: Page, save?: unknown) {
  await page.goto('/?skipTyping=1')
  await page.evaluate(() => localStorage.clear())
  if (save) {
    await page.evaluate(
      ({ k, v }) => localStorage.setItem(k, v),
      { k: SAVE_KEY, v: JSON.stringify(save) },
    )
    await page.reload()
    await page.getByTestId('btn-continue').click()
  } else {
    await page.reload()
    await page.getByTestId('btn-start').click()
  }
  await expect(page.getByTestId('screen-select')).toBeVisible()
}

test('未プレイ時：FL第1章だけが開き、他章・ALは閉じている', async ({ page }) => {
  await gotoSelect(page)

  // 続きの章（FL第1章）は中身が見える
  await expect(page.getByTestId('chapter-1')).toBeVisible()
  await expect(page.getByTestId('scenario-item-fl-1-01')).toBeVisible()

  // 他の章は折り畳まれている（見出しはあるが中身は描画されない）
  await expect(page.getByTestId('chapter-toggle-fl-2')).toBeVisible()
  await expect(page.getByTestId('chapter-2')).toHaveCount(0)
  await expect(page.getByTestId('scenario-item-fl-2-01')).toHaveCount(0)

  // ALレベルは見出しのみ（閉じているのでロックカードも出ない）
  await expect(page.getByTestId('level-toggle-al-tm')).toBeVisible()
  await expect(page.getByTestId('lock-al-tm')).toHaveCount(0)

  await page.screenshot({ path: `${SHOTS}/06-select-collapsed.png`, fullPage: true })
})

// AL解放後の一覧の縦幅（PO要望の主目的）を実画面で確認するためのスクリーンショット
test('AL解放後も一覧はコンパクトに収まる（PO確認用スクリーンショット）', async ({ page }) => {
  await page.goto('/?skipTyping=1&unlockAll=1')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByTestId('btn-start').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()

  // 3レベルすべての見出しが表示され、AL配下は畳まれている
  await expect(page.getByTestId('level-toggle-al-tm')).toBeVisible()
  await expect(page.getByTestId('level-toggle-al-tta')).toBeVisible()
  await expect(page.getByTestId('scenario-item-al-tm-1-01')).toHaveCount(0)

  await page.screenshot({ path: `${SHOTS}/07-select-al-unlocked.png`, fullPage: true })
})

test('章見出しクリックで開閉できる（aria-expanded も切り替わる）', async ({ page }) => {
  await gotoSelect(page)

  const toggle = page.getByTestId('chapter-toggle-fl-3')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('scenario-item-fl-3-01')).toBeVisible()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('scenario-item-fl-3-01')).toHaveCount(0)
})

test('レベル見出しクリックで配下をまとめて畳める（AL解放時はロック説明を開閉）', async ({ page }) => {
  await gotoSelect(page)

  // FL を畳む → 開いていた第1章の中身も消える
  await page.getByTestId('level-toggle-fl').click()
  await expect(page.getByTestId('level-toggle-fl')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('scenario-item-fl-1-01')).toHaveCount(0)
  await expect(page.getByTestId('chapter-toggle-fl-1')).toHaveCount(0)

  // AL-TM を開く → 未解放のロック説明が出る
  await page.getByTestId('level-toggle-al-tm').click()
  await expect(page.getByTestId('lock-al-tm')).toBeVisible()
})

test('開閉状態は保存され、リロード後も維持される（進捗データは書き換えない）', async ({ page }) => {
  await gotoSelect(page)

  // 続きの章（FL第1章）を明示的に畳み、第4章を明示的に開く
  await page.getByTestId('chapter-toggle-fl-1').click()
  await page.getByTestId('chapter-toggle-fl-4').click()
  await expect(page.getByTestId('scenario-item-fl-4-01')).toBeVisible()

  const savedUi = await page.evaluate((k) => localStorage.getItem(k), UI_KEY)
  expect(savedUi).toContain('ch:fl-4')

  // リロード → つづきから（セーブが無い状態でも UI 設定は独立して残る）
  await page.reload()
  await page.getByTestId('btn-start').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()

  // 明示操作が自動判定より優先される（第1章は閉じたまま・第4章は開いたまま）
  await expect(page.getByTestId('scenario-item-fl-1-01')).toHaveCount(0)
  await expect(page.getByTestId('scenario-item-fl-4-01')).toBeVisible()
})

test('FL第1章クリア済みなら初期展開は第2章に移る（続きが自動で開く）', async ({ page }) => {
  await gotoSelect(page, SAVE_FL1_DONE)

  await expect(page.getByTestId('scenario-item-fl-2-01')).toBeVisible()
  await expect(page.getByTestId('scenario-item-fl-1-01')).toHaveCount(0)

  // 折り畳んだ見出しでも進捗が分かる（第1章＝5/5・✓）
  await expect(page.getByTestId('chapter-toggle-fl-1')).toContainText('5/5')
})

// クリア済み＝明るい緑（設計書 v1.4 §7.1 cleared #8ef0c4・PO判断 2026-07-25）
test('クリア済みは緑・未クリアはグレーで表示される', async ({ page }) => {
  await gotoSelect(page, SAVE_FL1_DONE)
  const GREEN = 'rgb(142, 240, 196)' // cleared #8ef0c4
  const MUTED = 'rgb(154, 164, 189)' // text-muted #9aa4bd

  // 全クリアの章見出しは緑、途中の章はグレー（色だけに頼らず ✓ も併記）
  const cleared = page.getByTestId('chapter-toggle-fl-1').locator('span', { hasText: '5/5' })
  await expect(cleared).toHaveCSS('color', GREEN)
  await expect(cleared).toContainText('✓')
  await expect(
    page.getByTestId('chapter-toggle-fl-2').locator('span', { hasText: '/5' }),
  ).toHaveCSS('color', MUTED)

  // シナリオカードの「クリア済み」ラベルは緑・所要時間はグレーのまま
  await page.getByTestId('chapter-toggle-fl-1').click()
  const card = page.getByTestId('scenario-item-fl-1-01')
  await expect(card.locator('span', { hasText: 'クリア済み' })).toHaveCSS('color', GREEN)
  await expect(card.locator('div', { hasText: '約' }).last()).toHaveCSS('color', MUTED)
})
