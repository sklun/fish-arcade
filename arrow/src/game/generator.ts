import {type Arrow, type Direction, DIRECTION_VECTOR, type Level, type Point, pointKey} from '@/game/model'
import {getLevelProfile, seedForLevel} from '@/game/progression'
import {rayHit, solveBoard} from '@/game/solver'

const COLORS = ['#ff7a7f', '#ffd447', '#9be23c', '#5ce1d2', '#66b9ff', '#b49cff', '#f58bd2', '#ffad66']
const CARDINAL_DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left']
const GRID_DIRECTIONS: readonly Point[] = CARDINAL_DIRECTIONS.map((direction) => DIRECTION_VECTOR[direction])
const PATH_COUNT_MIN = 80
const PATH_COUNT_MAX = 120
const UINT32_BASE = 0x1_0000_0000

type Path = Point[]
type Turn = -1 | 0 | 1 | 2

interface RandomSource {
    random: () => number
    choice: <T>(items: readonly T[]) => T
    shuffle: <T>(items: readonly T[]) => T[]
    sample: <T>(items: readonly T[], count: number) => T[]
    uniform: (minimum: number, maximum: number) => number
}

const createRandom = (seed: number): RandomSource => {
    const state = new Uint32Array(624)
    state[0] = 19650218
    for (let position = 1; position < 624; position += 1) state[position] = (Math.imul(1812433253, state[position - 1]! ^ (state[position - 1]! >>> 30)) + position) >>> 0
    const integerSeed = Number.isSafeInteger(seed) ? Math.abs(seed) : seed >>> 0
    const key: number[] = []
    let remainingSeed = integerSeed
    do { key.push(remainingSeed >>> 0); remainingSeed = Math.floor(remainingSeed / UINT32_BASE) } while (remainingSeed > 0)
    let index = 1
    let keyIndex = 0
    let count = Math.max(624, key.length)
    while (count > 0) {
        state[index] = ((state[index]! ^ Math.imul(state[index - 1]! ^ (state[index - 1]! >>> 30), 1664525)) + key[keyIndex]! + keyIndex) >>> 0
        index += 1
        keyIndex += 1
        if (index >= 624) { state[0] = state[623]!; index = 1 }
        if (keyIndex >= key.length) keyIndex = 0
        count -= 1
    }
    count = 623
    while (count > 0) {
        state[index] = ((state[index]! ^ Math.imul(state[index - 1]! ^ (state[index - 1]! >>> 30), 1566083941)) - index) >>> 0
        index += 1
        if (index >= 624) { state[0] = state[623]!; index = 1 }
        count -= 1
    }
    state[0] = 0x80000000
    let cursor = 624
    const nextUInt32 = (): number => {
        if (cursor >= 624) {
            for (let i = 0; i < 624; i += 1) {
                const y = (state[i]! & 0x80000000) | (state[(i + 1) % 624]! & 0x7fffffff)
                state[i] = state[(i + 397) % 624]! ^ (y >>> 1)
                if ((y & 1) !== 0) state[i] = (state[i]! ^ 0x9908b0df) >>> 0
            }
            cursor = 0
        }
        let value = state[cursor++]!
        value ^= value >>> 11
        value ^= (value << 7) & 0x9d2c5680
        value ^= (value << 15) & 0xefc60000
        value ^= value >>> 18
        return value >>> 0
    }
    const random = (): number => ((nextUInt32() >>> 5) * 0x4000000 + (nextUInt32() >>> 6)) / 0x20000000000000
    const randBelow = (upperBound: number): number => {
        const bits = 32 - Math.clz32(upperBound)
        while (true) {
            const value = nextUInt32() >>> (32 - bits)
            if (value < upperBound) return value
        }
    }
    const choice = <T>(items: readonly T[]): T => {
        const value = items[randBelow(items.length)]
        if (value === undefined) throw new Error('Cannot choose from an empty sequence')
        return value
    }
    const shuffle = <T>(items: readonly T[]): T[] => {
        const result = [...items]
        for (let current = result.length - 1; current > 0; current -= 1) {
            const target = randBelow(current + 1)
            ;[result[current], result[target]] = [result[target]!, result[current]!]
        }
        return result
    }
    const sample = <T>(items: readonly T[], count: number): T[] => {
        if (count < 0 || count > items.length) throw new Error('Sample larger than population')
        const pool = [...items]
        const result: T[] = []
        for (let i = 0; i < count; i += 1) {
            const target = randBelow(pool.length - i)
            result.push(pool[target]!)
            pool[target] = pool[pool.length - i - 1]!
        }
        return result
    }
    return {random, choice, shuffle, sample, uniform: (minimum, maximum) => minimum + (maximum - minimum) * random()}
}


