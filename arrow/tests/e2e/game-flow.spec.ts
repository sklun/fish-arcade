import { expect, test, type Page } from '@playwright/test'

import type { Level } from '../../src/game/model'
import { solveLevel } from '../../src/game/solver'

const startGame = async (page: Page): Promise<void> => {
  await page.goto('/games/arrow/game?level=0')
  await expect(page.getByLabel(/箭头棋盘/)).toBeVisible()
  await expect(page.getByRole('link', { name: /游戏中心/ })).toHaveAttribute('href', '/')
}

test('starts directly and clamps requested levels to saved progress', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('arrow.progress.v1', JSON.stringify({ highestLevel: 2 }))
  })
  await page.goto('/games/arrow/game?level=99')
  await expect(page.locator('.hud__level')).toContainText('关卡 3')
  await expect(page.getByLabel(/箭头棋盘/)).toBeVisible()
})

test('launches the selected unlocked level from the platform', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('arrow.progress.v1', JSON.stringify({ highestLevel: 2 }))
  })
  await page.goto('/')
  const entry = page.locator('.game-entry').filter({ has: page.getByRole('heading', { name: /箭序/ }) })
  await expect(entry.getByText('已通过 2 关')).toBeVisible()
  await entry.getByRole('combobox', { name: '选择关卡' }).selectOption('2')
  await entry.getByRole('link', { name: /继续游戏.*第 3 关/ }).click()
  await expect(page.locator('.hud__level')).toContainText('关卡 3')
})

test('pauses the timer, resumes, and highlights a valid hint', async ({ page }) => {
  await startGame(page)
  const before = await page.locator('.hud__time').textContent()
  await page.getByRole('button', { name: '暂停' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(1100)
  await expect(page.locator('.hud__time')).toHaveText(before ?? '')
  await page.getByRole('button', { name: '继续' }).click()
  await page.getByRole('button', { name: /提示/ }).click()
  await expect(page.locator('.board-arrow--highlighted')).toHaveCount(1)
})

test('handles collision failure and retry', async ({ page }) => {
  await startGame(page)
  await page.evaluate(() => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $pinia: { _s: Map<string, { $patch: (patch: Record<string, unknown>) => void }> } } } }
    }
    const store = app.__vue_app__?.config.globalProperties.$pinia._s.get('game')
    if (!store) throw new Error('Game store is unavailable')
    store.$patch({
      lives: 1,
      level: {
        id: 'collision-e2e', difficulty: 'normal', rows: 5, cols: 5, timeLimitSec: 30, seed: 1,
        arrows: [
          { id: 'moving', color: '#ffd447', cells: [{ row: 2, col: 2 }], head: { row: 2, col: 2 }, direction: 'right', alive: true, highlighted: false },
          { id: 'blocker', color: '#5ce1d2', cells: [{ row: 2, col: 3 }], head: { row: 2, col: 3 }, direction: 'up', alive: true, highlighted: false },
        ],
      },
    })
  })
  await page.locator('[data-arrow-id="moving"]').click()
  await expect(page.getByRole('heading', { name: '生命耗尽' })).toBeVisible()
  await page.getByRole('button', { name: '再试一次' }).click()
  await expect(page.getByLabel(/箭头棋盘/)).toBeVisible()
})

test('handles timeout and return to home', async ({ page }) => {
  await startGame(page)
  await page.evaluate(() => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $pinia: { _s: Map<string, { $patch: (patch: Record<string, unknown>) => void }> } } } }
    }
    const store = app.__vue_app__?.config.globalProperties.$pinia._s.get('game')
    if (!store) throw new Error('Game store is unavailable')
    store.$patch({ timeRemaining: 1 })
  })
  await expect(page.getByRole('heading', { name: '时间已到' })).toBeVisible({ timeout: 3_000 })
  await page.getByRole('button', { name: '返回游戏中心' }).click()
  await expect(page.getByRole('heading', { name: '鱼群就在前面' })).toBeVisible()
})

test('completes a level in solver order and advances progression', async ({ page }) => {
  await startGame(page)
  const level = await page.evaluate(() => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $pinia: { _s: Map<string, { level: Level }> } } } }
    }
    const store = app.__vue_app__?.config.globalProperties.$pinia._s.get('game')
    if (!store) throw new Error('Game store is unavailable')
    return JSON.parse(JSON.stringify(store.level)) as Level
  })
  const solution = solveLevel(level).solution
  for (const id of solution) {
    await page.locator(`[data-arrow-id="${id}"] .board-arrow__head`).click()
    await page.waitForTimeout(340)
  }
  await expect(page.getByRole('heading', { name: '全部放行' })).toBeVisible()
  await page.getByRole('button', { name: '下一关' }).click()
  await expect(page.locator('.hud__level')).toContainText('关卡 2')
})

test('keeps the mobile viewport free of horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only layout check')
  await startGame(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(page.locator('.game-tools')).toBeVisible()
})
