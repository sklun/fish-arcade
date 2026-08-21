import {
  DIRECTION_VECTOR,
  cloneLevel,
  pointKey,
  type Arrow,
  type Direction,
  type Level,
  type Point,
} from '@/game/model'
import { getLevelProfile, seedForLevel } from '@/game/progression'
import { canArrowExit } from '@/game/movement'
import { solveLevel } from '@/game/solver'

const COLORS = ['#ff7a7f', '#ffd447', '#9be23c', '#5ce1d2', '#66b9ff', '#b49cff', '#f58bd2', '#ffad66']
const CARDINAL_DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left']

interface RowSpan {
  left: number
  right: number
}

interface PathCandidate {
  cells: Point[]
  direction: Direction
}

const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value))

const randomInteger = (minimum: number, maximum: number, random: () => number): number =>
  minimum + Math.floor(random() * (maximum - minimum + 1))

const shuffled = <T>(items: readonly T[], random: () => number): T[] => {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    const current = result[index]
    const replacement = result[target]
    if (current === undefined || replacement === undefined) continue
    result[index] = replacement
    result[target] = current
  }
  return result
}

const createShape = (rows: number, cols: number, random: () => number): RowSpan[] => {
  const maxInset = Math.max(2, Math.floor(cols * 0.2))
  let leftInset = randomInteger(0, maxInset, random)
  let rightInset = randomInteger(0, maxInset, random)

  return Array.from({ length: rows }, (_, row) => {
    if (row > 0) {
      leftInset = clamp(leftInset + randomInteger(-1, 1, random), 0, maxInset)
      rightInset = clamp(rightInset + randomInteger(-1, 1, random), 0, maxInset)
    }
    const edgeDistance = Math.min(row, rows - row - 1)
    const taper = edgeDistance === 0 ? 1 : 0
    const left = clamp(leftInset + taper, 0, maxInset + 1)
    const right = clamp(cols - 1 - rightInset - taper, left + Math.floor(cols * 0.58), cols - 1)
    return { left, right }
  })
}

const cellsForShape = (spans: RowSpan[]): Point[] =>
  spans.flatMap((span, row) =>
    Array.from({ length: span.right - span.left + 1 }, (_, offset) => ({
      row,
      col: span.left + offset,
    })),
  )

const neighbours = (point: Point): Point[] => [
  { row: point.row - 1, col: point.col },
  { row: point.row, col: point.col + 1 },
  { row: point.row + 1, col: point.col },
  { row: point.row, col: point.col - 1 },
]

const directionBetween = (from: Point, to: Point): Direction | null => {
  const rowDelta = to.row - from.row
  const colDelta = to.col - from.col
  if (rowDelta === -1 && colDelta === 0) return 'up'
  if (rowDelta === 0 && colDelta === 1) return 'right'
  if (rowDelta === 1 && colDelta === 0) return 'down'
  if (rowDelta === 0 && colDelta === -1) return 'left'
  return null
}

const translate = (point: Point, vector: Point, multiplier = 1): Point => ({
  row: point.row + vector.row * multiplier,
  col: point.col + vector.col * multiplier,
})

const isValidRemainingShape = (remaining: Set<string>, pointByKey: Map<string, Point>): boolean => {
  if (remaining.size === 0) return true
  if (remaining.size === 1) return false
  const firstKey = remaining.values().next().value as string | undefined
  const first = firstKey ? pointByKey.get(firstKey) : undefined
  if (!first) return false
  const visited = new Set<string>()
  const queue = [first]
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index]
    if (!point) continue
    const currentKey = pointKey(point)
    if (visited.has(currentKey)) continue
    visited.add(currentKey)
    for (const neighbour of neighbours(point)) {
      const neighbourKey = pointKey(neighbour)
      if (remaining.has(neighbourKey) && !visited.has(neighbourKey)) queue.push(neighbour)
    }
  }
  return visited.size === remaining.size
}