const vectorKey = (vector: Point): string => `${vector.row},${vector.col}`
const directionFromVector = (vector: Point): Direction => {
    const direction = CARDINAL_DIRECTIONS.find((candidate) => vectorKey(DIRECTION_VECTOR[candidate]) === vectorKey(vector))
    if (!direction) throw new Error(`Invalid cardinal direction: ${vectorKey(vector)}`)
    return direction
}
const turnType = (previous: Point | null, current: Point): Turn => {
    if (!previous || vectorKey(previous) === vectorKey(current)) return 0
    const previousIndex = GRID_DIRECTIONS.findIndex((direction) => vectorKey(direction) === vectorKey(previous))
    const currentIndex = GRID_DIRECTIONS.findIndex((direction) => vectorKey(direction) === vectorKey(current))
    const difference = (currentIndex - previousIndex + 4) % 4
    if (difference === 1) return 1
    if (difference === 3) return -1
    return 2
}
const neighbours = (point: Point, rows: number, cols: number): Point[] => GRID_DIRECTIONS
    .map((direction) => ({row: point.row + direction.row, col: point.col + direction.col}))
    .filter((candidate) => candidate.row >= 0 && candidate.row < rows && candidate.col >= 0 && candidate.col < cols)
const unvisitedDegree = (point: Point, visited: ReadonlySet<string>, rows: number, cols: number): number => neighbours(point, rows, cols).filter((candidate) => !visited.has(pointKey(candidate))).length
const distance2 = (point: Point, center: Point): number => (point.col - center.col) ** 2 + (point.row - center.row) ** 2

