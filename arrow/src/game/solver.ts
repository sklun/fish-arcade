import { cloneLevel, type Level } from '@/game/model'
import { movableArrowIds } from '@/game/movement'

export interface SolveResult {
  solvable: boolean
  solution: string[]
  exploredStates: number
  timedOut: boolean
}

export const solveLevel = (level: Level, nodeLimit = 100_000): SolveResult => {
  const aliveArrows = level.arrows.filter((arrow) => arrow.alive)
  const indexById = new Map(aliveArrows.map((arrow, index) => [arrow.id, index]))
  const fullMask = (1n << BigInt(aliveArrows.length)) - 1n
  const memo = new Set<bigint>()
  let exploredStates = 0
  let timedOut = false

  const levelForMask = (mask: bigint): Level => {
    const candidate = cloneLevel(level)
    for (const arrow of candidate.arrows) {
      const index = indexById.get(arrow.id)
      arrow.alive = index === undefined ? false : (mask & (1n << BigInt(index))) !== 0n
    }
    return candidate
  }

  const search = (mask: bigint): string[] | null => {
    if (mask === 0n) return []
    if (memo.has(mask)) return null
    if (exploredStates >= nodeLimit) {
      timedOut = true
      return null
    }
    exploredStates += 1

    const candidates = movableArrowIds(levelForMask(mask)).sort((left, right) => {
      const leftIndex = indexById.get(left) ?? 0
      const rightIndex = indexById.get(right) ?? 0
      return rightIndex - leftIndex
    })

    for (const id of candidates) {
      const index = indexById.get(id)
      if (index === undefined) continue
      const rest = search(mask & ~(1n << BigInt(index)))
      if (rest) return [id, ...rest]
    }

    memo.add(mask)
    return null
  }

  const solution = search(fullMask)
  return {
    solvable: solution !== null,
    solution: solution ?? [],
    exploredStates,
    timedOut,
  }
}