const hasClearExit = (
  head: Point,
  direction: Direction,
  playable: Set<string>,
  remaining: Set<string>,
): boolean => {
  const vector = DIRECTION_VECTOR[direction]
  let point = translate(head, vector)
  while (playable.has(pointKey(point))) {
    if (remaining.has(pointKey(point))) return false
    point = translate(point, vector)
  }
  return true
}

const targetPathLength = (
  remainingCount: number,
  pathsCreated: number,
  targetArrowCount: number,
  maximum: number,
  random: () => number,
): number => {
  const arrowsNeeded = Math.max(1, targetArrowCount - pathsCreated)
  const ideal = clamp(Math.floor(remainingCount / arrowsNeeded), 2, maximum)
  const roll = random()
  const adjustment = roll < 0.1
    ? randomInteger(2, 5, random)
    : roll < 0.55
      ? -1
      : 0
  return clamp(ideal + adjustment, 2, maximum)
}

const buildPathFromExit = (
  head: Point,
  direction: Direction,
  targetLength: number,
  remaining: Set<string>,
  random: () => number,
): Point[] => {
  const vector = DIRECTION_VECTOR[direction]
  const previous = translate(head, vector, -1)
  if (!remaining.has(pointKey(previous))) return []

  const fromHead = [{ ...head }, previous]
  const used = new Set(fromHead.map(pointKey))
  let previousDirection = directionBetween(head, previous)

  while (fromHead.length < targetLength) {
    const current = fromHead[fromHead.length - 1]
    if (!current) break
    const candidates = shuffled(
      neighbours(current).filter((point) => remaining.has(pointKey(point)) && !used.has(pointKey(point))),
      random,
    ).sort((left, right) => {
      const leftDirection = directionBetween(current, left)
      const rightDirection = directionBetween(current, right)
      const leftTurn = leftDirection !== previousDirection ? 1 : 0
      const rightTurn = rightDirection !== previousDirection ? 1 : 0
      const leftDegree = neighbours(left).filter((point) => remaining.has(pointKey(point)) && !used.has(pointKey(point))).length
      const rightDegree = neighbours(right).filter((point) => remaining.has(pointKey(point)) && !used.has(pointKey(point))).length
      return rightTurn - leftTurn || rightDegree - leftDegree
    })
    const next = candidates[0]
    if (!next) break
    previousDirection = directionBetween(current, next)
    fromHead.push(next)
    used.add(pointKey(next))
  }

  return fromHead.reverse()
}

const findPathCandidate = (
  playableCells: Point[],
  playable: Set<string>,
  remaining: Set<string>,
  pointByKey: Map<string, Point>,
  directionCounts: Record<Direction, number>,
  targetArrowCount: number,
  pathsCreated: number,
  maximumPathLength: number,
  random: () => number,
): PathCandidate | null => {
  const exitOptions = playableCells.flatMap((head) => {
    if (!remaining.has(pointKey(head))) return []
    return CARDINAL_DIRECTIONS.filter((direction) => {
      const previous = translate(head, DIRECTION_VECTOR[direction], -1)
      return remaining.has(pointKey(previous)) && hasClearExit(head, direction, playable, remaining)
    }).map((direction) => ({ head, direction, noise: random() }))
  })

  const orderedOptions = exitOptions.sort((left, right) =>
    directionCounts[left.direction] - directionCounts[right.direction] || left.noise - right.noise,
  )
  const attempts = Math.min(orderedOptions.length * 4, 160)
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const option = orderedOptions[attempt % orderedOptions.length]
    if (!option) break
    const desiredLength = targetPathLength(
      remaining.size,
      pathsCreated,
      targetArrowCount,
      maximumPathLength,
      random,
    )
    const cells = buildPathFromExit(
      option.head,
      option.direction,
      desiredLength,
      remaining,
      random,
    )
    if (cells.length < 2) continue
    const nextRemaining = new Set(remaining)
    for (const cell of cells) nextRemaining.delete(pointKey(cell))
    if (!isValidRemainingShape(nextRemaining, pointByKey)) continue
    return { cells, direction: option.direction }
  }

  // Short boundary paths are a stable fallback when a random long path would
  // split the remaining cells into isolated pockets.
  for (const option of orderedOptions) {
    for (const length of [2, 3, 4]) {
      const cells = buildPathFromExit(option.head, option.direction, length, remaining, random)
      if (cells.length < 2) continue
      const nextRemaining = new Set(remaining)
      for (const cell of cells) nextRemaining.delete(pointKey(cell))
      if (!isValidRemainingShape(nextRemaining, pointByKey)) continue
      return { cells, direction: option.direction }
    }
  }
  return null
}