const walk = (
    start: Point, visited: ReadonlySet<string>, rows: number, cols: number, targetLength: number, random: RandomSource,
    minStraight = 2, maxStraight = 5, straightBias = 0.82, degreeTolerance = 1, maxSameTurn = 1, forcedFirstDirection: Point | null = null,
): Path | null => {
    const path: Path = [{...start}]
    const localVisited = new Set(visited)
    localVisited.add(pointKey(start))
    let current = {...start}
    let lastDirection: Point | null = null
    let stepsSinceTurn = 0
    let lastTurn: Turn = 0
    let sameTurnStreak = 0
    if (forcedFirstDirection) {
        const next = {row: start.row + forcedFirstDirection.row, col: start.col + forcedFirstDirection.col}
        if (next.row < 0 || next.row >= rows || next.col < 0 || next.col >= cols || localVisited.has(pointKey(next))) return null
        path.push(next)
        localVisited.add(pointKey(next))
        current = next
        lastDirection = forcedFirstDirection
        stepsSinceTurn = 1
    }
    const pickByDegree = (pool: Map<string, {point: Point; degree: number}>): Point => {
        const best = Math.min(...[...pool.values()].map((candidate) => candidate.degree))
        return random.choice([...pool.values()].filter((candidate) => candidate.degree === best)).point
    }
    const filterSpiral = (pool: Map<string, {point: Point; degree: number}>): Map<string, {point: Point; degree: number}> => {
        if (lastTurn === 0 || sameTurnStreak < maxSameTurn) return pool
        const filtered = new Map<string, {point: Point; degree: number}>()
        for (const [key, candidate] of pool) {
            const nextDirection = {row: candidate.point.row - current.row, col: candidate.point.col - current.col}
            if (turnType(lastDirection, nextDirection) !== lastTurn) filtered.set(key, candidate)
        }
        return filtered.size > 0 ? filtered : pool
    }
    while (path.length < targetLength) {
        const candidates = neighbours(current, rows, cols).filter((candidate) => !localVisited.has(pointKey(candidate)))
        if (candidates.length === 0) break
        const degrees = new Map(candidates.map((candidate) => [pointKey(candidate), {point: candidate, degree: unvisitedDegree(candidate, localVisited, rows, cols)}]))
        const best = Math.min(...[...degrees.values()].map((candidate) => candidate.degree))
        const straightPoint = lastDirection ? {row: current.row + lastDirection.row, col: current.col + lastDirection.col} : null
        const straightKey = straightPoint ? pointKey(straightPoint) : ''
        const straightCandidate = degrees.get(straightKey)
        const forceTurn = lastDirection !== null && stepsSinceTurn >= maxStraight && straightCandidate !== undefined
        const forceStraight = lastDirection !== null && stepsSinceTurn < minStraight && straightCandidate !== undefined
        let next: Point
        if (forceTurn) {
            const turnPool = new Map([...degrees].filter(([key]) => key !== straightKey))
            next = turnPool.size > 0 ? pickByDegree(filterSpiral(turnPool)) : straightCandidate!.point
        } else if (forceStraight) next = straightCandidate!.point
        else if (straightCandidate && straightCandidate.degree <= best + degreeTolerance && random.random() < straightBias) next = straightCandidate.point
        else {
            const turnOnly = new Map([...degrees].filter(([key]) => key !== straightKey))
            const merged = turnOnly.size > 0 ? filterSpiral(turnOnly) : new Map<string, {point: Point; degree: number}>()
            if (straightCandidate) merged.set(straightKey, straightCandidate)
            next = pickByDegree(merged.size > 0 ? merged : filterSpiral(degrees))
        }
        const newDirection = {row: next.row - current.row, col: next.col - current.col}
        if (lastDirection && vectorKey(newDirection) === vectorKey(lastDirection)) stepsSinceTurn += 1
        else {
            const currentTurn = lastDirection ? turnType(lastDirection, newDirection) : 0
            sameTurnStreak = currentTurn !== 0 && currentTurn === lastTurn ? sameTurnStreak + 1 : currentTurn !== 0 ? 1 : 0
            lastTurn = currentTurn
            stepsSinceTurn = 1
        }
        lastDirection = newDirection
        path.push(next)
        localVisited.add(pointKey(next))
        current = next
    }
    return path
}

const findEntryPoint = (emptyCells: Point[], occupied: ReadonlySet<string>, rows: number, cols: number, center: Point, preferCloseToCenter: boolean, random: RandomSource): {head: Point; direction: Point} | null => {
    const pool = emptyCells.length <= 400 ? emptyCells : random.sample(emptyCells, 400)
    const candidates: Array<{head: Point; direction: Point}> = []
    for (const head of pool) for (const direction of GRID_DIRECTIONS) {
        const inward = {row: head.row - direction.row, col: head.col - direction.col}
        if (inward.row < 0 || inward.row >= rows || inward.col < 0 || inward.col >= cols || occupied.has(pointKey(inward))) continue
        let row = head.row
        let col = head.col
        let clear = true
        while (true) {
            row += direction.row
            col += direction.col
            if (row < 0 || row >= rows || col < 0 || col >= cols) break
            if (occupied.has(`${row},${col}`)) { clear = false; break }
        }
        if (clear) candidates.push({head, direction})
    }
    if (candidates.length === 0) return null
    candidates.sort((left, right) => preferCloseToCenter
        ? distance2(left.head, center) - distance2(right.head, center)
        : distance2(right.head, center) - distance2(left.head, center))
    return random.choice(candidates.slice(0, Math.max(1, Math.floor(candidates.length / 4))))
}

