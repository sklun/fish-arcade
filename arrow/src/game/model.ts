export type Direction =
  | 'up'
  | 'up-right'
  | 'right'
  | 'down-right'
  | 'down'
  | 'down-left'
  | 'left'
  | 'up-left'

export interface Point {
  row: number
  col: number
}

export interface Arrow {
  id: string
  color: string
  cells: Point[]
  direction: Direction
  head: Point
  alive: boolean
  highlighted: boolean
}

export interface Level {
  id: string
  difficulty: 'normal' | 'hard'
  rows: number
  cols: number
  arrows: Arrow[]
  /** The cells that belong to the playable shape. Omitted levels use a rectangle for compatibility. */
  playableCells?: Point[]
  timeLimitSec: number
  seed: number
}

export const DIRECTIONS: Direction[] = [
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
]

export const DIRECTION_VECTOR: Record<Direction, Point> = {
  up: { row: -1, col: 0 },
  'up-right': { row: -1, col: 1 },
  right: { row: 0, col: 1 },
  'down-right': { row: 1, col: 1 },
  down: { row: 1, col: 0 },
  'down-left': { row: 1, col: -1 },
  left: { row: 0, col: -1 },
  'up-left': { row: -1, col: -1 },
}

export const pointKey = ({ row, col }: Point): string => `${row},${col}`

export const cloneArrow = (arrow: Arrow): Arrow => ({
  ...arrow,
  cells: arrow.cells.map((cell) => ({ ...cell })),
  head: { ...arrow.head },
})

export const cloneLevel = (level: Level): Level => ({
  ...level,
  arrows: level.arrows.map(cloneArrow),
  playableCells: level.playableCells?.map((cell) => ({ ...cell })),
})

export const rectangularCells = (level: Pick<Level, 'rows' | 'cols'>): Point[] =>
  Array.from({ length: level.rows * level.cols }, (_, index) => ({
    row: Math.floor(index / level.cols),
    col: index % level.cols,
  }))

export const playableCellsFor = (level: Pick<Level, 'rows' | 'cols' | 'playableCells'>): Point[] =>
  level.playableCells ?? rectangularCells(level)
