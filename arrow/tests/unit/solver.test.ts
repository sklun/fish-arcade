import {describe, expect, it} from 'vitest'

import {solveBoard, solveLevel} from '@/game/solver'
import type {Level} from '@/game/model'

describe('Python-compatible board solver', () => {
    it('removes fixed-direction paths in board iteration order', () => {
        const paths = [
            [{row: 0, col: 0}, {row: 0, col: 1}],
            [{row: 0, col: 2}, {row: 0, col: 3}],
        ]

        expect(solveBoard(paths, 1, 4)).toEqual({order: [1, 0], stuck: []})
    })

    it('reports a fixed-direction dependency cycle instead of flipping paths', () => {
        const paths = [
            [{row: 1, col: 0}, {row: 1, col: 1}],
            [{row: 1, col: 3}, {row: 1, col: 2}],
        ]

        expect(solveBoard(paths, 3, 5)).toEqual({order: [], stuck: [0, 1]})
    })

    it('adapts path indices to the existing Arrow ID result', () => {
        const level: Level = {
            id: 'solver-test',
            difficulty: 'normal',
            rows: 1,
            cols: 4,
            arrows: [
                {id: 'first', color: '#fff', cells: [{row: 0, col: 0}, {row: 0, col: 1}], direction: 'right', head: {row: 0, col: 1}, alive: true, highlighted: false},
                {id: 'second', color: '#fff', cells: [{row: 0, col: 2}, {row: 0, col: 3}], direction: 'right', head: {row: 0, col: 3}, alive: true, highlighted: false},
            ],
            timeLimitSec: 30,
            seed: 1,
        }

        expect(solveLevel(level)).toMatchObject({solvable: true, solution: ['second', 'first'], timedOut: false})
    })
})