const generatePaths = (rows: number, cols: number, targetPathCount: number, random: RandomSource): Path[] => {
    const occupied = new Set<string>()
    const allPoints = Array.from({length: cols}, (_, col) => Array.from({length: rows}, (_, row) => ({row, col}))).flat()
    const center = {row: (rows - 1) / 2, col: (cols - 1) / 2}
    const rawPieces: Path[] = []
    const phaseLongCount = Math.max(6, Math.floor(targetPathCount * 0.22))
    let forcedMode = true
    while (occupied.size < allPoints.length) {
        const emptyCells = allPoints.filter((point) => !occupied.has(pointKey(point)))
        const averageLength = Math.max(2, emptyCells.length / Math.max(1, targetPathCount - rawPieces.length))
        const longPhase = rawPieces.length < phaseLongCount
        const targetLength = longPhase ? Math.max(6, Math.floor(averageLength * random.uniform(1.6, 2.6))) : Math.max(2, Math.floor(averageLength * random.uniform(0.5, 1.3)))
        const parameters = longPhase ? {minStraight: 2, maxStraight: 4, straightBias: 0.85, degreeTolerance: 1, maxSameTurn: 2} : {minStraight: 1, maxStraight: 3, straightBias: 0.7, degreeTolerance: 1, maxSameTurn: 1}
        const entry = forcedMode ? findEntryPoint(emptyCells, occupied, rows, cols, center, longPhase, random) : null
        let path: Path | null
        if (entry) {
            path = walk(entry.head, occupied, rows, cols, targetLength, random, parameters.minStraight, parameters.maxStraight, parameters.straightBias, parameters.degreeTolerance, parameters.maxSameTurn, {row: -entry.direction.row, col: -entry.direction.col})
            if (!path || path.length < 2) throw new Error('Forced first step failed')
        } else {
            forcedMode = false
            const frontier = emptyCells.filter((point) => neighbours(point, rows, cols).some((next) => occupied.has(pointKey(next))))
            const pool = frontier.length > 0 ? frontier : emptyCells
            pool.sort((left, right) => distance2(left, center) - distance2(right, center))
            path = walk(pool[0]!, occupied, rows, cols, targetLength, random, parameters.minStraight, parameters.maxStraight, parameters.straightBias, parameters.degreeTolerance, parameters.maxSameTurn)
        }
        if (!path) throw new Error('Path construction failed')
        for (const point of path) occupied.add(pointKey(point))
        rawPieces.push(entry ? [...path].reverse() : path)
    }
    return rawPieces
}


const repairSingletons = (input: Path[], rows: number, cols: number, random: RandomSource): Path[] => {
    const paths: Array<Path | null> = input.map((path) => [...path])
    let changed = true
    while (changed) {
        changed = false
        const owner = new Map<string, number>()
        paths.forEach((path, index) => path?.forEach((point) => owner.set(pointKey(point), index)))
        for (let index = 0; index < paths.length; index += 1) {
            const path = paths[index]
            if (!path || path.length !== 1) continue
            const point = path[0]!
            const shuffled = random.shuffle(neighbours(point, rows, cols))
            let safe: number | undefined
            let risky: number | undefined
            for (const neighbour of shuffled) {
                const otherIndex = owner.get(pointKey(neighbour))
                const other = otherIndex === undefined ? undefined : paths[otherIndex]
                if (!other || otherIndex === index) continue
                if (pointKey(other[0]!) === pointKey(neighbour) && safe === undefined) safe = otherIndex
                else if (pointKey(other.at(-1)!) === pointKey(neighbour) && risky === undefined) risky = otherIndex
            }
            let merged = false
            if (safe !== undefined) { paths[safe]!.unshift(point); merged = true }
            else if (risky !== undefined) { paths[risky]!.push(point); merged = true }
            else {
                for (const neighbour of shuffled) {
                    const otherIndex = owner.get(pointKey(neighbour))
                    const other = otherIndex === undefined ? undefined : paths[otherIndex]
                    if (!other || otherIndex === undefined) continue
                    const split = other.findIndex((candidate) => pointKey(candidate) === pointKey(neighbour))
                    if (split < 0) continue
                    const left = other.slice(0, split)
                    const right = other.slice(split + 1)
                    if (right.length >= 2) { paths[otherIndex] = [...other.slice(0, split + 1), point]; paths.push(right) }
                    else if (left.length >= 2) { paths[otherIndex] = [point, ...other.slice(split)]; paths.push(left) }
                    else continue
                    merged = true
                    break
                }
            }
            if (merged) { paths[index] = null; changed = true; break }
        }
        for (let index = paths.length - 1; index >= 0; index -= 1) if (paths[index] === null) paths.splice(index, 1)
    }
    return paths.filter((path): path is Path => path !== null)
}

