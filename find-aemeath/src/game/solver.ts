import { inBounds, neighbours4, neighbours8, pointKey, samePoint, type Level, type Point } from '@/game/model'

export type SolutionAnalysis = {
  solutionCount: number
  solution: Point[] | null
  unique: boolean
}

export type DeductionStep = {
  regionId: string
  target: Point
  eliminatedCandidates: number
  reason: DeductionReason
}

type Axis = 'row' | 'col'

export type DeductionReason =
  | 'single-candidate'
  | 'row-lock'
  | 'column-lock'
  | 'row-subset'
  | 'column-subset'
  | 'row-hidden-single'
  | 'column-hidden-single'

const regionCellsAreConnected = (cells: Point[]): boolean => {
  const allowed = new Set(cells.map(pointKey))
  const first = cells[0]
  if (!first) return false
  const visited = new Set<string>([pointKey(first)])
  const queue = [first]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    for (const next of neighbours4(current)) {
      const key = pointKey(next)
      if (allowed.has(key) && !visited.has(key)) {
        visited.add(key)
        queue.push(next)
      }
    }
  }
  return visited.size === cells.length
}

const inLevel = (level: Level, point: Point): boolean => inBounds(point, level.rows, level.cols)

const regionHasMixedShape = (cells: Point[]): boolean => {
  if (cells.length <= 2) return true
  return new Set(cells.map((cell) => cell.row)).size > 1 && new Set(cells.map((cell) => cell.col)).size > 1
}

