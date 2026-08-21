import {
  DIRECTION_VECTOR,
  pointKey,
  type Arrow,
  type Level,
  type Point,
} from '@/game/model'

export interface MovementTrace {
  canExit: boolean
  collisionStep: number | null
  exitStep: number | null
  frames: Point[][]
}

export const isInsideBoard = (
  point: Point,
  level: Pick<Level, 'rows' | 'cols' | 'playableCells'>,
): boolean => {
  if (point.row < 0 || point.row >= level.rows || point.col < 0 || point.col >= level.cols) return false
  if (!level.playableCells) return true
  return level.playableCells.some((cell) => cell.row === point.row && cell.col === point.col)
}

export const translatePoint = (point: Point, vector: Point, steps = 1): Point => ({
  row: point.row + vector.row * steps,
  col: point.col + vector.col * steps,
})

export const translateCells = (cells: Point[], vector: Point, steps = 1): Point[] =>
  cells.map((cell) => translatePoint(cell, vector, steps))

/** Advance a line like a chain: its head moves forward and every body point follows the previous one. */
export const advanceCells = (cells: Point[], vector: Point): Point[] => {
  if (cells.length === 0) return []
  const nextHead = translatePoint(cells[cells.length - 1]!, vector)
  return [...cells.slice(1), nextHead]
}

export const occupiedByOtherArrows = (arrows: Arrow[], movingId: string): Set<string> => {
  const occupied = new Set<string>()
  for (const arrow of arrows) {
    if (!arrow.alive || arrow.id === movingId) continue
    for (const cell of arrow.cells) occupied.add(pointKey(cell))
  }
  return occupied
}

const intersectsObstacle = (
  previousCells: Point[],
  nextCells: Point[],
  vector: Point,
  occupied: Set<string>,
  level: Pick<Level, 'rows' | 'cols' | 'playableCells'>,
): boolean => {
  const previousHead = previousCells[previousCells.length - 1]
  const nextHead = nextCells[nextCells.length - 1]
  if (!previousHead || !nextHead) return false
  if (isInsideBoard(nextHead, level) && occupied.has(pointKey(nextHead))) return true

  if (vector.row !== 0 && vector.col !== 0) {
    const rowIntermediate = { row: previousHead.row + vector.row, col: previousHead.col }
    const colIntermediate = { row: previousHead.row, col: previousHead.col + vector.col }
    if (
      (isInsideBoard(rowIntermediate, level) && occupied.has(pointKey(rowIntermediate))) ||
      (isInsideBoard(colIntermediate, level) && occupied.has(pointKey(colIntermediate)))
    ) {
      return true
    }
  }
  return false
}

export const traceArrowMovement = (level: Level, arrowId: string): MovementTrace => {
  const arrow = level.arrows.find((candidate) => candidate.id === arrowId && candidate.alive)
  if (!arrow) return { canExit: false, collisionStep: null, exitStep: null, frames: [] }

  const vector = DIRECTION_VECTOR[arrow.direction]
  const occupied = occupiedByOtherArrows(level.arrows, arrow.id)
  const frames: Point[][] = []
  let previousCells = arrow.cells.map((cell) => ({ ...cell }))
  const maxSteps = level.rows + level.cols + arrow.cells.length + 2

  for (let step = 1; step <= maxSteps; step += 1) {
    const nextCells = advanceCells(previousCells, vector)
    frames.push(nextCells)
    if (intersectsObstacle(previousCells, nextCells, vector, occupied, level)) {
      return { canExit: false, collisionStep: step, exitStep: null, frames }
    }
    if (nextCells.every((cell) => !isInsideBoard(cell, level))) {
      return { canExit: true, collisionStep: null, exitStep: step, frames }
    }
    previousCells = nextCells
  }

  return { canExit: false, collisionStep: null, exitStep: null, frames }
}

export const canArrowExit = (level: Level, arrowId: string): boolean =>
  traceArrowMovement(level, arrowId).canExit

export const movableArrowIds = (level: Level): string[] =>
  level.arrows.filter((arrow) => arrow.alive && canArrowExit(level, arrow.id)).map((arrow) => arrow.id)