const adjustPathCount = (input: Path[], rows: number, cols: number, countMin: number, countMax: number, random: RandomSource): Path[] => {
    let paths = input.map((path) => [...path])
    let iterations = 0
    while (paths.length > countMax && iterations < 2000) {
        iterations += 1
        const endpointMap = new Map<string, Array<[number, 'head' | 'tail']>>()
        paths.forEach((path, index) => { for (const [point, side] of [[path[0], 'head'], [path.at(-1), 'tail']] as const) if (point) endpointMap.set(pointKey(point), [...(endpointMap.get(pointKey(point)) ?? []), [index, side]]) })
        let merged = false
        for (const index of random.shuffle(paths.map((_, pathIndex) => pathIndex))) {
            if (paths.length <= countMax) break
            const path = paths[index]!
            for (const [end, isTail] of [[path[0], false], [path.at(-1), true]] as const) {
                if (!end) continue
                for (const neighbour of neighbours(end, rows, cols)) for (const [otherIndex, side] of endpointMap.get(pointKey(neighbour)) ?? []) {
                    if (otherIndex === index) continue
                    const other = paths[otherIndex]
                    if (!other) continue
                    const newPath = isTail ? side === 'head' ? [...path, ...other] : [...path, ...[...other].reverse()] : side === 'head' ? [...[...path].reverse(), ...other] : [...[...path].reverse(), ...[...other].reverse()]
                    const joinLeft = newPath[path.length - 1]
                    const joinRight = newPath[path.length]
                    if (!joinLeft || !joinRight || Math.abs(joinLeft.row - joinRight.row) + Math.abs(joinLeft.col - joinRight.col) !== 1 || new Set(newPath.map(pointKey)).size !== newPath.length) continue
                    paths[index] = newPath
                    paths[otherIndex] = []
                    merged = true
                    break
                }
                if (merged) break
            }
            if (merged) break
        }
        if (!merged) break
        paths = paths.filter((path) => path.length > 0)
    }
    iterations = 0
    while (paths.length < countMin && iterations < 2000) {
        iterations += 1
        paths.sort((left, right) => right.length - left.length)
        const longest = paths[0]
        if (!longest || longest.length < 4) break
        const midpoint = Math.floor(longest.length / 2)
        const left = longest.slice(0, midpoint)
        const right = longest.slice(midpoint)
        if (left.length < 2 || right.length < 2) break
        paths[0] = left
        paths.push(right)
    }
    return paths
}

