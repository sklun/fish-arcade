import { describe, expect, it } from 'vitest'

import { generateLevel } from '@/game/generator'
import { pointKey } from '@/game/model'
import {
  analyzeSolutions,
  deduceTargets,
  isSolvable,
  regionsAreCoupled,
  targetsRespectConstraints,
} from '@/game/solver'
import { getLevelProfile } from '@/game/progression'

describe('aemeath level generation', () => {
  it('is deterministic for the same level and seed', () => {
    expect(generateLevel(0, 12345)).toEqual(generateLevel(0, 12345))
  })

  it('creates a valid, solvable level with one target per region', () => {
    const level = generateLevel(2, 99)
    expect(level.regions.every((region) => region.cells.length > 0)).toBe(true)
    expect(level.regions.every((region) => region.cells.some((cell) => pointKey(cell) === pointKey(region.target)))).toBe(true)
    expect(level.regions).toHaveLength(level.rows)
    expect(new Set(level.regions.map((region) => region.target.row)).size).toBe(level.rows)
    expect(new Set(level.regions.map((region) => region.target.col)).size).toBe(level.cols)
    expect(targetsRespectConstraints(level)).toBe(true)
    expect(analyzeSolutions(level)).toMatchObject({ solutionCount: 1, unique: true })
    expect(deduceTargets(level)).toHaveLength(level.regions.length)
    expect(isSolvable(level)).toBe(true)
  })

  it('derives the answer from visible regions without reading hidden target fields', () => {
    const level = generateLevel(0, 31415)
    const visibleLevel = {
      rows: level.rows,
      cols: level.cols,
      regions: level.regions.map((region) => ({
        ...region,
        target: { row: -1, col: -1 },
      })),
    }

    const analysis = analyzeSolutions(visibleLevel)
    expect(analysis.unique).toBe(true)
    expect(analysis.solution).toEqual(level.regions.map((region) => region.target))
    expect(deduceTargets(visibleLevel).map((step) => step.target)).toEqual(
      level.regions.map((region) => region.target),
    )
  })

  it('rejects a visible region layout with multiple valid answers', () => {
    const region = (id: string, cells: Array<{ row: number; col: number }>) => ({
      id,
      color: '#000000',
      cells,
      target: cells[0] as { row: number; col: number },
    })
    const analysis = analyzeSolutions({
      rows: 3,
      cols: 3,
      regions: [
        region('first', [{ row: 0, col: 0 }, { row: 0, col: 2 }]),
        region('second', [{ row: 2, col: 0 }, { row: 2, col: 2 }]),
      ],
    })

    expect(analysis).toMatchObject({ solutionCount: 2, unique: false })
  })

  it('generates coupled regions instead of independent straight bands', () => {
    for (const [levelIndex, seed] of [[0, 11], [2, 29], [4, 47], [9, 83]] as const) {
      const level = generateLevel(levelIndex, seed)
      expect(regionsAreCoupled(level)).toBe(true)
      expect(level.regions.filter((region) => region.cells.length === 1).length).toBeLessThanOrEqual(1)
      expect(level.regions.every((region) => {
        const rows = new Set(region.cells.map((cell) => cell.row))
        const cols = new Set(region.cells.map((cell) => cell.col))
        return region.cells.length <= 2 || (rows.size > 1 && cols.size > 1)
      })).toBe(true)
    }
  })

  it('avoids fixed single-cell regions in generated levels', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const level = generateLevel(4, seed * 101)
      expect(level.regions.filter((region) => region.cells.length === 1).length).toBeLessThanOrEqual(1)
      expect(level.regions.every((region) => region.cells.length > 1)).toBe(true)
    }
  })

  it('uses a two-region, two-row subset to eliminate another region', () => {
    const visibleLevel = {
      rows: 4,
      cols: 4,
      regions: [
        {
          id: 'first',
          color: '#000000',
          cells: [{ row: 0, col: 1 }, { row: 1, col: 0 }],
          target: { row: -1, col: -1 },
        },
        {
          id: 'second',
          color: '#000000',
          cells: [{ row: 0, col: 2 }, { row: 1, col: 3 }],
          target: { row: -1, col: -1 },
        },
        {
          id: 'third',
          color: '#000000',
          cells: [{ row: 0, col: 3 }, { row: 2, col: 0 }],
          target: { row: -1, col: -1 },
        },
        {
          id: 'fourth',
          color: '#000000',
          cells: [{ row: 1, col: 2 }, { row: 2, col: 1 }, { row: 3, col: 2 }],
          target: { row: -1, col: -1 },
        },
      ],
    }

    const deductions = deduceTargets(visibleLevel)
    expect(deductions).toHaveLength(4)
    expect(deductions).toContainEqual(expect.objectContaining({
      regionId: 'third',
      target: { row: 2, col: 0 },
      eliminatedCandidates: 1,
      reason: 'row-subset',
    }))
  })

  it('locks a line when one region owns all candidates on that line', () => {
    const deductions = deduceTargets({
      rows: 2,
      cols: 4,
      regions: [
        { id: 'first', color: '#000000', cells: [{ row: 0, col: 1 }, { row: 0, col: 3 }], target: { row: -1, col: -1 } },
        { id: 'second', color: '#000000', cells: [{ row: 0, col: 2 }, { row: 1, col: 3 }], target: { row: -1, col: -1 } },
      ],
    })

    expect(deductions).toContainEqual(expect.objectContaining({
      regionId: 'second',
      target: { row: 1, col: 3 },
      reason: 'row-lock',
    }))
  })

  it('uses a hidden line single when a line has candidates from one region', () => {
    const deductions = deduceTargets({
      rows: 4,
      cols: 4,
      regions: [
        { id: 'first', color: '#000000', cells: [{ row: 0, col: 1 }, { row: 2, col: 3 }], target: { row: -1, col: -1 } },
        { id: 'second', color: '#000000', cells: [{ row: 1, col: 3 }, { row: 2, col: 2 }], target: { row: -1, col: -1 } },
        { id: 'third', color: '#000000', cells: [{ row: 2, col: 0 }, { row: 3, col: 1 }], target: { row: -1, col: -1 } },
        { id: 'fourth', color: '#000000', cells: [{ row: 3, col: 2 }, { row: 1, col: 0 }], target: { row: -1, col: -1 } },
      ],
    })

    expect(deductions).toContainEqual(expect.objectContaining({
      regionId: 'first',
      target: { row: 0, col: 1 },
      reason: expect.stringMatching(/row-(hidden-single|subset)/),
    }))
  })

  it('keeps a complete no-guess deduction chain across progression cycles', () => {
    for (let levelIndex = 0; levelIndex < 15; levelIndex += 1) {
      const level = generateLevel(levelIndex, 7001 + levelIndex * 97)
      expect(analyzeSolutions(level)).toMatchObject({ solutionCount: 1, unique: true })
      const deductions = deduceTargets(level)
      expect(deductions.map((step) => step.target)).toEqual(
        level.regions.map((region) => region.target),
      )
      expect(deductions.filter((step) => step.reason !== 'single-candidate').length).toBeGreaterThanOrEqual(
        level.difficulty === 'hard' ? 2 : 1,
      )
    }
  })

  it('keeps region colors unique on the largest supported hard level', () => {
    const level = generateLevel(64, 123)
    expect(new Set(level.regions.map((region) => region.color)).size).toBe(level.regions.length)
  })

  it('follows four normal levels then one hard level', () => {
    expect([0, 1, 2, 3].map((index) => getLevelProfile(index).difficulty)).toEqual([
      'normal',
      'normal',
      'normal',
      'normal',
    ])
    expect(getLevelProfile(4).difficulty).toBe('hard')
    expect(getLevelProfile(4).rows).toBeGreaterThan(getLevelProfile(0).rows)
    expect(getLevelProfile(0).regions).toBe(getLevelProfile(0).rows)
    expect(getLevelProfile(4).regions).toBe(getLevelProfile(4).rows)
  })
})
