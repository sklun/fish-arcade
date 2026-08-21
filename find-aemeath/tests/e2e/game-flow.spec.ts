import { expect, test, type Page } from '@playwright/test'

const startGame = async (page: Page): Promise<void> => {
  await page.goto('/games/find-aemeath/game?level=0')
  await expect(page.getByRole('grid', { name: /爱弥斯搜索棋盘/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /游戏中心/ })).toHaveAttribute('href', '/')
}

test('starts directly and clamps requested levels to saved progress', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('find-aemeath:v1:progress', JSON.stringify({ highestLevel: 2, currentLevel: 2 }))
  })
  await page.goto('/games/find-aemeath/game?level=99')
  await expect(page.locator('.hud__level')).toContainText('第 3 关')
  await expect(page.getByRole('grid', { name: /爱弥斯搜索棋盘/ })).toBeVisible()
})

test('starts a level and exposes the core controls', async ({ page }) => {
  await startGame(page)
  await expect(page.locator('.board-cell__shine')).toHaveCount(0)
  await expect(page.getByLabel('本关用时')).toHaveText(/^\d{2,}:\d{2}$/)
  await expect(page.getByRole('button', { name: '目标提示' })).toBeVisible()
  await expect(page.getByRole('button', { name: '暂停' })).toBeVisible()
  await page.getByRole('button', { name: '暂停' }).click()
  await expect(page.getByRole('dialog', { name: '暂时停留' })).toBeVisible()
  await page.getByRole('button', { name: '继续探索' }).click()
})

test('animates automatic marks as an outward X wave', async ({ page }) => {
  await startGame(page)
  const target = await page.evaluate(() => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $pinia: { _s: Map<string, { cells: Array<{ row: number; col: number; hasTarget: boolean }> }> } } } }
    }
    const store = app.__vue_app__?.config.globalProperties.$pinia._s.get('aemeath-game')
    const cell = store?.cells.find((candidate) => candidate.hasTarget)
    if (!cell) throw new Error('Target cell is unavailable')
    return { row: cell.row, col: cell.col }
  })

  const targetCell = page.getByRole('gridcell', { name: new RegExp(`第 ${target.row + 1} 行第 ${target.col + 1} 列`) })
  await targetCell.dblclick()
  const autoMarkedCell = page.locator('.board-cell--auto-flagged').first()
  await expect(autoMarkedCell).toBeVisible()
  await expect.poll(() => autoMarkedCell.locator('.board-cell__mark').evaluate((mark) => getComputedStyle(mark).animationName)).toBe('auto-mark-wave-in')
  await expect.poll(() => autoMarkedCell.evaluate((cell) => getComputedStyle(cell, '::after').animationName)).toBe('auto-mark-cell-fill')

  const waveDelays = await page.locator('.board-cell--auto-flagged').evaluateAll((cells) => cells.map((cell) => ({
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
    delay: Number.parseFloat(getComputedStyle(cell.querySelector('.board-cell__mark') as Element).animationDelay),
    opacity: getComputedStyle(cell).opacity,
  })))
  const distances = waveDelays.map((cell) => ({
    distance: Math.hypot(cell.row - target.row, cell.col - target.col),
    delay: cell.delay,
  }))
  const nearest = distances.reduce((result, cell) => cell.distance < result.distance ? cell : result)
  const farthest = distances.reduce((result, cell) => cell.distance > result.distance ? cell : result)
  expect(waveDelays.every((cell) => cell.opacity === '1')).toBe(true)
  expect(nearest.delay).toBe(0)
  expect(nearest.delay).toBeLessThan(farthest.delay)
})

test('fits the game background to the viewport', async ({ page }) => {
  await startGame(page)
  const background = await page.locator('.game-screen').evaluate((screen) => {
    const style = window.getComputedStyle(screen, '::before')
    return {
      position: style.position,
      width: style.width,
      height: style.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })
  expect(background.position).toBe('fixed')
  expect(Number.parseFloat(background.width)).toBeCloseTo(background.viewportWidth, 0)
  expect(Number.parseFloat(background.height)).toBeCloseTo(background.viewportHeight, 0)
})

test('keeps the mobile board within the viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only layout check')
  await startGame(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  const board = await page.getByRole('grid', { name: /爱弥斯搜索棋盘/ }).boundingBox()
  expect(board).not.toBeNull()
  expect(board?.x).toBeGreaterThanOrEqual(0)
  expect((board?.x ?? 0) + (board?.width ?? 0)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
})