const resolveDependencyCycles = (input: Path[], rows: number, cols: number, random: RandomSource, maxOuter = 5000): Path[] => {
    const paths: Array<Path | null> = input.map((path) => [...path])
    const orientations = (path: Path): Array<[Point, Point]> => {
        const tail = path.at(-1)!
        const head = path[0]!
        return [[tail, {row: tail.row - path.at(-2)!.row, col: tail.col - path.at(-2)!.col}], [head, {row: head.row - path[1]!.row, col: head.col - path[1]!.col}]]
    }
    const reattachStray = (index: number, excluded: ReadonlySet<number> = new Set()): void => {
        const path = paths[index]
        if (!path) return
        const point = path[0]!
        const owner = new Map<string, number>()
        paths.forEach((candidate, candidateIndex) => candidate?.forEach((cell) => { if (candidateIndex !== index) owner.set(pointKey(cell), candidateIndex) }))
        let safe: number | undefined
        let risky: number | undefined
        let safeExcluded: number | undefined
        let riskyExcluded: number | undefined
        let middle: number | undefined
        let middlePoint: Point | undefined
        let middleExcluded: number | undefined
        let middleExcludedPoint: Point | undefined
        for (const neighbour of neighbours(point, rows, cols)) {
            const candidateIndex = owner.get(pointKey(neighbour))
            const candidate = candidateIndex === undefined ? undefined : paths[candidateIndex]
            if (!candidate || candidateIndex === undefined) continue
            if (pointKey(candidate[0]!) === pointKey(neighbour)) {
                if (excluded.has(candidateIndex)) safeExcluded ??= candidateIndex
                else { safe = candidateIndex; break }
            } else if (pointKey(candidate.at(-1)!) === pointKey(neighbour)) {
                if (excluded.has(candidateIndex)) riskyExcluded ??= candidateIndex
                else risky ??= candidateIndex
            } else if (middle === undefined && !excluded.has(candidateIndex)) {
                middle = candidateIndex
                middlePoint = neighbour
            } else if (middleExcluded === undefined) {
                middleExcluded = candidateIndex
                middleExcludedPoint = neighbour
            }
        }
        const target = safe ?? risky ?? safeExcluded ?? riskyExcluded
        const middleTarget = target === undefined ? (middle ?? middleExcluded) : undefined
        if (target === undefined && middleTarget === undefined) return
        if (target !== undefined && (target === safe || target === safeExcluded)) paths[target]!.unshift(point)
        else if (target !== undefined) paths[target]!.push(point)
        else {
            const neighbour = middleTarget === middle ? middlePoint : middleExcludedPoint
            const targetPath = paths[middleTarget!]!
            const split = targetPath.findIndex((candidate) => pointKey(candidate) === pointKey(neighbour!))
            const before = targetPath.slice(0, split)
            const after = targetPath.slice(split + 1)
            if (before.length >= after.length) {
                paths[middleTarget!] = [...before, neighbour!, point]
                if (after.length > 0) paths.push(after)
            } else {
                paths[middleTarget!] = [point, neighbour!, ...after]
                if (before.length > 0) paths.push(before)
            }
        }
        paths[index] = null
    }
    const spliceConnect = (index: number, otherIndex: number, point: Point): number | null => {
        const other = paths[otherIndex]
        if (!other) return null
        const split = other.findIndex((candidate) => pointKey(candidate) === pointKey(point))
        if (split < 0) return null
        const before = other.slice(0, split)
        const after = other.slice(split + 1)
        const extension = before.length >= after.length ? [point, ...[...before].reverse()] : [point, ...after]
        const leftover = before.length >= after.length ? after : before
        paths[index] = [...paths[index]!, ...extension]
        paths[otherIndex] = leftover.length > 0 ? leftover : null
        return leftover.length === 1 ? otherIndex : null
    }
    const selfSplit = (index: number, point: Point): [number | null, number | null] => {
        const path = paths[index]!
        const splitIndex = path.findIndex((candidate) => pointKey(candidate) === pointKey(point))
        let split = Math.max(splitIndex, 1)
        if (path.length - 3 >= 1) split = Math.min(split, path.length - 3)
        const withPoint = path.slice(0, split + 1)
        const withHead = path.slice(split + 1)
        paths[index] = withPoint
        const newIndex = paths.length
        paths.push(withHead)
        if (withHead.length === 1) return [newIndex, index]
        if (withPoint.length === 1) return [index, newIndex]
        return [null, null]
    }
    const forbiddenMerges = new Set<string>()
    const seenStates = new Set<number>()
    for (let outer = 0; outer < maxOuter; outer += 1) {
        const stray = paths.findIndex((path) => path !== null && path.length < 2)
        if (stray >= 0) { reattachStray(stray); continue }
        const owner = new Map<string, number>()
        paths.forEach((path, index) => path?.forEach((point) => owner.set(pointKey(point), index)))
        const removed = new Set<number>()
        const remaining = new Set(paths.map((path, index) => path ? index : -1).filter((index) => index >= 0))
        const chosenFlip = new Map<number, number>()
        let progress = true
        while (progress && remaining.size > 0) {
            progress = false
            for (const index of [...remaining].sort((left, right) => left - right)) {
                const path = paths[index]!
                for (const [flip, [head, direction]] of orientations(path).entries()) {
                    const {blocker} = rayHit(owner, head, direction, rows, cols, removed)
                    if (blocker !== index && (blocker === null || removed.has(blocker))) {
                        chosenFlip.set(index, flip)
                        removed.add(index)
                        remaining.delete(index)
                        progress = true
                        break
                    }
                }
            }
        }
        if (remaining.size === 0) {
            for (const [index, flip] of chosenFlip) if (flip === 1) paths[index] = [...paths[index]!].reverse()
            return paths.filter((path): path is Path => path !== null)
        }
        let selected: number | undefined
        const pathHashes: number[] = []
        for (const path of paths) {
            if (!path) continue
            let pathHash = 2166136261
            pathHash = Math.imul(pathHash ^ path.length, 16777619)
            for (const point of path) {
                pathHash = Math.imul(pathHash ^ point.row, 16777619)
                pathHash = Math.imul(pathHash ^ point.col, 16777619)
            }
            pathHashes.push(pathHash)
        }
        let state = 2166136261
        for (const pathHash of pathHashes.sort((left, right) => left - right)) state = Math.imul(state ^ pathHash, 16777619)
        const cycling = seenStates.has(state)
        seenStates.add(state)
        if (cycling) {
            selected = random.choice([...remaining].sort((left, right) => left - right))
        } else {
            for (const candidate of [...remaining].sort((left, right) => left - right)) {
                const path = paths[candidate]!
                const head = path.at(-1)!
                const direction = {row: head.row - path.at(-2)!.row, col: head.col - path.at(-2)!.col}
                const {blocker: other} = rayHit(owner, head, direction, rows, cols, new Set())
                const mergeKey = other === null ? '' : `${Math.min(candidate, other)}:${Math.max(candidate, other)}`
                if (!forbiddenMerges.has(mergeKey)) { selected = candidate; break }
            }
        }
        selected ??= [...remaining].sort((left, right) => left - right)[0]
        if (selected === undefined) break
        const selectedPath = paths[selected]!
        const head = selectedPath.at(-1)!
        const direction = {row: head.row - selectedPath.at(-2)!.row, col: head.col - selectedPath.at(-2)!.col}
        const {point: next, blocker: otherIndex} = rayHit(owner, head, direction, rows, cols, new Set())
        if (!next || otherIndex === null) continue
        if (otherIndex === selected) {
            const newIndex = paths.length
            const [strayIndex, excludeIndex] = selfSplit(selected, next)
            forbiddenMerges.add(`${Math.min(selected, newIndex)}:${Math.max(selected, newIndex)}`)
            if (strayIndex !== null) reattachStray(strayIndex, new Set([excludeIndex!]))
        } else {
            const strayIndex = spliceConnect(selected, otherIndex, next)
            if (strayIndex !== null) reattachStray(strayIndex, new Set([selected]))
        }
    }
    return paths.filter((path): path is Path => path !== null)
}

