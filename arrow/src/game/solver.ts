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

export const rayHit = (
    owner: ReadonlyMap<string, number>,
    head: Point,
    direction: Point,
    rows: number,
    cols: number,
    removed: ReadonlySet<number>,
): {point: Point | null; blocker: number | null} => {
    let row = head.row
    let col = head.col
    while (true) {
        row += direction.row
        col += direction.col
        if (row < 0 || row >= rows || col < 0 || col >= cols) return {point: null, blocker: null}
        const blocker = owner.get(`${row},${col}`)
        if (blocker === undefined || removed.has(blocker)) continue
        return {point: {row, col}, blocker}
    }
}

/** Python solve_board: fixed rendered direction and complete ray clearance. */
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
            const {blocker} = rayHit(owner, head, direction, rows, cols, removed)
            if (blocker === null) {
                order.push(index)
                removed.add(index)
                remaining.delete(index)
                progress = true
            }
        }
    }
    return {order, stuck: [...remaining].sort((left, right) => left - right)}
}

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