const buildCandidate = (levelIndex: number, seed: number, targetArrowCount: number): Level | null => {
  const profile = getLevelProfile(levelIndex)
  const random = createRandom(seed)
  const playableCells = cellsForShape(createShape(profile.rows, profile.cols, random))
  const playable = new Set(playableCells.map(pointKey))
  const remaining = new Set(playable)
  const pointByKey = new Map(playableCells.map((point) => [pointKey(point), point]))
  const directionCounts = Object.fromEntries(CARDINAL_DIRECTIONS.map((direction) => [direction, 0])) as Record<Direction, number>
  const extractionOrder: PathCandidate[] = []
  const maximumPathLength = profile.difficulty === 'hard' ? 16 : 12

  while (remaining.size > 0 && extractionOrder.length <= playableCells.length / 2) {
    const candidate = findPathCandidate(
      playableCells,
      playable,
      remaining,
      pointByKey,
      directionCounts,
      targetArrowCount,
      extractionOrder.length,
      maximumPathLength,
      random,
    )
    if (!candidate) return null
    extractionOrder.push(candidate)
    directionCounts[candidate.direction] += 1
    for (const cell of candidate.cells) remaining.delete(pointKey(cell))
  }
  if (remaining.size > 0 || extractionOrder.length < targetArrowCount * 0.7) return null

  const arrows: Arrow[] = [...extractionOrder].reverse().map((candidate, index) => {
    const head = candidate.cells[candidate.cells.length - 1]
    if (!head) throw new Error('Generated arrow is missing its head')
    return {
      id: `arrow-${index + 1}`,
      color: COLORS[index % COLORS.length] ?? '#ffffff',
      cells: candidate.cells,
      direction: candidate.direction,
      head: { ...head },
      alive: true,
      highlighted: false,
    }
  })

  return {
    id: `level-${levelIndex + 1}`,
    difficulty: profile.difficulty,
    rows: profile.rows,
    cols: profile.cols,
    arrows,
    playableCells,
    timeLimitSec: profile.timeLimitSec,
    seed,
  }
}

const followsConstructedSolution = (level: Level): boolean => {
  const candidate = cloneLevel(level)
  for (let index = candidate.arrows.length - 1; index >= 0; index -= 1) {
    const arrow = candidate.arrows[index]
    if (!arrow || !canArrowExit(candidate, arrow.id)) return false
    arrow.alive = false
  }
  return true
}

export const generateLevel = (levelIndex: number, requestedSeed = seedForLevel(levelIndex)): Level => {
  const profile = getLevelProfile(levelIndex)
  for (let retry = 0; retry < 64; retry += 1) {
    const seed = (requestedSeed + retry * 0x9e3779b9) >>> 0
    const candidate = buildCandidate(levelIndex, seed, profile.arrowCount)
    if (!candidate || !followsConstructedSolution(candidate)) continue
    const result = solveLevel(candidate)
    if (result.solvable && result.solution.length === candidate.arrows.length) return candidate
  }
  throw new Error(`Unable to generate a solvable level for index ${levelIndex}`)
}