const validate = (paths: Path[], rows: number, cols: number): void => {
    const seen = new Set<string>()
    for (const path of paths) {
        if (path.length < 2) throw new Error('Generated path is shorter than two cells')
        for (let index = 1; index < path.length; index += 1) {
            const previous = path[index - 1]!
            const current = path[index]!
            if (Math.abs(current.row - previous.row) + Math.abs(current.col - previous.col) !== 1) throw new Error(`Generated path has an invalid step at ${index}: ${previous.row},${previous.col}->${current.row},${current.col}`)
        }
        for (const point of path) {
            const key = pointKey(point)
            if (seen.has(key)) throw new Error(`Generated paths overlap at ${key}`)
            seen.add(key)
        }
    }
    if (seen.size !== rows * cols) throw new Error(`Generated board has ${rows * cols - seen.size} uncovered cells`)
    const {stuck} = solveBoard(paths, rows, cols)
    if (stuck.length > 0) throw new Error(`Generated board has ${stuck.length} stuck paths`)
}

export const verifyGeneratedPaths = (paths: Path[], rows: number, cols: number): boolean => solveBoard(paths, rows, cols).stuck.length === 0

const restoreCoverage = (paths: Path[], rows: number, cols: number): Path[] | null => {
    const occupied = new Set(paths.flatMap((path) => path.map(pointKey)))
    let missing = false
    const repaired = paths.map((path) => [...path])
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            if (!occupied.has(`${row},${col}`)) { repaired.push([{row, col}]); missing = true }
        }
    }
    return missing ? repaired : null
}

