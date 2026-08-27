import {describe, expect, it} from 'vitest'

import {generateLevel, verifyGeneratedPaths} from '@/game/generator'

describe('level generation', () => {
    it('is deterministic for the same seed', () => {
        expect(generateLevel(0, 42)).toEqual(generateLevel(0, 42))
    })

    it.each([0, 1, 4, 5])('generates a solvable level for index %i', (levelIndex) => {
        const level = generateLevel(levelIndex)
        expect(verifyGeneratedPaths(level.arrows.map((arrow) => arrow.cells), level.rows, level.cols)).toBe(true)
        expect(level.arrows.length).toBeGreaterThanOrEqual(level.difficulty === 'hard' ? 50 : 48)
        expect(level.arrows.every((arrow) => arrow.cells.length >= 2)).toBe(true)
    })

    it('creates a compact layout with multi-bend paths', () => {
        const level = generateLevel(0, 42)
        const occupied = new Set(level.arrows.flatMap((arrow) => arrow.cells.map((cell) => `${cell.row},${cell.col}`)))
        const region = new Set((level.playableCells ?? []).map((cell) => `${cell.row},${cell.col}`))
        const bendCounts = level.arrows.map((arrow) => {
            const vectors = arrow.cells.slice(1).map((cell, index) => ({
                row: cell.row - (arrow.cells[index]?.row ?? cell.row),
                col: cell.col - (arrow.cells[index]?.col ?? cell.col),
            }))
            return vectors.slice(1).filter((vector, index) => {
                const previous = vectors[index]
                return previous && (vector.row !== previous.row || vector.col !== previous.col)
            }).length
        })

        expect(occupied.size / (level.rows * level.cols)).toBeGreaterThan(0.6)
        expect(region).toEqual(occupied)
        expect(level.arrows.every((arrow) => arrow.cells.length >= 2)).toBe(true)
        expect(
            level.arrows.every((arrow) =>
                arrow.cells.slice(1).every((cell, index) => {
                    const previous = arrow.cells[index]
                    return previous && Math.abs(cell.row - previous.row) + Math.abs(cell.col - previous.col) === 1
                }),
            ),
        ).toBe(true)
        expect(bendCounts.filter((count) => count > 0).length).toBeGreaterThanOrEqual(level.arrows.length * 0.5)
        expect(bendCounts.some((count) => count >= 3)).toBe(true)
        expect(Math.max(...level.arrows.map((arrow) => arrow.cells.length))).toBeGreaterThanOrEqual(7)
    })

    it('creates one connected playable shape', () => {
        const level = generateLevel(0, 42)
        const region = new Set((level.playableCells ?? []).map((cell) => `${cell.row},${cell.col}`))
        const first = level.playableCells?.[0]
        const visited = new Set<string>()
        const queue = first ? [first] : []

        for (let index = 0; index < queue.length; index += 1) {
            const cell = queue[index]
            if (!cell) continue
            const key = `${cell.row},${cell.col}`
            if (visited.has(key)) continue
            visited.add(key)
            for (const [rowOffset, colOffset] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
                const next = {row: cell.row + (rowOffset ?? 0), col: cell.col + (colOffset ?? 0)}
                if (region.has(`${next.row},${next.col}`)) queue.push(next)
            }
        }

        expect(visited).toEqual(region)
        for (let row = 0; row < level.rows; row += 1) {
            const columns = (level.playableCells ?? [])
                .filter((cell) => cell.row === row)
                .map((cell) => cell.col)
                .sort((left, right) => left - right)
            expect(columns).toHaveLength((columns.at(-1) ?? -1) - (columns[0] ?? 0) + 1)
        }
    })

    it('uses all cardinal directions in the dense layout', () => {
        const level = generateLevel(0)
        const counts = ['up', 'right', 'down', 'left'].map(
            (direction) => level.arrows.filter((arrow) => arrow.direction === direction).length,
        )

        expect(Math.min(...counts)).toBeGreaterThanOrEqual(4)
        expect(level.arrows.length).toBeGreaterThanOrEqual(48)
    })
})
