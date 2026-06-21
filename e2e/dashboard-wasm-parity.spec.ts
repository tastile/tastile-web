import { test, expect } from '@playwright/test'

const executePath = '/dashboard/execute'
const persistentTitle = `E2E Persistent ${Date.now()}`
const recurringTitle = `E2E Recurring ${Date.now()}`

test.describe('dashboard wasm parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(executePath)
    await page.waitForLoadState('networkidle')
    const createHeading = page.getByRole('heading', { name: /Create Tile|タイル作成/ })
    if (await createHeading.isVisible()) {
      await page.getByRole('button', { name: /Close panel|パネルを閉じる/ }).first().click().catch(() => {})
    }
  })

  test('create tile survives reload', async ({ page }) => {
    await openQuickCreate(page)
    await fillTitle(page, persistentTitle)
    await commitCreate(page)
    await expect(page.getByText(persistentTitle).first()).toBeVisible()

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(persistentTitle).first()).toBeVisible()
  })

  test('supports non-default recurring create flow', async ({ page }) => {
    await openQuickCreate(page)
    await fillTitle(page, recurringTitle)
    await page.getByRole('button', { name: /Recurring|定期実行/ }).click()
    await page.getByRole('button', { name: /Weekly|毎週/ }).click()
    await commitCreate(page)

    await expect(page.getByText(recurringTitle).first()).toBeVisible()
  })

  test.skip('status icon opens prompt banner and can dismiss', async ({ page }) => {
    // Status button not present in current calendar-only dashboard layout
    await ensureTileExists(page, `E2E Prompt ${Date.now()}`)
    await requestPromptFromStatusIcon(page)
    await expect(page.getByText(/Start tile|End tile|End break/)).toBeVisible()
    await page.getByRole('button', { name: /Close/ }).click()
    await expect(page.getByText(/Start tile|End tile|End break/)).toBeHidden()
  })

  test.skip('timeline controls operate and zoom does not stretch block height', async ({ page }) => {
    // Timeline zoom/controls not present in current calendar-only dashboard layout
    await ensureTileExists(page, `E2E Timeline ${Date.now()}`)
    const zoom = page.getByLabel('timeline-zoom').first()
    await expect(zoom).toBeVisible()
    await zoom.fill('2')

    const block = page.locator('.absolute.rounded-md.bg-primary\\/10').first()
    await expect(block).toBeVisible()
    await expect(block).toHaveCSS('height', /px/)

    const scope = page.getByRole('combobox').first()
    await scope.selectOption('around-now')
    await expect(scope).toHaveValue('around-now')
  })

  test.skip('next up shows 1+5 cap and ready list keeps bounded rendering', async ({ page }) => {
    // Next Up sidebar not present in current calendar-only dashboard layout
    for (let i = 0; i < 8; i += 1) {
      await ensureTileExists(page, `E2E Batch ${Date.now()}-${i}`)
    }

    const nextUpCard = page.locator('aside').getByText(/Next Up/)
    await expect(nextUpCard).toBeVisible()
    await expect(page.locator('aside').getByText(/E2E Batch/).first()).toBeVisible()
  })

  test.skip('header active countdown updates while running', async ({ page }) => {
    // Start/status flow not present in current calendar-only dashboard layout
    await ensureTileExists(page, `E2E Active ${Date.now()}`)
    await startFirstReadyTile(page)
    const timer = page.locator('.text-3xl.font-mono.font-semibold.tabular-nums.text-foreground').first()
    await expect(timer).toBeVisible()
    const before = (await timer.innerText()).trim()
    await page.waitForTimeout(1500)
    const after = (await timer.innerText()).trim()
    expect(after).not.toEqual(before)
  })
})

async function openQuickCreate(page: import('@playwright/test').Page) {
  const navNew = page.locator('button[title="新規"], button[title="New"]').first()
  await expect(navNew).toBeVisible()
  await navNew.click()
  await expect(page.getByRole('heading', { name: /Create Tile|Create tile|タイル作成/ })).toBeVisible()
}

async function fillTitle(page: import('@playwright/test').Page, title: string) {
  const titleInput = page.locator('section input[type="text"]').first()
  await titleInput.fill(title)
}

async function commitCreate(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /^Create$|^作成$/ }).click()
}

async function ensureTileExists(page: import('@playwright/test').Page, title: string) {
  await openQuickCreate(page)
  await fillTitle(page, title)
  await commitCreate(page)
  await expect(page.getByText(title).first()).toBeVisible()
}

async function requestPromptFromStatusIcon(page: import('@playwright/test').Page) {
  const statusButton = page.getByRole('button', { name: /Status:/ }).first()
  await statusButton.click()
}

async function startFirstReadyTile(page: import('@playwright/test').Page) {
  const startButton = page.getByRole('button', { name: /Start/ }).first()
  if (await startButton.isVisible()) {
    await startButton.click()
    return
  }
  await requestPromptFromStatusIcon(page)
  const promptStart = page.getByRole('button', { name: /Start/ }).first()
  await promptStart.click()
}