export const regionsAreCoupled = (level: Level): boolean => {
  const singleCellRegions = level.regions.filter((region) => region.cells.length === 1).length
  if (singleCellRegions > 1) return false
  if (level.regions.some((region) => !regionHasMixedShape(region.cells))) return false

  const adjacency = level.regions.map(() => new Set<number>())
  const regionIndex = new Map(level.regions.map((region, index) => [region.id, index]))
  const cellsByKey = new Set(level.cells.map(pointKey))
  for (const cell of level.cells) {
    const currentIndex = regionIndex.get(cell.regionId)
    if (currentIndex === undefined) return false
    for (const neighbour of neighbours4(cell)) {
      if (!cellsByKey.has(pointKey(neighbour))) continue
      const neighbourCell = level.cells.find((candidate) => pointKey(candidate) === pointKey(neighbour))
      const neighbourIndex = neighbourCell ? regionIndex.get(neighbourCell.regionId) : undefined
      if (neighbourIndex !== undefined && neighbourIndex !== currentIndex) adjacency[currentIndex]?.add(neighbourIndex)
    }
  }

  const visited = new Set<number>([0])
  const queue = [0]
  while (queue.length > 0) {
    const current = queue.shift() as number
    for (const next of adjacency[current] ?? []) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return visited.size === level.regions.length
}

export const targetsRespectConstraints = (level: Level): boolean => {
  const targets = level.regions.map((region) => region.target)
  return targets.every((target, index) =>
    targets.slice(index + 1).every((other) =>
      target.row !== other.row &&
      target.col !== other.col &&
      !neighbours8(target).some((neighbour) => neighbour.row === other.row && neighbour.col === other.col),
    ),
  )
}

export const validateLevel = (level: Level): boolean => {
  if (level.rows < 1 || level.cols < 1 || level.regions.length < 1) return false
  if (level.rows !== level.cols || level.regions.length !== level.rows) return false
  if (level.cells.length !== level.rows * level.cols) return false
  const cellByKey = new Map(level.cells.map((cell) => [pointKey(cell), cell]))
  const regionIds = new Set<string>()
  const declaredCells = new Set<string>()
  for (const region of level.regions) {
    if (regionIds.has(region.id) || region.cells.length < 1 || !inLevel(level, region.target)) return false
    regionIds.add(region.id)
    const regionCellKeys = new Set(region.cells.map(pointKey))
    if (regionCellKeys.size !== region.cells.length) return false
    for (const cell of region.cells) {
      const key = pointKey(cell)
      if (!inLevel(level, cell) || declaredCells.has(key) || cellByKey.get(key)?.regionId !== region.id) return false
      declaredCells.add(key)
    }
    if (!regionCellsAreConnected(region.cells)) return false
    if (region.cells.filter((cell) => cell.row === region.target.row && cell.col === region.target.col).length !== 1) return false
    const targetCell = cellByKey.get(pointKey(region.target))
    if (!targetCell || targetCell.regionId !== region.id || !targetCell.hasTarget) return false
  }
  if (cellByKey.size !== level.cells.length || cellByKey.size !== level.rows * level.cols) return false
  if (declaredCells.size !== level.rows * level.cols) return false
  if (level.cells.some((cell) => !regionIds.has(cell.regionId))) return false
  if (!regionsAreCoupled(level)) return false
  return targetsRespectConstraints(level)
}

const pointsConflict = (first: Point, second: Point): boolean =>
  first.row === second.row ||
  first.col === second.col ||
  (Math.abs(first.row - second.row) <= 1 && Math.abs(first.col - second.col) <= 1)

const axisValue = (point: Point, axis: Axis): number => point[axis]

const combinations = (items: number[], size: number): number[][] => {
  const result: number[][] = []
  const current: number[] = []
  const visit = (start: number): void => {
    if (current.length === size) {
      result.push([...current])
      return
    }
    for (let index = start; index <= items.length - (size - current.length); index += 1) {
      current.push(items[index] as number)
      visit(index + 1)
      current.pop()
    }
  }
  visit(0)
  return result
}

/**
 * Apply the useful "region subset" deduction: if k unresolved regions can
 * only use k rows (or columns), those rows (or columns) are unavailable to
 * every other unresolved region. This is the general form of the two-region,
 * two-row rule used by the game.
 */
const applySubsetConstraints = (
  candidates: Point[][],
  unresolved: Set<number>,
  maxSubsetSize = 4,
  onChange?: (regionIndex: number, reason: DeductionReason) => void,
): boolean => {
  const unresolvedIndices = [...unresolved]
  if (unresolvedIndices.length < 2) return false
  let changed = false

  for (const axis of ['row', 'col'] as const) {
    const maxSize = Math.min(maxSubsetSize, unresolvedIndices.length - 1)
    const applySize = (size: number): void => {
      if (size > maxSize) return
      for (const subset of combinations(unresolvedIndices, size)) {
        const covered = new Set(subset.flatMap((index) =>
          (candidates[index] ?? []).map((candidate) => axisValue(candidate, axis)),
        ))
        if (covered.size !== size) continue

        for (const regionIndex of unresolvedIndices) {
          if (subset.includes(regionIndex)) continue
          const before = candidates[regionIndex] ?? []
          const after = before.filter((candidate) => !covered.has(axisValue(candidate, axis)))
          if (after.length !== before.length) {
            candidates[regionIndex] = after
            changed = true
            onChange?.(
              regionIndex,
              size === 1
                ? (axis === 'row' ? 'row-lock' : 'column-lock')
                : (axis === 'row' ? 'row-subset' : 'column-subset'),
            )
          }
        }
      }
    }
    // Prefer larger subsets for the explanation, then apply the simpler
    // single-region line lock when it can remove additional candidates.
    for (let size = maxSize; size >= 2; size -= 1) applySize(size)
    applySize(1)
  }
  return changed
}

const applyHiddenLineSingles = (
  candidates: Point[][],
  unresolved: Set<number>,
  rows: number,
  cols: number,
  onChange?: (regionIndex: number, reason: DeductionReason) => void,
): boolean => {
  const unresolvedIndices = [...unresolved]
  let changed = false

  const lines: Array<[Axis, number]> = [['row', rows], ['col', cols]]
  for (const [axis, size] of lines) {
    for (let line = 0; line < size; line += 1) {
      const owners = unresolvedIndices.filter((regionIndex) =>
        (candidates[regionIndex] ?? []).some((candidate) => axisValue(candidate, axis) === line),
      )
      if (owners.length !== 1) continue
      const regionIndex = owners[0] as number
      const before = candidates[regionIndex] ?? []
      const after = before.filter((candidate) => axisValue(candidate, axis) === line)
      if (after.length !== before.length) {
        candidates[regionIndex] = after
        changed = true
        onChange?.(regionIndex, axis === 'row' ? 'row-hidden-single' : 'column-hidden-single')
      }
    }
  }
  return changed
}

export const analyzeSolutions = (level: Pick<Level, 'rows' | 'cols' | 'regions'>, limit = 2): SolutionAnalysis => {
  const solutionLimit = Math.max(2, Math.floor(limit))
  const candidates = level.regions.map((region) => region.cells.filter((cell) => inBounds(cell, level.rows, level.cols)))
  if (candidates.some((regionCandidates) => regionCandidates.length === 0)) {
    return { solutionCount: 0, solution: null, unique: false }
  }

  const selected = new Array<Point | undefined>(level.regions.length)
  let solutionCount = 0
  let firstSolution: Point[] | null = null

  const isAllowed = (candidate: Point): boolean =>
    selected.every((target) => !target || !pointsConflict(candidate, target))

  const search = (remaining: number[]): void => {
    if (solutionCount >= solutionLimit) return
    if (remaining.length === 0) {
      solutionCount += 1
      if (!firstSolution) firstSolution = selected.map((target) => ({ ...(target as Point) }))
      return
    }

    let chosenRegion = remaining[0] as number
    let available = (candidates[chosenRegion] ?? []).filter(isAllowed)
    for (const regionIndex of remaining.slice(1)) {
      const regionAvailable = (candidates[regionIndex] ?? []).filter(isAllowed)
      if (regionAvailable.length < available.length) {
        chosenRegion = regionIndex
        available = regionAvailable
      }
    }
    if (available.length === 0) return

    const nextRemaining = remaining.filter((regionIndex) => regionIndex !== chosenRegion)
    for (const candidate of available) {
      selected[chosenRegion] = candidate
      const hasDeadRegion = nextRemaining.some((regionIndex) =>
        !(candidates[regionIndex] ?? []).some(isAllowed),
      )
      if (!hasDeadRegion) search(nextRemaining)
      selected[chosenRegion] = undefined
      if (solutionCount >= solutionLimit) return
    }
  }

  search(level.regions.map((_, index) => index))
  return {
    solutionCount,
    solution: firstSolution,
    unique: solutionCount === 1,
  }
}

export const deduceTargets = (level: Pick<Level, 'rows' | 'cols' | 'regions'>): DeductionStep[] => {
  const candidates = level.regions.map((region) =>
    region.cells.filter((cell) => inBounds(cell, level.rows, level.cols)),
  )
  const selected = new Array<Point | undefined>(level.regions.length)
  const unresolved = new Set(level.regions.map((_, index) => index))
  const steps: DeductionStep[] = []
  const candidateReasons = new Map<number, DeductionReason>()

  while (unresolved.size > 0) {
    for (const regionIndex of unresolved) {
      const previous = candidates[regionIndex] ?? []
      const allowed = (candidates[regionIndex] ?? []).filter((candidate) =>
        selected.every((target) => !target || !pointsConflict(candidate, target)),
      )
      if (allowed.length === 0) return []
      candidates[regionIndex] = allowed
      if (allowed.length !== previous.length) candidateReasons.set(regionIndex, 'single-candidate')
    }

    const markReason = (regionIndex: number, reason: DeductionReason): void => {
      if (!candidateReasons.has(regionIndex)) candidateReasons.set(regionIndex, reason)
    }
    const subsetChanged = applySubsetConstraints(candidates, unresolved, 4, markReason)
    const hiddenSingleChanged = applyHiddenLineSingles(
      candidates,
      unresolved,
      level.rows,
      level.cols,
      markReason,
    )
    if (hiddenSingleChanged || subsetChanged) continue

    const nextRegion = [...unresolved].find((regionIndex) => (candidates[regionIndex] ?? []).length === 1)
    if (nextRegion === undefined) return []

    const nextCandidates = candidates[nextRegion] as Point[]
    const target = nextCandidates[0] as Point
    const region = level.regions[nextRegion]
    selected[nextRegion] = target
    unresolved.delete(nextRegion)
    steps.push({
      regionId: region?.id ?? '',
      target: { ...target },
      eliminatedCandidates: Math.max(0, (region?.cells.length ?? 0) - nextCandidates.length),
      reason: candidateReasons.get(nextRegion) ?? 'single-candidate',
    })
    candidateReasons.delete(nextRegion)
  }

  const regionOrder = new Map(level.regions.map((region, index) => [region.id, index]))
  return steps.sort((first, second) =>
    (regionOrder.get(first.regionId) ?? Number.MAX_SAFE_INTEGER) -
    (regionOrder.get(second.regionId) ?? Number.MAX_SAFE_INTEGER),
  )
}

export const solveLevel = (level: Level): Point[] => {
  if (!validateLevel(level)) return []
  const deductions = deduceTargets(level)
  if (deductions.length !== level.regions.length) return []
  const analysis = analyzeSolutions(level)
  if (!analysis.unique || !analysis.solution) return []
  const matchesStoredTargets = analysis.solution.every((target, index) => {
    const storedTarget = level.regions[index]?.target
    return storedTarget ? samePoint(target, storedTarget) : false
  })
  return matchesStoredTargets ? analysis.solution : []
}

export const isSolvable = (level: Level): boolean => solveLevel(level).length === level.regions.length
