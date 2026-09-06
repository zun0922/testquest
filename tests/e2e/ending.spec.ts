import { test, expect, type Page } from '@playwright/test'

// FR-P2-002 エンディング。要件仕様 v0.2。
// 到達の記録は「結果画面から戻る」タイミングで行われるため、
// FL編を1本だけ残した状態を作り、その1本をプレイして到達させる。

const SAVE_KEY = 'testquest:save'

/**
 * FL編を1本（fl-1-01）だけ残してクリア済みにしたセーブを作る。
 * cleanGain の配分でエンディングが決まるので、テストごとに偏りを指定する。
 */
async function seedSave(page: Page, gain: Record<string, number>) {
  await page.goto('/?skipTyping=1')
  await page.evaluate(
    async ({ key, gain }) => {
      const idx = await (await fetch('/data/scenarios/index.json')).json()
      const cleared: Record<string, unknown> = {}
      for (const s of idx.scenarios) {
        if (s.level !== 'FL' || s.id === 'fl-1-01') continue
        cleared[s.id] = {
          clearedAt: '2026-08-30T00:00:00.000Z',
          ratings: { best: 4, good: 0, poor: 0 },
          statusGain: {},
          cleanGain: gain,
        }
      }
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          status: { knowledge: 50, skill: 50, confidence: 50, teamwork: 50 },
          cleared,
        }),
      )
    },
    { key: SAVE_KEY, gain },
  )
  await page.reload()
}

/** 残した1本をプレイして結果画面まで進める。 */
async function playLastScenario(page: Page) {
  await page.getByTestId('btn-continue').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()
  await page.getByTestId('scenario-item-fl-1-01').click()
  await expect(page.getByTestId('screen-play')).toBeVisible()
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
}

test('FL編を全クリアするとエンディングに到達する（知識偏重＝知識の探求者）', async ({ page }) => {
  await seedSave(page, { knowledge: 8 }) // 知識だけを積む
  await playLastScenario(page)

  // 結果画面を見てから遷移する（唐突に飛ばさない設計）
  await page.getByTestId('btn-back-select').click()
  await expect(page.getByTestId('screen-ending')).toBeVisible()
  await expect(page.getByTestId('ending-name')).toHaveText('知識の探求者')
  await page.screenshot({ path: 'e2e-shots/ending-01-play.png', fullPage: true })
})

test('チームワーク偏重なら別のエンディングになる（分岐が機能する）', async ({ page }) => {
  await seedSave(page, { teamwork: 2 }) // チームワークだけを積む
  await playLastScenario(page)
  await page.getByTestId('btn-back-select').click()
  await expect(page.getByTestId('screen-ending')).toBeVisible()
  await expect(page.getByTestId('ending-name')).toHaveText('チームの要')
})

test('エンディングを読み終えると一覧へ進み、未到達は伏せられる', async ({ page }) => {
  await seedSave(page, { knowledge: 8 })
  await playLastScenario(page)
  await page.getByTestId('btn-back-select').click()
  await expect(page.getByTestId('screen-ending')).toBeVisible()

  // 最終行まで送る
  for (let i = 0; i < 20; i++) {
    if (await page.getByTestId('btn-ending-close').isVisible()) break
    await page.getByTestId('ending-window').click()
  }
  await page.getByTestId('btn-ending-close').click()

  await expect(page.getByTestId('screen-ending-list')).toBeVisible()
  await page.screenshot({ path: 'e2e-shots/ending-02-list.png', fullPage: true })
  // 到達済みは名称が見え、未到達は伏せられる
  await expect(page.getByTestId('ending-item-fl-knowledge')).toContainText('知識の探求者')
  await expect(page.getByTestId('ending-item-grand')).toContainText('？？？')
  await expect(page.getByTestId('ending-count')).toContainText('1 / 7')
})

test('一覧から到達済みのエンディングを再生できる', async ({ page }) => {
  await seedSave(page, { knowledge: 8 })
  await playLastScenario(page)
  await page.getByTestId('btn-back-select').click()
  for (let i = 0; i < 20; i++) {
    if (await page.getByTestId('btn-ending-close').isVisible()) break
    await page.getByTestId('ending-window').click()
  }
  await page.getByTestId('btn-ending-close').click()
  await expect(page.getByTestId('screen-ending-list')).toBeVisible()

  await page.getByTestId('ending-item-fl-knowledge').click()
  await expect(page.getByTestId('screen-ending')).toBeVisible()
  await expect(page.getByTestId('ending-name')).toHaveText('知識の探求者')
})

test('選択画面からエンディング一覧に入れる（到達後のみ入口が出る）', async ({ page }) => {
  await seedSave(page, { knowledge: 8 })
  // 到達前は入口が無い
  await page.getByTestId('btn-continue').click()
  await expect(page.getByTestId('screen-select')).toBeVisible()
  await expect(page.getByTestId('btn-endings')).toHaveCount(0)

  await page.getByTestId('scenario-item-fl-1-01').click()
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
  await page.getByTestId('btn-back-select').click()
  for (let i = 0; i < 20; i++) {
    if (await page.getByTestId('btn-ending-close').isVisible()) break
    await page.getByTestId('ending-window').click()
  }
  await page.getByTestId('btn-ending-close').click()
  await page.getByTestId('btn-ending-list-back').click()

  await expect(page.getByTestId('screen-select')).toBeVisible()
  await expect(page.getByTestId('btn-endings')).toBeVisible()
  await page.getByTestId('btn-endings').click()
  await expect(page.getByTestId('screen-ending-list')).toBeVisible()
})

test('エンディング画面に数値・%が表示されない（UI-RULE-006）', async ({ page }) => {
  await seedSave(page, { knowledge: 8 })
  await playLastScenario(page)
  await page.getByTestId('btn-back-select').click()
  await expect(page.getByTestId('screen-ending')).toBeVisible()

  await expect(page.getByTestId('ending-name')).not.toHaveText(/\d/)
  const body = await page.getByTestId('screen-ending').innerText()
  expect(body, `エンディング画面に % が出ている: ${body}`).not.toMatch(/[%％]/)
})
