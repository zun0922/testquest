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

test.describe('横持ちモバイル（844×390）— タイトル画面の折り返し', () => {
  test.use({ viewport: { width: 844, height: 390 } })

  // 社内FB 2026-09-06：iPhone 横持ちで「麒ヶ島／宗麟」「関係ありませ／ん。」のように
  // 名前や文の途中で改行されていた。折り返してはいけない範囲を span で囲って防いでいるので、
  // 「その span が2行にまたがっていないか」を実際の描画位置で確かめる。
  test('注記と音源クレジットが名前・文の途中で改行されない', async ({ page }) => {
    await page.goto('/?skipTyping=1')
    await expect(page.getByTestId('screen-title')).toBeVisible()
    await expect(page.getByTestId('voice-credits')).toBeVisible() // クレジットの描画を待つ

    await page.screenshot({ path: 'e2e-shots/title-wrap.png' })

    // 折り返すと矩形が行ごとに分かれる。ただし隣り合うテキスト断片でも矩形は分かれるため、
    // 「矩形が何本の行にまたがっているか」＝上端の種類数で数える
    const broken = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="title-notes"]')
      if (!root) return ['title-notes が無い']
      return [...root.querySelectorAll('span')]
        .filter((el) => new Set([...el.getClientRects()].map((r) => Math.round(r.top))).size > 1)
        .map((el) => el.textContent ?? '')
    })
    expect(broken, `途中で改行された箇所: ${broken.join(' / ')}`).toEqual([])
  })
})
