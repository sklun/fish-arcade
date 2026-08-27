import {describe, expect, it} from 'vitest'

import {type Arrow, DIRECTION_VECTOR, DIRECTIONS, type Level} from '@/game/model'
import {advanceCells, traceArrowMovement, translatePoint} from '@/game/movement'

const makeArrow = (id: string, row: number, col: number, direction: Arrow['direction']): Arrow => ({
    id,
    color: '#fff',
    cells: [{row, col}],
    direction,
    head: {row, col},
    alive: true,
    highlighted: false,
})

const makeLevel = (arrows: Arrow[]): Level => ({
    id: 'test',
    difficulty: 'normal',
    rows: 5,
    cols: 5,
    arrows,
    timeLimitSec: 30,
    seed: 1,
})

describe('movement', () => {
    it('advances a polyline as a chain instead of translating its fixed shape', () => {
        const cells = [
            {row: 2, col: 0},
            {row: 2, col: 1},
            {row: 1, col: 1},
        ]

        expect(advanceCells(cells, DIRECTION_VECTOR.right)).toEqual([
            {row: 2, col: 1},
            {row: 1, col: 1},
            {row: 1, col: 2},
        ])
    })

    it('translates a point in all eight directions', () => {
        const origin = {row: 2, col: 2}
        const destinations = new Set(
            DIRECTIONS.map((direction) => {
                const point = translatePoint(origin, DIRECTION_VECTOR[direction])
                return `${point.row},${point.col}`
            }),
        )

        expect(destinations.size).toBe(8)
    })

    it.each(DIRECTIONS)('lets an unobstructed arrow exit toward %s', (direction) => {
        const trace = traceArrowMovement(makeLevel([makeArrow('moving', 2, 2, direction)]), 'moving')
        expect(trace.canExit).toBe(true)
        expect(trace.exitStep).not.toBeNull()
    })

    it('checks the whole translated line for collisions', () => {
        const moving = makeArrow('moving', 2, 1, 'right')
        moving.cells = [{row: 2, col: 0}, {row: 2, col: 1}]
        moving.head = {row: 2, col: 1}
        const blocker = makeArrow('blocker', 2, 3, 'up')

        const trace = traceArrowMovement(makeLevel([moving, blocker]), moving.id)

        expect(trace.canExit).toBe(false)
        expect(trace.collisionStep).toBe(2)
    })

    it('prevents diagonal corner-through movement using supercover cells', () => {
        const moving = makeArrow('moving', 2, 2, 'up-right')
        const blocker = makeArrow('blocker', 1, 2, 'left')

        const trace = traceArrowMovement(makeLevel([moving, blocker]), moving.id)

        expect(trace.canExit).toBe(false)
        expect(trace.collisionStep).toBe(1)
    })

    it('does not treat the board boundary as a collision', () => {
        const moving = makeArrow('moving', 0, 0, 'up-left')
        const trace = traceArrowMovement(makeLevel([moving]), moving.id)

        expect(trace.canExit).toBe(true)
        expect(trace.exitStep).toBe(1)
    })
})
