import {allPoints, type Cell, type Level, neighbours4, type Point, type Region, REGION_COLORS,} from '@/game/model'
import {getLevelProfile} from '@/game/progression'
import {deduceTargets, isSolvable} from '@/game/solver'

class SeededRandom {
    private state: number

    constructor(seed: number) {
        this.state = (seed >>> 0) || 1
    }

    next(): number {
        this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0
        return this.state / 0x100000000
    }
}

type RegionDraft = {
    cells: Point[]
}

const pointKey = ({row, col}: Point): string => `${row},${col}`

const conflictsWith = (first: Point, second: Point): boolean =>
    first.row === second.row ||
    first.col === second.col ||
    (Math.abs(first.row - second.row) <= 1 && Math.abs(first.col - second.col) <= 1)

const shuffle = <T>(items: T[], random: SeededRandom): T[] => {
    const result = [...items]
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random.next() * (index + 1))
        const current = result[index]
        result[index] = result[swapIndex] as T
        result[swapIndex] = current as T
    }
    return result
}

const frontierCandidates = (
    region: RegionDraft,
    owners: Map<string, number>,
    rows: number,
    cols: number,
    random: SeededRandom,
): Point[] => {
    const frontier = new Map<string, Point>()
    for (const cell of region.cells) {
        for (const candidate of neighbours4(cell)) {
            if (candidate.row < 0 || candidate.row >= rows || candidate.col < 0 || candidate.col >= cols) continue
            const key = pointKey(candidate)
            if (!owners.has(key)) frontier.set(key, candidate)
        }
    }
    return shuffle([...frontier.values()], random)
}

const growDeductiveRegions = (
    rows: number,
    cols: number,
    targets: Point[],
    random: SeededRandom,
): RegionDraft[] | null => {
    const regions = targets.map((target) => ({cells: [{...target}]}))
    const owners = new Map<string, number>()
    targets.forEach((target, index) => owners.set(pointKey(target), index))

    for (let regionIndex = 1; regionIndex < regions.length; regionIndex += 1) {
        const target = targets[regionIndex] as Point
        const bridge = {row: target.row, col: target.col - 1}
        if (owners.has(pointKey(bridge))) return null
        regions[regionIndex]?.cells.push(bridge)
        owners.set(pointKey(bridge), regionIndex)
    }

    while (owners.size < rows * cols) {
        const available = shuffle(regions.map((region, regionIndex) => ({region, regionIndex})), random)
            .filter(({region, regionIndex}) => regionIndex > 0 || region.cells.length < 2)
            .map(({region, regionIndex}) => ({
                region,
                regionIndex,
                frontier: frontierCandidates(region, owners, rows, cols, random).filter((cell) =>
                    regionIndex > 0
                        ? targets.slice(0, regionIndex).some((target) => conflictsWith(cell, target))
                        : region.cells.length < 2,
                ),
            }))
            .filter(({frontier}) => frontier.length > 0)
            .sort((first, second) => first.region.cells.length - second.region.cells.length)
        const selected = available[0]
        const next = selected?.frontier[0]
        if (!selected || !next) return null
        selected.region.cells.push(next)
        owners.set(pointKey(next), selected.regionIndex)
    }

    return regions
}

const hasMixedShape = (cells: Point[]): boolean => {
    if (cells.length <= 2) return true
    const rows = new Set(cells.map((cell) => cell.row))
    const cols = new Set(cells.map((cell) => cell.col))
    return rows.size > 1 && cols.size > 1
}

const chooseTargetLayout = (size: number, random: SeededRandom): Point[] | null => {
    const targets = new Array<Point | undefined>(size)
    const usedCols = new Set<number>()

    const search = (row: number): boolean => {
        if (row === size) return true
        for (const col of shuffle(Array.from({length: size}, (_, index) => index), random)) {
            if (usedCols.has(col)) continue
            const previous = targets[row - 1]
            if (previous && Math.abs(previous.col - col) <= 1) continue
            targets[row] = {row, col}
            usedCols.add(col)
            if (search(row + 1)) return true
            targets[row] = undefined
            usedCols.delete(col)
        }
        return false
    }

    return search(0)
        ? (targets as Point[]).sort((first, second) => first.col - second.col)
        : null
}

const buildRegions = (
    drafts: RegionDraft[],
    targets: Point[],
): Region[] => drafts.map((draft, index) => ({
    id: `region-${index + 1}`,
    color: REGION_COLORS[index % REGION_COLORS.length] ?? REGION_COLORS[0],
    cells: draft.cells,
    target: targets[index] as Point,
}))

export const generateLevel = (levelIndex: number, seed = 0xAEE7 + levelIndex * 7919): Level => {
    const profile = getLevelProfile(levelIndex)
    const random = new SeededRandom(seed)
    if (profile.rows !== profile.cols || profile.regions !== profile.rows) {
        throw new Error('可推理关卡要求区域数与方形棋盘边长一致')
    }

    for (let attempt = 0; attempt < 128; attempt += 1) {
        const targets = chooseTargetLayout(profile.rows, random)
        if (!targets) continue
        const drafts = growDeductiveRegions(profile.rows, profile.cols, targets, random)
        if (!drafts) continue
        if (drafts.some((region) => !hasMixedShape(region.cells))) continue
        if (drafts.some((region) => region.cells.length === 1)) continue
        const regions = buildRegions(drafts, targets)
        const targetKeys = new Set(regions.map((region) => pointKey(region.target)))
        const regionByCell = new Map(drafts.flatMap((draft, index) => draft.cells.map((cell) => [pointKey(cell), index])))
        const cells: Cell[] = allPoints(profile.rows, profile.cols).map((point) => {
            const regionIndex = regionByCell.get(pointKey(point))
            if (regionIndex === undefined) throw new Error(`未能为格子 ${point.row},${point.col} 分配区域`)
            return {
                ...point,
                regionId: regions[regionIndex]?.id ?? '',
                hasTarget: targetKeys.has(pointKey(point)),
                status: 'hidden',
            }
        })
        const level: Level = {
            id: `aemeath-${levelIndex + 1}`,
            seed,
            difficulty: profile.difficulty,
            rows: profile.rows,
            cols: profile.cols,
            regions,
            cells,
        }
        const deductions = deduceTargets(level)
        const advancedSteps = deductions.filter((step) => step.reason !== 'single-candidate').length
        const minimumAdvancedSteps = profile.difficulty === 'hard' ? 2 : 1
        if (deductions.length < regions.length || advancedSteps < minimumAdvancedSteps) continue
        if (isSolvable(level)) return level
    }

    throw new Error(`在 ${levelIndex + 1} 关生成唯一解耦合关卡失败`)
}