const buildCandidate = (levelIndex: number, profile: ReturnType<typeof getLevelProfile>, random: RandomSource, seed: number): Level | null => {
    let paths = generatePaths(profile.rows, profile.cols, profile.arrowCount, random)
    paths = repairSingletons(paths, profile.rows, profile.cols, random)
    paths = adjustPathCount(paths, profile.rows, profile.cols, PATH_COUNT_MIN, PATH_COUNT_MAX, random)
    paths = resolveDependencyCycles(paths, profile.rows, profile.cols, random)
    const restored = restoreCoverage(paths, profile.rows, profile.cols)
    if (restored) {
        paths = repairSingletons(restored, profile.rows, profile.cols, random)
        paths = resolveDependencyCycles(paths, profile.rows, profile.cols, random)
    }
    if (paths.length < PATH_COUNT_MIN || paths.length > PATH_COUNT_MAX) {
        paths = adjustPathCount(paths, profile.rows, profile.cols, PATH_COUNT_MIN, PATH_COUNT_MAX, random)
        paths = resolveDependencyCycles(paths, profile.rows, profile.cols, random)
    }
    if (paths.length < PATH_COUNT_MIN || paths.length > PATH_COUNT_MAX) {
        paths = adjustPathCount(paths, profile.rows, profile.cols, PATH_COUNT_MIN, PATH_COUNT_MAX, random)
        paths = resolveDependencyCycles(paths, profile.rows, profile.cols, random)
    }
    validate(paths, profile.rows, profile.cols)
    if (paths.length < PATH_COUNT_MIN || paths.length > PATH_COUNT_MAX) return null
    const arrows: Arrow[] = paths.map((path, index) => {
        const head = path.at(-1)!
        const previous = path.at(-2)!
        return {id: `arrow-${index + 1}`, color: COLORS[index % COLORS.length] ?? '#ffffff', cells: path.map((point) => ({...point})), direction: directionFromVector({row: head.row - previous.row, col: head.col - previous.col}), head: {...head}, alive: true, highlighted: false}
    })
    return {id: `level-${levelIndex + 1}`, difficulty: profile.difficulty, rows: profile.rows, cols: profile.cols, arrows, playableCells: Array.from({length: profile.rows * profile.cols}, (_, index) => ({row: Math.floor(index / profile.cols), col: index % profile.cols})), timeLimitSec: profile.timeLimitSec, seed}
}

export const generateLevel = (levelIndex: number, requestedSeed = seedForLevel(levelIndex)): Level => {
    const random = createRandom(requestedSeed)
    const profile = getLevelProfile(levelIndex, requestedSeed)
    let lastError: unknown = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
            const candidate = buildCandidate(levelIndex, profile, random, requestedSeed)
            if (candidate) return candidate
        } catch (error) { lastError = error }
    }
    const detail = lastError instanceof Error ? `: ${lastError.message}` : ''
    throw new Error(`Unable to generate a solvable level for index ${levelIndex}${detail}`)
}
