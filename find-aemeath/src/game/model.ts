export type Difficulty = 'normal' | 'hard'

export type Point = {
  row: number
  col: number
}

export type CellStatus =
  | 'hidden'
  | 'flagged'
  | 'auto-flagged'
  | 'revealed-target'
  | 'revealed-empty'

export type Region = {
  id: string
  color: string
  cells: Point[]
  target: Point
}

export type Cell = Point & {
  regionId: string
  hasTarget: boolean
  status: CellStatus
}

export type Level = {
  id: string
  seed: number
  difficulty: Difficulty
  rows: number
  cols: number
  regions: Region[]
  cells: Cell[]
}

export const REGION_COLORS = [
  '#4f9eb0',
  '#7d71c8',
  '#d0799f',
  '#68a982',
  '#c69155',
  '#5f84b8',
  '#aa6cb3',
  '#4d9b91',
  '#c36c6c',
  '#7896a8',
  '#a5a35b',
  '#7669a9',
  '#5d9fce',
  '#c77d59',
  '#7cae7b',
  '#a76e96',
] as const

export const pointKey = ({ row, col }: Point): string => `${row},${col}`

export const samePoint = (first: Point, second: Point): boolean =>
  first.row === second.row && first.col === second.col

export const allPoints = (rows: number, cols: number): Point[] =>
  Array.from({ length: rows * cols }, (_, index) => ({
    row: Math.floor(index / cols),
    col: index % cols,
  }))

export const neighbours4 = ({ row, col }: Point): Point[] => [
  { row: row - 1, col },
  { row, col: col + 1 },
  { row: row + 1, col },
  { row, col: col - 1 },
]

export const neighbours8 = ({ row, col }: Point): Point[] =>
  Array.from({ length: 3 }, (_, rowOffset) =>
    Array.from({ length: 3 }, (_, colOffset) => ({
      row: row + rowOffset - 1,
      col: col + colOffset - 1,
    })),
  )
    .flat()
    .filter((candidate) => !samePoint(candidate, { row, col }))

export const inBounds = (point: Point, rows: number, cols: number): boolean =>
  point.row >= 0 && point.row < rows && point.col >= 0 && point.col < cols

export const cloneLevel = (level: Level): Level => ({
  ...level,
  regions: level.regions.map((region) => ({
    ...region,
    cells: region.cells.map((cell) => ({ ...cell })),
    target: { ...region.target },
  })),
  cells: level.cells.map((cell) => ({ ...cell })),
})
