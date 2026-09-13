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
    await page.waitForTimeout(120) // 設問の間合い（pacing.ts）を待つ
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

// PO実機フィードバック（2026-09-13）：
//   「ヒント文がアイコンやポイントの背面にあり、文字が欠ける可能性がある」
// 原因は 2026-09-06 に上部ボタンを前面（z-30）へ上げた副作用。
// レイアウトで解決したので、実際の描画位置で重なりと見切れを検証する。
test('ヒント文が上部のボタン・ステータスと重ならず、枠内に収まる', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openFirstChoice(page, 90) // Lv1（FLは合計60以上）
  await page.getByTestId('btn-hint').click()
  await expect(page.getByTestId('hint-text')).toBeVisible()

  const r = await page.evaluate(() => {
    const box = (s: string) => {
      const el = document.querySelector(s)
      return el ? el.getBoundingClientRect() : null
    }
    const hint = box('[data-testid="hint-text"]')!
    const overlayEl = document.querySelector('[data-testid="choice-overlay"]')! as HTMLElement
    const overlay = overlayEl.getBoundingClientRect()
    const bar = document.querySelectorAll('[data-testid="btn-voice"],[data-testid="btn-skip"],[data-testid="btn-backlog"],[data-testid="btn-pause"]')
    const overlaps = [...bar].some((b) => {
      const x = b.getBoundingClientRect()
      return !(hint.right < x.left || hint.left > x.right || hint.bottom < x.top || hint.top > x.bottom)
    })
    return {
      overlaps,
      clipped: hint.top < overlay.top - 1 || hint.bottom > overlay.bottom + 1,
      scrollOverflow: overlayEl.scrollHeight - overlayEl.clientHeight,
    }
  })
  expect(r.overlaps, 'ヒント文が上部ボタンと重なっている').toBe(false)
  expect(r.clipped, 'ヒント文が枠からはみ出して見切れている').toBe(false)
  expect(r.scrollOverflow, 'はみ出してスクロールが必要になっている').toBeLessThanOrEqual(0)
  await page.screenshot({ path: 'e2e-shots/hint-layout.png' })
})

// 「解答するとすぐに次の問題が出てくる」への対応：本文に暗幕をかけず、設問を読み続けられるようにした
test('選択肢の表示中でも設問の本文が暗くならない', async ({ page }) => {
  await openFirstChoice(page, 40) // ヒントは使えない状態でよい
  const covered = await page.evaluate(() => {
    const msg = document.querySelector('[data-testid="message-window"]')!.getBoundingClientRect()
    // 暗幕（aria-hidden の黒い層）が本文の領域に重なっていないこと
    return [...document.querySelectorAll('div[aria-hidden]')].some((d) => {
      const el = d as HTMLElement
      if (!el.className.includes('bg-black/40')) return false
      const r = el.getBoundingClientRect()
      return r.bottom > msg.top + 1
    })
  })
  expect(covered, '本文に暗幕がかかっている').toBe(false)
})

// 最悪条件のレイアウト（PO確認 2026-09-13）。
// 実データの上限（設問65字・ヒント54字・選択肢36字×3）でも、スキーマ上限（200/100/40×3）でも
// ①ヒント文が上部ボタンに重ならない ②選択肢が本文に重ならない ことを実寸で確かめる。
// 本文の長さでメッセージ窓の高さが変わるため、中央帯は窓の実寸に追従させている。
for (const c of [
  { label: '実データ上限', q: 65, hint: 54, choice: 36 },
  { label: 'スキーマ上限', q: 200, hint: 100, choice: 40 },
]) {
  test(`${c.label}の設問でもヒント文と選択肢が本文・ボタンに重ならない`, async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/?skipTyping=1')
    const base = await (await page.request.get('/data/scenarios/fl-1/fl-1-01.json')).json()
    const src = JSON.parse(JSON.stringify(base))
    const q = src.nodes.find((n: { type?: string }) => n.type === 'choice')
    const pad = (n: number) => 'あ'.repeat(n)
    q.text = `設問${pad(c.q - 2)}`
    q.hint = `ヒント${pad(c.hint - 3)}`
    q.choices = q.choices.map((x: Record<string, unknown>, i: number) => {
      const y = { ...x, text: `選択肢${i + 1}${pad(c.choice - 4)}` }
      delete y.emphasis
      return y
    })
    src.startNodeId = q.id
    await page.route('**/data/scenarios/fl-1/fl-1-01.json', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(src) }),
    )
    await page.evaluate(
      ({ k, v }) => localStorage.setItem(k, v),
      { k: SAVE_KEY, v: JSON.stringify(saveWithTotal(90)) },
    )
    await page.reload()
    await page.getByTestId('btn-continue').click()
    await page.getByTestId('scenario-item-fl-1-01').click()
    await expect(page.getByTestId('btn-hint')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('btn-hint').click()
    await expect(page.getByTestId('hint-text')).toBeVisible()

    const r = await page.evaluate(() => {
      const band = document.querySelector('[data-testid="choice-overlay"]')!.getBoundingClientRect()
      const para = document.querySelector('[data-testid="message-window"] p')!.getBoundingClientRect()
      const hintEl = document.querySelector('[data-testid="hint-text"]')!
      const text = (hintEl.querySelector('span') ?? hintEl).getBoundingClientRect()
      const bars = ['btn-voice', 'btn-skip', 'btn-backlog', 'btn-pause'].map(
        (t) => document.querySelector(`[data-testid="${t}"]`)!.getBoundingClientRect(),
      )
      const hit = (a: DOMRect, b: DOMRect) =>
        !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
      return {
        overParagraph: band.bottom > para.top + 1,
        overButtons: bars.some((b) => hit(hintEl.getBoundingClientRect(), b)),
        hintVisibleRatio: (Math.min(text.bottom, band.bottom) - Math.max(text.top, band.top)) / text.height,
      }
    })
    expect(r.overParagraph, '選択肢の領域が本文に重なっている').toBe(false)
    expect(r.overButtons, 'ヒント文が上部ボタンに重なっている').toBe(false)
    // 極端に長い設問ではスクロールが要るが、押した直後に大半が読めること
    expect(r.hintVisibleRatio, 'ヒント文が押した直後に見えていない').toBeGreaterThan(0.75)
  })
}
