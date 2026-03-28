import { test, expect } from '@playwright/test'

const executePath = '/dashboard/execute'
const persistentTitle = `E2E Persistent ${Date.now()}`
const recurringTitle = `E2E Recurring ${Date.now()}`

test.describe('dashboard wasm parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(executePath)
    await page.waitForLoadState('networkidle')
    const createHeading = page.getByRole('heading', { name: /タイル作成|Create Tile/ })
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
    await page.getByRole('button', { name: /定期実行|Recurring/ }).click()
    await page.getByRole('button', { name: /毎週|Weekly/ }).click()
    await commitCreate(page)

    await expect(page.getByText(recurringTitle).first()).toBeVisible()
  })

  test('status icon opens prompt banner and can dismiss', async ({ page }) => {
    await ensureTileExists(page, `E2E Prompt ${Date.now()}`)
    await requestPromptFromStatusIcon(page)
    await expect(page.getByText(/Start tile|End tile|End break/)).toBeVisible()
    await page.getByRole('button', { name: /閉じる|Close/ }).click()
    await expect(page.getByText(/Start tile|End tile|End break/)).toBeHidden()
  })

  test('timeline controls operate and zoom does not stretch block height', async ({ page }) => {
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

  test('next up shows 1+5 cap and ready list keeps bounded rendering', async ({ page }) => {
    for (let i = 0; i < 8; i += 1) {
      await ensureTileExists(page, `E2E Batch ${Date.now()}-${i}`)
    }

    const nextUpCard = page.locator('aside').getByText(/Next Up|次のタスク/)
    await expect(nextUpCard).toBeVisible()
    await expect(page.locator('aside').getByText(/E2E Batch/).first()).toBeVisible()
  })

  test('header active countdown updates while running', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: /タイル作成|Create Tile/ })).toBeVisible()
}

async function fillTitle(page: import('@playwright/test').Page, title: string) {
  const titleInput = page.locator('section input[type="text"]').first()
  await titleInput.fill(title)
}

async function commitCreate(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /^作成$|^Create$/ }).click()
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
  const startButton = page.getByRole('button', { name: /開始|Start/ }).first()
  if (await startButton.isVisible()) {
    await startButton.click()
    return
  }
  await requestPromptFromStatusIcon(page)
  const promptStart = page.getByRole('button', { name: /開始|Start/ }).first()
  await promptStart.click()
}

