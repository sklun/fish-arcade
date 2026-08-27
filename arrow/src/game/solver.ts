import {type Level, type Point, pointKey} from '@/game/model'

export interface SolveBoardResult {
    order: number[]
    stuck: number[]
}

export interface SolveResult {
    solvable: boolean
    solution: string[]
    exploredStates: number
    timedOut: boolean
}

/**
 * Simulate the fixed directions rendered on the board, matching Python solve_board.
 * A path is removable only when its final cell points outside the board or at a
 * path that has already been removed; path reversal is intentionally not allowed.
 */
export const solveBoard = (paths: Point[][], rows: number, cols: number): SolveBoardResult => {
    const owner = new Map<string, number>()
    paths.forEach((path, index) => path.forEach((point) => owner.set(pointKey(point), index)))
    const removed = new Set<number>()
    const order: number[] = []
    const remaining = new Set(paths.map((_, index) => index))
    let progress = true

    while (progress && remaining.size > 0) {
        progress = false
        for (const index of [...remaining]) {
            const path = paths[index]
            if (!path || path.length < 2) continue
            const head = path[path.length - 1]!
            const previous = path[path.length - 2]!
            const direction = {row: head.row - previous.row, col: head.col - previous.col}
            const next = {row: head.row + direction.row, col: head.col + direction.col}
            const ownerNext = next.row >= 0 && next.row < rows && next.col >= 0 && next.col < cols
                ? owner.get(pointKey(next))
                : undefined
            if (ownerNext !== index && (ownerNext === undefined || removed.has(ownerNext))) {
                order.push(index)
                removed.add(index)
                remaining.delete(index)
                progress = true
            }
        }
    }

    return {order, stuck: [...remaining].sort((left, right) => left - right)}
}

/** Adapt Python solve_board's path-index result to Arrow's existing ID-based API. */
export const solveLevel = (level: Level, _nodeLimit = 100_000): SolveResult => {
    const aliveArrows = level.arrows.filter((arrow) => arrow.alive)
    const result = solveBoard(aliveArrows.map((arrow) => arrow.cells), level.rows, level.cols)
    return {
        solvable: result.stuck.length === 0,
        solution: result.order.map((index) => aliveArrows[index]?.id).filter((id): id is string => id !== undefined),
        exploredStates: result.order.length + result.stuck.length,
        timedOut: false,
    }
}
