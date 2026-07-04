import { test, expect } from '@playwright/test'

// 横持ちガード（設計書 v1.3 §8・AC-011）：縦持ちモバイル幅で回転案内を表示し、
// 横持ち・デスクトップでは表示しない。

test.describe('縦持ちモバイル（390×844）', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('回転ガードが表示され操作を遮る', async ({ page }) => {
    await page.goto('/?skipTyping=1')
    await expect(page.getByTestId('rotate-guard')).toBeVisible()
    await expect(page.getByTestId('rotate-guard')).toContainText('横向き')
  })
})

test.describe('横持ちモバイル（844×390）', () => {
  test.use({ viewport: { width: 844, height: 390 } })

  test('回転ガードは非表示でプレイ可能', async ({ page }) => {
    await page.goto('/?skipTyping=1')
    await expect(page.getByTestId('rotate-guard')).toBeHidden()
    await expect(page.getByTestId('btn-start')).toBeVisible()
    // 立ち絵が画面幅に収まる（横スクロールが発生しない）ことを確認
    await page.getByTestId('btn-start').click()
    await page.getByTestId('scenario-item-fl-1-01').click()
    await expect(page.getByTestId('screen-play')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
